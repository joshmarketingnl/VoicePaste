import { contextBridge, ipcRenderer } from 'electron';

interface WelcomeInfo {
  reason: string;
  platform: string;
  mic: string;
  accessibility: boolean;
  hotkeys: { record: string; paste: string };
}

contextBridge.exposeInMainWorld('voicepaste', {
  beginRecordingSession: () => ipcRenderer.invoke('beginRecordingSession'),
  saveSegment: (payload: {
    sessionId: string;
    index: number;
    arrayBuffer: ArrayBuffer;
    mimeType: string;
  }) => ipcRenderer.invoke('saveSegment', payload),
  notifyRecordingStarted: () => ipcRenderer.send('startRecording'),
  notifyRecordingStopped: (payload: { sessionId: string; segmentPaths: string[]; mimeType: string; peakDb?: number | null }) =>
    ipcRenderer.send('stopRecording', payload),
  notifyRecordingCancelled: (payload: { sessionId: string; segmentPaths: string[] }) =>
    ipcRenderer.send('recordingCancelled', payload),
  notifySegmentReady: (payload: { path: string; index: number; bytes: number }) =>
    ipcRenderer.send('audioSegmentReady', payload),
  notifyRecordingError: (message: string) => ipcRenderer.send('recordingError', message),
  notifyMicError: (payload: { name: string; retried: boolean }) => ipcRenderer.send('micError', payload),
  notifyMicLost: () => ipcRenderer.send('micLost'),
  runStateAction: (id: string) => ipcRenderer.send('runStateAction', id),
  onCommandStart: (callback: () => void) => ipcRenderer.on('commandStart', () => callback()),
  onCommandStop: (callback: () => void) => ipcRenderer.on('commandStop', () => callback()),
  onCommandCancel: (callback: () => void) => ipcRenderer.on('commandCancel', () => callback()),
  hideIndicator: () => ipcRenderer.send('hideIndicator'),
  restartApp: () => ipcRenderer.send('restartApp'),
  getSettings: () =>
    ipcRenderer.invoke('getSettings') as Promise<{
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
    }>,
  saveSettings: (payload: {
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
    }) =>
    ipcRenderer.invoke('saveSettings', payload) as Promise<{
      ok: boolean;
      error?: string;
      settings?: {
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
      };
    }>,
  openLogsFolder: () => ipcRenderer.invoke('openLogsFolder') as Promise<boolean>,
  copyDiagnostics: () => ipcRenderer.invoke('copyDiagnostics') as Promise<boolean>,
  onShowWelcome: (callback: (info: WelcomeInfo) => void) => ipcRenderer.on('showWelcome', (_event, info) => callback(info)),
  getPermissionState: () => ipcRenderer.invoke('getPermissionState') as Promise<{ mic: string; accessibility: boolean }>,
  requestMicAccess: () => ipcRenderer.invoke('requestMicAccess') as Promise<boolean>,
  openPermissionSettings: (which: 'microphone' | 'accessibility') => ipcRenderer.send('openPermissionSettings', which),
  openExternalUrl: (url: string) => ipcRenderer.invoke('openExternalUrl', url) as Promise<boolean>,
  setSettingsExpanded: (isExpanded: boolean) => ipcRenderer.send('setSettingsExpanded', isExpanded),
  setSettingsDeveloperMode: (isDeveloperMode: boolean) =>
    ipcRenderer.send('setSettingsDeveloperMode', isDeveloperMode),
  requestRecordButtonAction: () => ipcRenderer.send('requestRecordButtonAction'),
  copyTranscriptToClipboard: () => ipcRenderer.invoke('copyTranscriptToClipboard') as Promise<boolean>,
  onOpenSettingsPanel: (callback: () => void) => ipcRenderer.on('openSettingsPanel', () => callback()),
  onShowUpdate: (callback: (info: { version: string; downloadUrl: string }) => void) =>
    ipcRenderer.on('showUpdate', (_event, info) => callback(info)),
  setUpdatePanelOpen: (isOpen: boolean) => ipcRenderer.send('setUpdatePanelOpen', isOpen),
  onStateUpdate: (callback: (data: { state: string; message?: string; preview?: string; action?: { label: string; id: string } }) => void) =>
    ipcRenderer.on('stateUpdate', (_event, data) => callback(data)),
  onTranscriptReady: (callback: (data: { text: string; preview: string }) => void) =>
    ipcRenderer.on('transcriptReady', (_event, data) => callback(data)),
  onError: (callback: (data: { message: string }) => void) =>
    ipcRenderer.on('error', (_event, data) => callback(data)),
  onCursorIndicatorUpdate: (
    callback: (data: {
      state: 'recording' | 'transcribing' | 'ready' | 'error';
      sizePx: number;
      style?: 'dot' | 'detailed';
      label?: string;
    }) => void,
  ) => ipcRenderer.on('cursorIndicatorUpdate', (_event, data) => callback(data)),
  notifyCursorIndicatorReady: () => ipcRenderer.send('cursorIndicatorReady'),
});
