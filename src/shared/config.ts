import { AppConfig, IndicatorMode, LanguageMode, UiLanguage } from './types';

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
    toggleRecord: 'Ctrl+Alt+R',
    pasteTranscript: 'Ctrl+Alt+V',
    cancelRecording: 'Ctrl+Alt+S',
    stopAndTranscribe: 'Ctrl+Alt+C',
    showControlWindow: 'Ctrl+Alt+M',
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
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    developerMode: false,
    uiLanguage: 'en',
    languageMode: 'auto',
    restoreClipboard: true,
    indicator: 'showAlways',
    diagnostics: false,
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

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'nl';
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
    provider: typeof input.provider === 'string' && input.provider.trim() ? input.provider.trim() : defaults.provider,
    model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : defaults.model,
    developerMode: typeof input.developerMode === 'boolean' ? input.developerMode : defaults.developerMode,
    uiLanguage: isUiLanguage(input.uiLanguage) ? input.uiLanguage : defaults.uiLanguage,
    languageMode: isLanguageMode(input.languageMode) ? input.languageMode : defaults.languageMode,
    restoreClipboard: typeof input.restoreClipboard === 'boolean' ? input.restoreClipboard : defaults.restoreClipboard,
    indicator: isIndicatorMode(input.indicator) ? input.indicator : defaults.indicator,
    diagnostics: typeof input.diagnostics === 'boolean' ? input.diagnostics : defaults.diagnostics,
    apiKey: typeof input.apiKey === 'string' && input.apiKey.trim() ? input.apiKey.trim() : undefined,
  };
}
