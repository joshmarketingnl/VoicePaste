export type AppState = 'idle' | 'recording' | 'transcribing' | 'ready' | 'error';
export type LanguageMode = 'auto' | 'en' | 'nl' | 'es';
export type IndicatorMode = 'showAlways' | 'onlyWhenActive';
export type IndicatorStyle = 'dot' | 'detailed';
export type UiLanguage = 'en' | 'nl';
// 'local'  = app-managed embedded whisper.cpp engine (no external server)
// 'openai' = OpenAI cloud API
// 'custom' = a user-supplied OpenAI-compatible endpoint (config.provider)
export type TranscriptionEngine = 'local' | 'openai' | 'custom';
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
  engine: TranscriptionEngine;
  provider: string;
  model: string;
  developerMode: boolean;
  uiLanguage: UiLanguage;
  languageMode: LanguageMode;
  restoreClipboard: boolean;
  indicator: IndicatorMode;
  indicatorStyle: IndicatorStyle;
  diagnostics: boolean;
  apiKey?: string;
}
