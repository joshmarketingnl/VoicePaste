import type { LocalModelChoice } from './engineModel';

export type AppState = 'idle' | 'recording' | 'transcribing' | 'ready' | 'error';
// 'nl-en' = Dutch or English per recording (default); a third language is never
// accepted. 'nl'/'en' force one language. Only Dutch and English are offered;
// the old 'auto' and 'es' are migrated to 'nl-en'.
export type LanguageMode = 'nl-en' | 'nl' | 'en';
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
  /** Minutes of inactivity before the local engine sleeps to free the ~2GB
   *  model memory (0 = keep it loaded forever). Waking adds a few seconds to
   *  the first dictation after a pause. */
  engineIdleSleepMinutes: number;
  /** Local speech model: 'auto' = large on a Mac or with NVIDIA, small otherwise. */
  localModel: LocalModelChoice;
  /** The record key also stops, transcribes and pastes while recording. */
  recordKeyPastes: boolean;
  /** Names and jargon to expect, one per line or comma-separated. */
  vocabulary: string;
  /** Keep the last 10 dictations on this computer (tray menu). */
  keepHistory: boolean;
  /** OpenAI/custom without a connection: transcribe on this computer instead. */
  offlineFallback: boolean;
  apiKey?: string;
}
