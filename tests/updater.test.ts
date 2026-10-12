import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getVersion: () => '0.0.0' }, shell: { openExternal: () => {} } }));
vi.mock('electron-updater', () => ({ autoUpdater: { on: () => {} } }));
const { macDownloadUrl } = await import('../src/main/updater');

const info = {
  version: '2.4.0',
  files: [
    { url: 'VoicePaste-2.4.0-mac.zip', sha512: 'x', size: 1 },
    { url: 'VoicePaste-2.4.0-arm64-mac.zip', sha512: 'y', size: 1 },
  ],
};

describe('macDownloadUrl', () => {
  it('gives an Apple-silicon Mac the arm64 zip', () => {
    expect(macDownloadUrl(info, 'arm64')).toBe(
      'https://github.com/joshmarketingnl/VoicePaste/releases/download/v2.4.0/VoicePaste-2.4.0-arm64-mac.zip',
    );
  });

  it('gives an Intel Mac the x64 zip', () => {
    expect(macDownloadUrl(info, 'x64')).toBe(
      'https://github.com/joshmarketingnl/VoicePaste/releases/download/v2.4.0/VoicePaste-2.4.0-mac.zip',
    );
  });

  it('falls back to the release page when the feed lists no zip', () => {
    expect(macDownloadUrl({ version: '2.4.0', files: [] }, 'arm64')).toBe(
      'https://github.com/joshmarketingnl/VoicePaste/releases/latest',
    );
  });
});
