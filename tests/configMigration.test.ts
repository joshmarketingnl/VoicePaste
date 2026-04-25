import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { getLegacyConfigCandidates, migrateLegacyConfigIfNeeded } from '../src/main/config';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voicepaste-config-migration-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('getLegacyConfigCandidates', () => {
  it('returns v0.4 candidate config paths', () => {
    const userDataPath = '/tmp/voicepaste-v0.5';
    const candidates = getLegacyConfigCandidates(userDataPath);
    expect(candidates).toEqual([
      '/tmp/voicepaste-v0.4/config.json',
      '/tmp/VoicePaste v0.4/config.json',
    ]);
  });
});

describe('migrateLegacyConfigIfNeeded', () => {
  it('copies config from legacy v0.4 path when destination is missing', () => {
    const appDataDir = makeTempDir();
    const userDataPath = path.join(appDataDir, 'voicepaste-v0.5');
    const configPath = path.join(userDataPath, 'config.json');
    const legacyDir = path.join(appDataDir, 'voicepaste-v0.4');
    const legacyConfigPath = path.join(legacyDir, 'config.json');

    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(legacyConfigPath, '{ "apiKey": "test-key" }\n', 'utf8');

    const migratedFrom = migrateLegacyConfigIfNeeded(configPath, userDataPath);
    expect(migratedFrom).toBe(legacyConfigPath);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.readFileSync(configPath, 'utf8')).toContain('"apiKey"');
  });

  it('does not overwrite existing destination config', () => {
    const appDataDir = makeTempDir();
    const userDataPath = path.join(appDataDir, 'voicepaste-v0.5');
    const configPath = path.join(userDataPath, 'config.json');
    const legacyDir = path.join(appDataDir, 'voicepaste-v0.4');
    const legacyConfigPath = path.join(legacyDir, 'config.json');

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '{ "apiKey": "existing" }\n', 'utf8');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(legacyConfigPath, '{ "apiKey": "legacy" }\n', 'utf8');

    const migratedFrom = migrateLegacyConfigIfNeeded(configPath, userDataPath);
    expect(migratedFrom).toBeUndefined();
    expect(fs.readFileSync(configPath, 'utf8')).toContain('"existing"');
  });
});
