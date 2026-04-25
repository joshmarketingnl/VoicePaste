export type HotkeyDisplayPlatform = 'darwin' | 'win32';

function formatHotkeyToken(token: string, platform: HotkeyDisplayPlatform): string {
  switch (token.toLowerCase()) {
    case 'alt':
      return platform === 'darwin' ? 'Option' : 'Alt';
    case 'control':
    case 'ctrl':
      return platform === 'win32' ? 'Ctrl' : 'Control';
    case 'commandorcontrol':
    case 'cmdorctrl':
      return platform === 'darwin' ? 'Command' : 'Ctrl';
    case 'command':
    case 'cmd':
      return 'Command';
    case 'super':
      return platform === 'win32' ? 'Win' : 'Super';
    default:
      return token;
  }
}

export function formatHotkeyForDisplay(hotkey: string, platform: HotkeyDisplayPlatform): string {
  if (!hotkey) {
    return '-';
  }

  return hotkey
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => formatHotkeyToken(token, platform))
    .join('+');
}
