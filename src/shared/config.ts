import { AppConfig, IndicatorMode, IndicatorStyle, LanguageMode, TranscriptionEngine, UiLanguage } from './types';

export const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
export const DEFAULT_PROVIDER = 'https://api.openai.com/v1';
export const LOCAL_TRANSCRIPTION_API_KEY = 'voicepaste-local';

export type PlatformKey = 'darwin' | 'win32' | 'linux' | string;

const DEFAULT_HOTKEYS_BY_PLATFORM: Record<
  string,
  {
    toggleRecord: string;
    pasteTranscript: string;
    cancelRecording: string;
    stopAndTranscribe: string;
    showControlWindow: string;
  }
> = {
  darwin: {
    toggleRecord: 'Command+Option+R',
    pasteTranscript: 'Command+Option+V',
    cancelRecording: 'Command+Option+S',
    stopAndTranscribe: 'Command+Option+C',
    showControlWindow: 'Command+Option+M',
  },
  win32: {
    toggleRecord: 'Ctrl+Alt+Shift+R',
    pasteTranscript: 'Ctrl+Alt+Shift+V',
    cancelRecording: 'Ctrl+Alt+Shift+S',
    stopAndTranscribe: 'Ctrl+Alt+Shift+C',
    showControlWindow: 'Ctrl+Alt+Shift+M',
  },
  linux: {
    toggleRecord: 'Ctrl+Alt+R',
    pasteTranscript: 'Ctrl+Alt+V',
    cancelRecording: 'Ctrl+Alt+S',
    stopAndTranscribe: 'Ctrl+Alt+C',
    showControlWindow: 'Ctrl+Alt+M',
  },
};

export function defaultConfigForPlatform(platform: PlatformKey): AppConfig {
  const hotkeys = DEFAULT_HOTKEYS_BY_PLATFORM[platform] ?? DEFAULT_HOTKEYS_BY_PLATFORM.win32;
  return {
    hotkeys,
    engine: 'local',
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    developerMode: false,
    uiLanguage: 'en',
    languageMode: 'auto',
    restoreClipboard: true,
    indicator: 'showAlways',
    indicatorStyle: 'dot',
    diagnostics: false,
    engineIdleSleepMinutes: 15,
  };
}

export function isLocalProvider(provider: string): boolean {
  try {
    const url = new URL(provider);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

function isLanguageMode(value: unknown): value is LanguageMode {
  return value === 'auto' || value === 'en' || value === 'nl' || value === 'es';
}

function isIndicatorMode(value: unknown): value is IndicatorMode {
  return value === 'showAlways' || value === 'onlyWhenActive';
}

function isIndicatorStyle(value: unknown): value is IndicatorStyle {
  return value === 'dot' || value === 'detailed';
}

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'nl';
}

function isTranscriptionEngine(value: unknown): value is TranscriptionEngine {
  return value === 'local' || value === 'openai' || value === 'custom';
}

/**
 * Pick the engine for a config that predates the `engine` field, so existing
 * installs keep working: an OpenAI provider stays on OpenAI, a localhost
 * provider (the old separate-server setup) moves to the built-in local engine,
 * any other endpoint becomes a custom endpoint. Fresh installs default to local.
 */
function inferEngine(input: Partial<AppConfig>, defaults: AppConfig): TranscriptionEngine {
  if (isTranscriptionEngine(input.engine)) {
    return input.engine;
  }
  const provider = typeof input.provider === 'string' ? input.provider.trim() : '';
  if (!provider) {
    return defaults.engine;
  }
  if (provider === DEFAULT_PROVIDER) {
    return 'openai';
  }
  if (isLocalProvider(provider)) {
    return 'local';
  }
  return 'custom';
}

export function mergeConfig(input: Partial<AppConfig> | null | undefined, platform: PlatformKey): AppConfig {
  const defaults = defaultConfigForPlatform(platform);
  if (!input) {
    return defaults;
  }

  return {
    hotkeys: {
      toggleRecord: input.hotkeys?.toggleRecord ?? defaults.hotkeys.toggleRecord,
      pasteTranscript: input.hotkeys?.pasteTranscript ?? defaults.hotkeys.pasteTranscript,
      cancelRecording: input.hotkeys?.cancelRecording ?? defaults.hotkeys.cancelRecording,
      stopAndTranscribe: input.hotkeys?.stopAndTranscribe ?? defaults.hotkeys.stopAndTranscribe,
      showControlWindow: input.hotkeys?.showControlWindow ?? defaults.hotkeys.showControlWindow,
    },
    engine: inferEngine(input, defaults),
    provider: typeof input.provider === 'string' && input.provider.trim() ? input.provider.trim() : defaults.provider,
    model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : defaults.model,
    developerMode: typeof input.developerMode === 'boolean' ? input.developerMode : defaults.developerMode,
    uiLanguage: isUiLanguage(input.uiLanguage) ? input.uiLanguage : defaults.uiLanguage,
    languageMode: isLanguageMode(input.languageMode) ? input.languageMode : defaults.languageMode,
    restoreClipboard: typeof input.restoreClipboard === 'boolean' ? input.restoreClipboard : defaults.restoreClipboard,
    indicator: isIndicatorMode(input.indicator) ? input.indicator : defaults.indicator,
    indicatorStyle: isIndicatorStyle(input.indicatorStyle) ? input.indicatorStyle : defaults.indicatorStyle,
    diagnostics: typeof input.diagnostics === 'boolean' ? input.diagnostics : defaults.diagnostics,
    engineIdleSleepMinutes:
      typeof input.engineIdleSleepMinutes === 'number' &&
      Number.isFinite(input.engineIdleSleepMinutes) &&
      input.engineIdleSleepMinutes >= 0
        ? Math.min(1440, Math.round(input.engineIdleSleepMinutes))
        : defaults.engineIdleSleepMinutes,
    apiKey: typeof input.apiKey === 'string' && input.apiKey.trim() ? input.apiKey.trim() : undefined,
  };
}
