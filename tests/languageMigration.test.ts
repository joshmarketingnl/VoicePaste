import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeConfig } from '../src/shared/config';

// loadConfig reads from Electron's userData dir; point that at a temp dir.
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voicepaste-lang-migration-'));
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }));
const { loadConfig } = await import('../src/main/config');

afterEach(() => {
  for (const name of fs.readdirSync(userDataDir)) {
    fs.rmSync(path.join(userDataDir, name), { recursive: true, force: true });
  }
});

// What a v2.2.x install on the OpenAI cloud looks like on disk (fake key).
const V22_CLOUD_CONFIG = {
  hotkeys: {
    toggleRecord: 'Command+Alt+C',
    pasteTranscript: 'Command+Alt+V',
    cancelRecording: 'Command+Alt+S',
    stopAndTranscribe: 'Control+Alt+Shift+C',
    showControlWindow: 'Control+Alt+Shift+M',
  },
  engine: 'openai',
  provider: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini-transcribe',
  developerMode: false,
  uiLanguage: 'nl',
  languageMode: 'auto',
  restoreClipboard: true,
  indicator: 'showAlways',
  indicatorStyle: 'dot',
  diagnostics: false,
  engineIdleSleepMinutes: 15,
  apiKey: 'sk-test-0000000000000000000000000000',
};

describe('languageMode migration', () => {
  it('moves the legacy auto mode and missing values to nl-en', () => {
    expect(mergeConfig({ languageMode: 'auto' as never }, 'win32').languageMode).toBe('nl-en');
    expect(mergeConfig({}, 'win32').languageMode).toBe('nl-en');
    expect(mergeConfig({ languageMode: 'fr' as never }, 'win32').languageMode).toBe('nl-en');
  });

  it('keeps a deliberately chosen single language', () => {
    expect(mergeConfig({ languageMode: 'nl' }, 'win32').languageMode).toBe('nl');
    expect(mergeConfig({ languageMode: 'en' }, 'win32').languageMode).toBe('en');
    expect(mergeConfig({ languageMode: 'es' }, 'win32').languageMode).toBe('es');
  });

  it('leaves key, engine, model, provider, hotkeys and every other setting untouched', () => {
    const migrated = mergeConfig(V22_CLOUD_CONFIG as never, 'win32');
    const { languageMode, ...rest } = migrated;
    const { languageMode: _old, ...original } = V22_CLOUD_CONFIG;
    expect(languageMode).toBe('nl-en');
    expect(rest).toEqual(original);
  });
});

describe('loadConfig on an existing v2.2.x install', () => {
  it('reads the old file without rewriting it', () => {
    const configPath = path.join(userDataDir, 'config.json');
    const onDisk = `${JSON.stringify(V22_CLOUD_CONFIG, null, 2)}\n`;
    fs.writeFileSync(configPath, onDisk, 'utf8');

    const { config } = loadConfig();

    expect(config.apiKey).toBe(V22_CLOUD_CONFIG.apiKey);
    expect(config.engine).toBe('openai');
    expect(config.hotkeys).toEqual(V22_CLOUD_CONFIG.hotkeys);
    expect(config.languageMode).toBe('nl-en');
    // The upgrade itself must not touch the user's file.
    expect(fs.readFileSync(configPath, 'utf8')).toBe(onDisk);
  });

  it('survives a UTF-8 BOM instead of silently dropping to defaults', () => {
    const configPath = path.join(userDataDir, 'config.json');
    fs.writeFileSync(configPath, `﻿${JSON.stringify(V22_CLOUD_CONFIG)}`, 'utf8');

    const { config } = loadConfig();

    expect(config.apiKey).toBe(V22_CLOUD_CONFIG.apiKey);
    expect(config.hotkeys.toggleRecord).toBe('Command+Alt+C');
  });
});
