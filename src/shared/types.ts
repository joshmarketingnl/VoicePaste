export type AppState = 'idle' | 'recording' | 'transcribing' | 'ready' | 'error';
export type LanguageMode = 'auto' | 'en' | 'nl' | 'es';
export type IndicatorMode = 'showAlways' | 'onlyWhenActive';
export type UiLanguage = 'en' | 'nl';
export type HotkeyId = 'toggleRecord' | 'pasteTranscript' | 'cancelRecording' | 'stopAndTranscribe' | 'showControlWindow';

export interface HotkeysConfig {
  toggleRecord: string;
  pasteTranscript: string;
  cancelRecording: string;
  stopAndTranscribe: string;
  showControlWindow: string;
}

export interface AppConfig {
  hotkeys: HotkeysConfig;
  provider: string;
  model: string;
  developerMode: boolean;
  uiLanguage: UiLanguage;
  languageMode: LanguageMode;
  restoreClipboard: boolean;
  indicator: IndicatorMode;
  diagnostics: boolean;
  apiKey?: string;
}
