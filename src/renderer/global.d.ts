export {};

interface VoicepasteStateUpdate {
  state: string;
  message?: string;
  preview?: string;
}

interface CursorIndicatorUpdate {
  state: 'recording' | 'transcribing' | 'ready' | 'error';
  sizePx: number;
}

interface VoicepasteSettings {
  developerMode: boolean;
  uiLanguage: 'en' | 'nl';
  providerCode: string;
  modelCode: string;
  apiKey: string;
  hotkeys: {
    toggleRecord: string;
    pasteTranscript: string;
    cancelRecording: string;
    stopAndTranscribe: string;
    showControlWindow: string;
  };
}

interface SaveVoicepasteSettingsResponse {
  ok: boolean;
  error?: string;
  settings?: VoicepasteSettings;
}

interface VoicepasteAPI {
  beginRecordingSession: () => Promise<string>;
  saveSegment: (payload: {
    sessionId: string;
    index: number;
    arrayBuffer: ArrayBuffer;
    mimeType: string;
  }) => Promise<string>;
  notifyRecordingStarted: () => void;
  notifyRecordingStopped: (payload: { sessionId: string; segmentPaths: string[]; mimeType: string }) => void;
  notifyRecordingCancelled: (payload: { sessionId: string; segmentPaths: string[] }) => void;
  notifySegmentReady: (payload: { path: string; index: number; bytes: number }) => void;
  notifyRecordingError: (message: string) => void;
  onCommandStart: (callback: () => void) => void;
  onCommandStop: (callback: () => void) => void;
  onCommandCancel: (callback: () => void) => void;
  hideIndicator: () => void;
  restartApp: () => void;
  getSettings: () => Promise<VoicepasteSettings>;
  saveSettings: (payload: VoicepasteSettings) => Promise<SaveVoicepasteSettingsResponse>;
  openLogsFolder: () => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<boolean>;
  setSettingsExpanded: (isExpanded: boolean) => void;
  setSettingsDeveloperMode: (isDeveloperMode: boolean) => void;
  requestRecordButtonAction: () => void;
  copyTranscriptToClipboard: () => Promise<boolean>;
  onOpenSettingsPanel: (callback: () => void) => void;
  onStateUpdate: (callback: (data: VoicepasteStateUpdate) => void) => void;
  onTranscriptReady: (callback: (data: { text: string; preview: string }) => void) => void;
  onError: (callback: (data: { message: string }) => void) => void;
  onCursorIndicatorUpdate: (callback: (data: CursorIndicatorUpdate) => void) => void;
  notifyCursorIndicatorReady: () => void;
}

declare global {
  interface Window {
    voicepaste: VoicepasteAPI;
  }
}
