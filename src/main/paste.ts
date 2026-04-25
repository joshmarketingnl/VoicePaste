import { clipboard } from 'electron';
import { execFile } from 'child_process';

export interface PasteOptions {
  restoreClipboard: boolean;
  restoreDelayMs: number;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
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
    const command =
      "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('^v')";
    await runCommand('powershell', ['-NoProfile', '-Command', command]);
    return;
  }

  throw new Error('Paste automation not supported on this platform');
}

export async function pasteTranscript(text: string, options: PasteOptions): Promise<void> {
  const previousText = clipboard.readText();
  clipboard.writeText(text);

  await triggerPasteKeystroke();

  if (options.restoreClipboard) {
    setTimeout(() => {
      clipboard.writeText(previousText);
    }, options.restoreDelayMs);
  }
}
