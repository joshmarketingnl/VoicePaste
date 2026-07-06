export type CursorIndicatorAlwaysOnTopLevel = 'screen-saver' | 'pop-up-menu';

export function isCursorIndicatorSupportedPlatform(platform: NodeJS.Platform): boolean {
  return platform === 'darwin' || platform === 'win32';
}

export function getCursorIndicatorAlwaysOnTopLevel(_platform: NodeJS.Platform): CursorIndicatorAlwaysOnTopLevel {
  return 'screen-saver';
}

export function shouldUseCursorIndicatorAllWorkspaces(platform: NodeJS.Platform): boolean {
  return platform === 'darwin';
}

export function shouldWatchCursorIndicatorVisibility(platform: NodeJS.Platform): boolean {
  return platform === 'win32';
}

export function shouldUseTransparentCursorIndicatorWindow(_platform: NodeJS.Platform): boolean {
  // Windows included: an opaque window shows up as a black square around the
  // circular indicator. Transparency requires hardware acceleration (which the
  // app never disables) and DWM (always on since Windows 8).
  return true;
}
