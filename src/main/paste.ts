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
  '$w = New-Object -ComObject WScript.Shell',
  '[Console]::Out.WriteLine("ready")',
  '[Console]::Out.Flush()',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($null -eq $line) { break }',
  '  if ($line -eq "paste") {',
  '    $w.SendKeys("^v")',
  '    [Console]::Out.WriteLine("ok")',
  '    [Console]::Out.Flush()',
  '  }',
  '}',
].join('; ');

const HELPER_ACK_TIMEOUT_MS = 1_500;

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

function pasteViaHelper(): Promise<void> {
  return ensureHelper().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const proc = helper;
        if (!proc?.stdin || !proc.stdout) {
          reject(new Error('Paste helper unavailable'));
          return;
        }
        const timer = setTimeout(() => {
          proc.stdout?.off('data', onData);
          reject(new Error('Paste helper timed out'));
        }, HELPER_ACK_TIMEOUT_MS);
        const onData = (chunk: Buffer) => {
          if (chunk.toString().includes('ok')) {
            clearTimeout(timer);
            proc.stdout?.off('data', onData);
            resolve();
          }
        };
        proc.stdout.on('data', onData);
        proc.stdin.write('paste\n');
      }),
  );
}

async function triggerPasteKeystroke(): Promise<void> {
  if (process.platform === 'darwin') {
    await runCommand('osascript', [
      '-e',
      'tell application "System Events" to keystroke "v" using command down',
    ]);
    return;
  }
  if (process.platform === 'win32') {
    try {
      await pasteViaHelper();
    } catch {
      // Helper wedged or killed (antivirus, policy) — fall back to the
      // one-shot spawn so a paste never fails just because of the helper.
      disposeHelper();
      await runCommand('powershell', [
        '-NoProfile',
        '-Command',
        "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('^v')",
      ]);
    }
    return;
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

export async function pasteTranscript(text: string, options: PasteOptions): Promise<void> {
  const previousText = clipboard.readText();
  clipboard.writeText(text);

  await triggerPasteKeystroke();

  if (options.restoreClipboard) {
    setTimeout(() => {
      if (shouldRestoreClipboard(clipboard.readText(), text, true)) {
        clipboard.writeText(previousText);
      }
    }, options.restoreDelayMs);
  }
}
