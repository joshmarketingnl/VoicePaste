import { describe, expect, it } from 'vitest';
import {
  getCursorIndicatorAlwaysOnTopLevel,
  isCursorIndicatorSupportedPlatform,
  shouldUseCursorIndicatorAllWorkspaces,
  shouldUseTransparentCursorIndicatorWindow,
  shouldWatchCursorIndicatorVisibility,
} from '../src/main/cursorIndicatorPlatform';

describe('cursor indicator platform support', () => {
  it('enables the overlay on macOS and Windows', () => {
    expect(isCursorIndicatorSupportedPlatform('darwin')).toBe(true);
    expect(isCursorIndicatorSupportedPlatform('win32')).toBe(true);
    expect(isCursorIndicatorSupportedPlatform('linux')).toBe(false);
  });

  it('uses the strongest z-order level for overlay visibility', () => {
    expect(getCursorIndicatorAlwaysOnTopLevel('win32')).toBe('screen-saver');
    expect(getCursorIndicatorAlwaysOnTopLevel('darwin')).toBe('screen-saver');
  });

  it('only uses all-workspaces on macOS', () => {
    expect(shouldUseCursorIndicatorAllWorkspaces('darwin')).toBe(true);
    expect(shouldUseCursorIndicatorAllWorkspaces('win32')).toBe(false);
  });

  it('only runs the visibility watchdog on Windows', () => {
    expect(shouldWatchCursorIndicatorVisibility('win32')).toBe(true);
    expect(shouldWatchCursorIndicatorVisibility('darwin')).toBe(false);
  });

  it('uses an opaque Windows window so the indicator remains visible when transparency fails', () => {
    expect(shouldUseTransparentCursorIndicatorWindow('win32')).toBe(false);
    expect(shouldUseTransparentCursorIndicatorWindow('darwin')).toBe(true);
  });
});
