import { describe, expect, it } from 'vitest';
import { formatHotkeyForDisplay } from '../src/shared/hotkeys';

describe('formatHotkeyForDisplay', () => {
  it('formats macOS hotkeys with Option labels', () => {
    expect(formatHotkeyForDisplay('Command+Alt+R', 'darwin')).toBe('Command+Option+R');
    expect(formatHotkeyForDisplay('CommandOrControl+V', 'darwin')).toBe('Command+V');
  });

  it('formats Windows hotkeys with Ctrl labels', () => {
    expect(formatHotkeyForDisplay('Control+Alt+R', 'win32')).toBe('Ctrl+Alt+R');
    expect(formatHotkeyForDisplay('CommandOrControl+V', 'win32')).toBe('Ctrl+V');
  });
});
