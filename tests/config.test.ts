import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, defaultConfigForPlatform, isLocalProvider, mergeConfig } from '../src/shared/config';

describe('defaultConfigForPlatform', () => {
  it('includes cancelRecording, stopAndTranscribe and showControlWindow hotkey defaults', () => {
    const macConfig = defaultConfigForPlatform('darwin');
    expect(macConfig.hotkeys.cancelRecording).toBe('Command+Option+S');
    expect(macConfig.hotkeys.stopAndTranscribe).toBe('Command+Option+C');
    expect(macConfig.hotkeys.showControlWindow).toBe('Command+Option+M');

    const winConfig = defaultConfigForPlatform('win32');
    expect(winConfig.hotkeys.cancelRecording).toBe('Ctrl+Alt+Shift+S');
    expect(winConfig.hotkeys.stopAndTranscribe).toBe('Ctrl+Alt+Shift+C');
    expect(winConfig.hotkeys.showControlWindow).toBe('Ctrl+Alt+Shift+M');
  });

  it('defaults indicator to showAlways', () => {
    const config = defaultConfigForPlatform('darwin');
    expect(config.indicator).toBe('showAlways');
    expect(config.provider).toBe(DEFAULT_PROVIDER);
    expect(config.model).toBe(DEFAULT_MODEL);
    expect(config.developerMode).toBe(false);
    expect(config.uiLanguage).toBe('en');
  });

  it('defaults indicatorStyle to dot', () => {
    const config = defaultConfigForPlatform('win32');
    expect(config.indicatorStyle).toBe('dot');
  });
});

describe('mergeConfig', () => {
  it('keeps backward compatibility when new hotkeys are missing', () => {
    const config = mergeConfig(
      {
        hotkeys: {
          toggleRecord: 'Command+Option+R',
          pasteTranscript: 'Command+Option+V',
          cancelRecording: 'Command+Option+S',
        },
      },
      'darwin',
    );

    expect(config.hotkeys.stopAndTranscribe).toBe('Command+Option+C');
    expect(config.hotkeys.showControlWindow).toBe('Command+Option+M');
    expect(config.provider).toBe(DEFAULT_PROVIDER);
    expect(config.model).toBe(DEFAULT_MODEL);
    expect(config.developerMode).toBe(false);
    expect(config.uiLanguage).toBe('en');
  });

  it('falls back to the dot indicator style for missing or invalid values', () => {
    expect(mergeConfig({}, 'win32').indicatorStyle).toBe('dot');
    expect(mergeConfig({ indicatorStyle: 'nonsense' as never }, 'win32').indicatorStyle).toBe('dot');
    expect(mergeConfig({ indicatorStyle: 'detailed' }, 'win32').indicatorStyle).toBe('detailed');
  });
});

describe('isLocalProvider', () => {
  it('detects loopback transcription providers', () => {
    expect(isLocalProvider('http://localhost:8000/v1')).toBe(true);
    expect(isLocalProvider('http://127.0.0.1:8000/v1')).toBe(true);
    expect(isLocalProvider('http://[::1]:8000/v1')).toBe(true);
  });

  it('rejects remote or invalid providers', () => {
    expect(isLocalProvider(DEFAULT_PROVIDER)).toBe(false);
    expect(isLocalProvider('https://example.com/v1')).toBe(false);
    expect(isLocalProvider('not a url')).toBe(false);
  });
});
