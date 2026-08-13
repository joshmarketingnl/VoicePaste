import { describe, expect, it, vi } from 'vitest';

// The clipboard restore decision is the only pure part of the paste path; the
// keystroke itself is OS automation. Electron is stubbed so this stays a unit
// test.
vi.mock('electron', () => ({ clipboard: { readText: () => '', writeText: () => {} } }));

const { shouldRestoreClipboard } = await import('../src/main/paste');

describe('shouldRestoreClipboard', () => {
  it('restores the previous clipboard when our transcript is still on it', () => {
    expect(shouldRestoreClipboard('transcript', 'transcript', true)).toBe(true);
  });

  it('never restores when the user disabled clipboard restore', () => {
    expect(shouldRestoreClipboard('transcript', 'transcript', false)).toBe(false);
  });

  it('leaves the clipboard alone when something else changed it', () => {
    // Copying something else between paste and restore must not be clobbered.
    expect(shouldRestoreClipboard('something the user copied', 'transcript', true)).toBe(false);
  });
});
