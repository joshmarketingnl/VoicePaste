import { clipboard } from 'electron';
import { ChildProcess, execFile, spawn } from 'child_process';

export interface PasteOptions {
  restoreClipboard: boolean;
  restoreDelayMs: number;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // windowsHide: without it a console window flashes up on every paste,
    // steals focus from the app the user is pasting into, and the ^v lands
    // nowhere. That was the "sometimes it just doesn't paste" bug.
    execFile(command, args, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Windows paste helper: one long-lived PowerShell that waits for "paste" on
 * stdin and sends ^v. Spawning a fresh PowerShell per paste costs ~260ms at
 * best and was measured at 5s under load — long enough that the user gives up
 * and presses the hotkey again. Reusing one process makes it milliseconds.
 */
const HELPER_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  // The paste hotkey itself holds modifiers down (Win+Alt+V). Sending ^v while
  // they are still physically pressed makes the target see Win+Alt+Ctrl+V,
  // which is not paste — the transcript silently stays on the clipboard. Wait
  // for the user to let go first (bounded, so a stuck key can't block pasting).
  'Add-Type -Name Vp -Namespace Native -MemberDefinition \'[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);\'',
  '$mods = @(0x10, 0x11, 0x12, 0x5B, 0x5C)', // shift, ctrl, alt, lwin, rwin
  '$w = New-Object -ComObject WScript.Shell',
  '[Console]::Out.WriteLine("ready")',
  '[Console]::Out.Flush()',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($null -eq $line) { break }',
  '  if ($line -eq "paste") {',
  '    $waited = 0',
  '    while ($waited -lt 2000) {',
  '      $down = $false',
  '      foreach ($k in $mods) { if (([Native.Vp]::GetAsyncKeyState($k) -band 0x8000) -ne 0) { $down = $true; break } }',
  '      if (-not $down) { break }',
  '      Start-Sleep -Milliseconds 15',
  '      $waited += 15',
  '    }',
  '    Start-Sleep -Milliseconds 25', // let the target process the key-ups first
  '    $w.SendKeys("^v")',
  '    [Console]::Out.WriteLine("ok $waited")',
  '    [Console]::Out.Flush()',
  '  }',
  '}',
].join('; ');

const HELPER_ACK_TIMEOUT_MS = 1_500;
const MODIFIER_WAIT_MAX_MS = 2_000;

let helper: ChildProcess | null = null;
let helperReady: Promise<void> | null = null;

function disposeHelper(): void {
  if (helper) {
    try {
      helper.removeAllListeners();
      helper.kill();
    } catch { /* already gone */ }
  }
  helper = null;
  helperReady = null;
}

function ensureHelper(): Promise<void> {
  if (helper && helperReady) {
    return helperReady;
  }
  const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', HELPER_SCRIPT], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });
  helper = proc;
  proc.on('exit', () => {
    if (helper === proc) disposeHelper();
  });
  proc.on('error', () => {
    if (helper === proc) disposeHelper();
  });

  helperReady = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Paste helper did not start')), HELPER_ACK_TIMEOUT_MS);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('ready')) {
        clearTimeout(timer);
        proc.stdout?.off('data', onData);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    proc.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Paste helper exited during startup'));
    });
  });

  return helperReady;
}

/** Resolves with the ms spent waiting for the hotkey's modifiers to be released. */
function pasteViaHelper(): Promise<number> {
  return ensureHelper().then(
    () =>
      new Promise<number>((resolve, reject) => {
        const proc = helper;
        if (!proc?.stdin || !proc.stdout) {
          reject(new Error('Paste helper unavailable'));
          return;
        }
        const timer = setTimeout(() => {
          proc.stdout?.off('data', onData);
          reject(new Error('Paste helper timed out'));
        }, HELPER_ACK_TIMEOUT_MS + MODIFIER_WAIT_MAX_MS);
        const onData = (chunk: Buffer) => {
          const match = /ok (\d+)/.exec(chunk.toString());
          if (match) {
            clearTimeout(timer);
            proc.stdout?.off('data', onData);
            resolve(Number(match[1]));
          }
        };
        proc.stdout.on('data', onData);
        proc.stdin.write('paste\n');
      }),
  );
}

/** One-shot fallback: same modifier wait, but pays the PowerShell startup cost. */
const FALLBACK_SCRIPT = [
  'Add-Type -Name Vp -Namespace Native -MemberDefinition \'[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);\'',
  '$waited = 0',
  'while ($waited -lt 2000) {',
  '  $down = $false',
  '  foreach ($k in @(0x10, 0x11, 0x12, 0x5B, 0x5C)) { if (([Native.Vp]::GetAsyncKeyState($k) -band 0x8000) -ne 0) { $down = $true; break } }',
  '  if (-not $down) { break }',
  '  Start-Sleep -Milliseconds 15',
  '  $waited += 15',
  '}',
  'Start-Sleep -Milliseconds 25',
  '$wshell = New-Object -ComObject WScript.Shell',
  "$wshell.SendKeys('^v')",
].join('; ');

/** Resolves with the ms spent waiting for modifiers, or null when not measured. */
async function triggerPasteKeystroke(): Promise<number | null> {
  if (process.platform === 'darwin') {
    await runCommand('osascript', [
      '-e',
      'tell application "System Events" to keystroke "v" using command down',
    ]);
    return null;
  }
  if (process.platform === 'win32') {
    try {
      return await pasteViaHelper();
    } catch {
      // Helper wedged or killed (antivirus, policy) — fall back to the
      // one-shot spawn so a paste never fails just because of the helper.
      disposeHelper();
      await runCommand('powershell', ['-NoProfile', '-Command', FALLBACK_SCRIPT]);
      return null;
    }
  }

  throw new Error('Paste automation not supported on this platform');
}

/**
 * Only put the user's old clipboard back if our transcript is still on it.
 * If anything else changed the clipboard in the meantime — including the app
 * the user pasted into — restoring would clobber it.
 */
export function shouldRestoreClipboard(currentText: string, pastedText: string, restoreEnabled: boolean): boolean {
  return restoreEnabled && currentText === pastedText;
}

export function shutdownPasteHelper(): void {
  disposeHelper();
}

export async function pasteTranscript(text: string, options: PasteOptions): Promise<number | null> {
  const previousText = clipboard.readText();
  clipboard.writeText(text);

  const modifierWaitMs = await triggerPasteKeystroke();

  if (options.restoreClipboard) {
    setTimeout(() => {
      if (shouldRestoreClipboard(clipboard.readText(), text, true)) {
        clipboard.writeText(previousText);
      }
    }, options.restoreDelayMs);
  }

  return modifierWaitMs;
}
