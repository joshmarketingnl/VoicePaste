import { shouldRotateSegment, RotationPolicy } from '../shared/chunking';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, defaultConfigForPlatform } from '../shared/config';
import { formatHotkeyForDisplay } from '../shared/hotkeys';
import type { HotkeyId, HotkeysConfig } from '../shared/types';

const MAX_SEGMENT_BYTES = 20 * 1024 * 1024;
const MAX_SEGMENT_MS = 90 * 1000;
const TIMESLICE_MS = 1000;
const TRANSCRIBING_RECORD_REENABLE_MS = 550;

const MODIFIER_KEY_ORDER = ['Command', 'Control', 'Alt', 'Shift'] as const;
const MODIFIER_KEYS = new Set<string>(MODIFIER_KEY_ORDER);

type SettingsHotkeyKey = HotkeyId;
type UiLanguage = 'en' | 'nl';
type StatusTone = 'neutral' | 'error' | 'success';

interface RendererSettings {
  developerMode: boolean;
  uiLanguage: UiLanguage;
  providerCode: string;
  modelCode: string;
  apiKey: string;
  hotkeys: HotkeysConfig;
}

const rotationPolicy: RotationPolicy = {
  maxBytes: MAX_SEGMENT_BYTES,
  maxMs: MAX_SEGMENT_MS,
};

const stateText = document.getElementById('stateText') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const timerText = document.getElementById('timerText') as HTMLElement;
const previewText = document.getElementById('previewText') as HTMLElement;
const spinner = document.getElementById('spinner') as HTMLElement;
const container = document.getElementById('container') as HTMLElement;
const hideButton = document.getElementById('hideButton') as HTMLButtonElement;
const restartButton = document.getElementById('restartButton') as HTMLButtonElement;
const settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
const recordActionButton = document.getElementById('recordActionButton') as HTMLButtonElement;
const copyButton = document.getElementById('copyButton') as HTMLButtonElement;

const settingsPanel = document.getElementById('settingsPanel') as HTMLElement;
const settingsTitleText = document.getElementById('settingsTitleText') as HTMLElement;
const closeSettingsButton = document.getElementById('closeSettingsButton') as HTMLButtonElement;
const languageNlButton = document.getElementById('languageNlButton') as HTMLButtonElement;
const languageEnButton = document.getElementById('languageEnButton') as HTMLButtonElement;
const developerModeLabel = document.getElementById('developerModeLabel') as HTMLElement;
const developerModeInput = document.getElementById('developerModeInput') as HTMLInputElement;
const developerProviderField = document.getElementById('developerProviderField') as HTMLElement;
const developerModelField = document.getElementById('developerModelField') as HTMLElement;
const providerCodeLabel = document.getElementById('providerCodeLabel') as HTMLElement;
const modelCodeLabel = document.getElementById('modelCodeLabel') as HTMLElement;
const providerCodeInput = document.getElementById('providerCodeInput') as HTMLInputElement;
const modelCodeInput = document.getElementById('modelCodeInput') as HTMLInputElement;
const apiKeyLabel = document.getElementById('apiKeyLabel') as HTMLElement;
const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
const apiKeyHelpButton = document.getElementById('apiKeyHelpButton') as HTMLButtonElement;
const recordHotkeyLabel = document.getElementById('recordHotkeyLabel') as HTMLElement;
const pasteHotkeyLabel = document.getElementById('pasteHotkeyLabel') as HTMLElement;
const cancelHotkeyLabel = document.getElementById('cancelHotkeyLabel') as HTMLElement;
const stopAndTranscribeHotkeyLabel = document.getElementById('stopAndTranscribeHotkeyLabel') as HTMLElement;
const showControlWindowHotkeyLabel = document.getElementById('showControlWindowHotkeyLabel') as HTMLElement;
const toggleHotkeyValue = document.getElementById('toggleHotkeyValue') as HTMLElement;
const pasteHotkeyValue = document.getElementById('pasteHotkeyValue') as HTMLElement;
const cancelHotkeyValue = document.getElementById('cancelHotkeyValue') as HTMLElement;
const stopAndTranscribeHotkeyValue = document.getElementById('stopAndTranscribeHotkeyValue') as HTMLElement;
const showControlWindowHotkeyValue = document.getElementById('showControlWindowHotkeyValue') as HTMLElement;
const resetToggleHotkeyButton = document.getElementById('resetToggleHotkeyButton') as HTMLButtonElement;
const resetPasteHotkeyButton = document.getElementById('resetPasteHotkeyButton') as HTMLButtonElement;
const resetCancelHotkeyButton = document.getElementById('resetCancelHotkeyButton') as HTMLButtonElement;
const resetStopAndTranscribeHotkeyButton = document.getElementById(
  'resetStopAndTranscribeHotkeyButton',
) as HTMLButtonElement;
const resetShowControlWindowHotkeyButton = document.getElementById(
  'resetShowControlWindowHotkeyButton',
) as HTMLButtonElement;
const captureToggleHotkeyButton = document.getElementById('captureToggleHotkeyButton') as HTMLButtonElement;
const capturePasteHotkeyButton = document.getElementById('capturePasteHotkeyButton') as HTMLButtonElement;
const captureCancelHotkeyButton = document.getElementById('captureCancelHotkeyButton') as HTMLButtonElement;
const captureStopAndTranscribeHotkeyButton = document.getElementById(
  'captureStopAndTranscribeHotkeyButton',
) as HTMLButtonElement;
const captureShowControlWindowHotkeyButton = document.getElementById(
  'captureShowControlWindowHotkeyButton',
) as HTMLButtonElement;
const resetProviderCodeButton = document.getElementById('resetProviderCodeButton') as HTMLButtonElement;
const resetModelCodeButton = document.getElementById('resetModelCodeButton') as HTMLButtonElement;
const settingsCaptureHint = document.getElementById('settingsCaptureHint') as HTMLElement;
const settingsStatusText = document.getElementById('settingsStatusText') as HTMLElement;
const developerToolsRow = document.getElementById('developerToolsRow') as HTMLElement;
const openLogsButton = document.getElementById('openLogsButton') as HTMLButtonElement;
const cancelSettingsButton = document.getElementById('cancelSettingsButton') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('saveSettingsButton') as HTMLButtonElement;
const recordActionLabel = document.getElementById('recordActionLabel') as HTMLElement;
const copyActionLabel = document.getElementById('copyActionLabel') as HTMLElement;

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let sessionId: string | null = null;
let mimeType = 'audio/webm';
let segmentIndex = 0;
let segmentChunks: Blob[] = [];
let segmentBytes = 0;
let segmentStartAt = 0;
let segmentPaths: string[] = [];
let recordingStartedAt = 0;
let timerInterval: number | null = null;
let flushQueue: Promise<void> = Promise.resolve();
let isStopping = false;
let isRotating = false;
let isCancelling = false;
let currentAppState = 'idle';
let lastTranscriptText: string | null = null;
let transcribingRecordCooldownUntil = 0;
let transcribingRecordCooldownTimer: number | null = null;
let lastStateMessageRaw = 'Idle';

let isSettingsOpen = false;
let isSettingsBusy = false;
let settingsLoaded = false;
let captureTarget: SettingsHotkeyKey | null = null;
let captureActiveKeys = new Set<string>();
let captureLastCombo = '';
let captureHasNonModifier = false;
let capturePendingCombo: string | null = null;

const isMacPlatform = window.navigator.platform.toLowerCase().includes('mac');
const hotkeyDisplayPlatform = isMacPlatform ? 'darwin' : 'win32';
const SETTINGS_HOTKEY_KEYS: SettingsHotkeyKey[] = [
  'toggleRecord',
  'pasteTranscript',
  'cancelRecording',
  'stopAndTranscribe',
  'showControlWindow',
];
const PLATFORM_DEFAULT_HOTKEYS = defaultConfigForPlatform(hotkeyDisplayPlatform).hotkeys;

let settingsDraft: RendererSettings = {
  developerMode: false,
  uiLanguage: 'en',
  providerCode: DEFAULT_PROVIDER,
  modelCode: DEFAULT_MODEL,
  apiKey: '',
  hotkeys: { ...PLATFORM_DEFAULT_HOTKEYS },
};
let settingsCommitted: RendererSettings = {
  developerMode: false,
  uiLanguage: 'en',
  providerCode: DEFAULT_PROVIDER,
  modelCode: DEFAULT_MODEL,
  apiKey: '',
  hotkeys: { ...PLATFORM_DEFAULT_HOTKEYS },
};

const hotkeyLabelElements: Record<SettingsHotkeyKey, HTMLElement> = {
  toggleRecord: recordHotkeyLabel,
  pasteTranscript: pasteHotkeyLabel,
  cancelRecording: cancelHotkeyLabel,
  stopAndTranscribe: stopAndTranscribeHotkeyLabel,
  showControlWindow: showControlWindowHotkeyLabel,
};

const hotkeyValueElements: Record<SettingsHotkeyKey, HTMLElement> = {
  toggleRecord: toggleHotkeyValue,
  pasteTranscript: pasteHotkeyValue,
  cancelRecording: cancelHotkeyValue,
  stopAndTranscribe: stopAndTranscribeHotkeyValue,
  showControlWindow: showControlWindowHotkeyValue,
};

const hotkeyResetButtons: Record<SettingsHotkeyKey, HTMLButtonElement> = {
  toggleRecord: resetToggleHotkeyButton,
  pasteTranscript: resetPasteHotkeyButton,
  cancelRecording: resetCancelHotkeyButton,
  stopAndTranscribe: resetStopAndTranscribeHotkeyButton,
  showControlWindow: resetShowControlWindowHotkeyButton,
};

const hotkeyCaptureButtons: Record<SettingsHotkeyKey, HTMLButtonElement> = {
  toggleRecord: captureToggleHotkeyButton,
  pasteTranscript: capturePasteHotkeyButton,
  cancelRecording: captureCancelHotkeyButton,
  stopAndTranscribe: captureStopAndTranscribeHotkeyButton,
  showControlWindow: captureShowControlWindowHotkeyButton,
};

const OPENAI_API_HELP_URL = 'https://joshmarketing.nl';

const UI_TEXT: Record<
  UiLanguage,
  {
    settingsTitle: string;
    developerMode: string;
    providerCode: string;
    modelCode: string;
    openAiApiKey: string;
    apiKey: string;
    recordHotkey: string;
    pasteHotkey: string;
    cancelHotkey: string;
    stopAndTranscribeHotkey: string;
    showControlWindowHotkey: string;
    setButton: string;
    resetButton: string;
    resetRecordHotkey: string;
    resetPasteHotkey: string;
    resetCancelHotkey: string;
    resetStopAndTranscribeHotkey: string;
    resetShowControlWindowHotkey: string;
    resetProviderCode: string;
    resetModelCode: string;
    openLogs: string;
    cancel: string;
    save: string;
    record: string;
    copy: string;
    loadingSettings: string;
    settingsSaved: string;
    hotkeyCaptured: string;
    hotkeyCaptureHint: string;
    hotkeyInvalid: string;
    changesDiscarded: string;
    logsOpenFailed: string;
    logsOpenSuccess: string;
    helpOpenFailed: string;
    languageChangedHint: string;
    valueResetHint: string;
    idleHint: string;
    capturedPrefix: string;
  }
> = {
  en: {
    settingsTitle: 'Settings',
    developerMode: 'Developer mode',
    providerCode: 'Provider code',
    modelCode: 'Model code',
    openAiApiKey: 'OpenAI API key',
    apiKey: 'API key',
    recordHotkey: 'Record hotkey',
    pasteHotkey: 'Paste hotkey',
    cancelHotkey: 'Cancel hotkey',
    stopAndTranscribeHotkey: 'Stop + transcribe hotkey',
    showControlWindowHotkey: 'Show window hotkey',
    setButton: 'Set',
    resetButton: 'Reset',
    resetRecordHotkey: 'Reset record hotkey',
    resetPasteHotkey: 'Reset paste hotkey',
    resetCancelHotkey: 'Reset cancel hotkey',
    resetStopAndTranscribeHotkey: 'Reset stop and transcribe hotkey',
    resetShowControlWindowHotkey: 'Reset show window hotkey',
    resetProviderCode: 'Reset provider code',
    resetModelCode: 'Reset model code',
    openLogs: 'Open Logs',
    cancel: 'Cancel',
    save: 'Save',
    record: 'Record',
    copy: 'Copy',
    loadingSettings: 'Loading settings...',
    settingsSaved: 'Settings saved.',
    hotkeyCaptured: 'Hotkey captured. Click Save to apply.',
    hotkeyCaptureHint: 'Press your hotkey. It saves after all keys are released.',
    hotkeyInvalid: 'Hotkey must include at least one non-modifier key.',
    changesDiscarded: 'Changes discarded.',
    logsOpenFailed: 'Could not open logs folder.',
    logsOpenSuccess: 'Logs folder opened.',
    helpOpenFailed: 'Could not open help link.',
    languageChangedHint: 'Language changed. Click Save to apply permanently.',
    valueResetHint: 'Default restored. Click Save to apply.',
    idleHint: 'Ready to record. Check shortcuts in Settings.',
    capturedPrefix: 'Captured',
  },
  nl: {
    settingsTitle: 'Instellingen',
    developerMode: 'Ontwikkelaarsmodus',
    providerCode: 'Provider-code',
    modelCode: 'Model-code',
    openAiApiKey: 'OpenAI API-sleutel',
    apiKey: 'API-sleutel',
    recordHotkey: 'Opname-hotkey',
    pasteHotkey: 'Plak-hotkey',
    cancelHotkey: 'Annuleer-hotkey',
    stopAndTranscribeHotkey: 'Stop + transcribeer-hotkey',
    showControlWindowHotkey: 'Toon venster-hotkey',
    setButton: 'Instellen',
    resetButton: 'Reset',
    resetRecordHotkey: 'Reset opname-hotkey',
    resetPasteHotkey: 'Reset plak-hotkey',
    resetCancelHotkey: 'Reset annuleer-hotkey',
    resetStopAndTranscribeHotkey: 'Reset stop en transcribeer-hotkey',
    resetShowControlWindowHotkey: 'Reset toon venster-hotkey',
    resetProviderCode: 'Reset provider-code',
    resetModelCode: 'Reset model-code',
    openLogs: 'Logs openen',
    cancel: 'Annuleren',
    save: 'Opslaan',
    record: 'Opnemen',
    copy: 'Kopieren',
    loadingSettings: 'Instellingen laden...',
    settingsSaved: 'Instellingen opgeslagen.',
    hotkeyCaptured: 'Hotkey vastgelegd. Klik op Opslaan om toe te passen.',
    hotkeyCaptureHint: 'Druk je hotkey in. Opslaan gebeurt als alle toetsen los zijn.',
    hotkeyInvalid: 'Hotkey moet minimaal een niet-modifier toets bevatten.',
    changesDiscarded: 'Wijzigingen ongedaan gemaakt.',
    logsOpenFailed: 'Kon de logs-map niet openen.',
    logsOpenSuccess: 'Logs-map geopend.',
    helpOpenFailed: 'Kon de hulplink niet openen.',
    languageChangedHint: 'Taal gewijzigd. Klik op Opslaan om dit vast te zetten.',
    valueResetHint: 'Standaardwaarde hersteld. Klik op Opslaan om toe te passen.',
    idleHint: 'Klaar om op te nemen. Bekijk shortcuts in de instellingen.',
    capturedPrefix: 'Vastgelegd',
  },
};

const STATE_LABELS: Record<UiLanguage, Record<string, string>> = {
  en: {
    idle: 'Idle',
    recording: 'Recording',
    transcribing: 'Transcribing',
    ready: 'Ready',
    error: 'Error',
  },
  nl: {
    idle: 'Klaar',
    recording: 'Opnemen',
    transcribing: 'Transcriberen',
    ready: 'Klaar',
    error: 'Fout',
  },
};

const STATUS_TRANSLATIONS_NL: Record<string, string> = {
  Idle: 'Klaar',
  'Recording...': 'Opnemen...',
  'Transcribing...': 'Transcriberen...',
  'Ready to paste': 'Klaar om te plakken',
  'Recording cancelled': 'Opname geannuleerd',
  'Missing OPENAI_API_KEY.': 'OPENAI_API_KEY ontbreekt.',
  'No audio captured.': 'Geen audio opgenomen.',
  'Transcription failed.': 'Transcriptie mislukt.',
  'Nothing to paste yet.': 'Nog niets om te plakken.',
  'Failed to register global hotkeys.': 'Registratie van globale sneltoetsen is mislukt.',
};

function cloneSettings(settings: RendererSettings): RendererSettings {
  return {
    developerMode: settings.developerMode,
    uiLanguage: settings.uiLanguage,
    providerCode: settings.providerCode,
    modelCode: settings.modelCode,
    apiKey: settings.apiKey,
    hotkeys: { ...settings.hotkeys },
  };
}

function clearTranscribingRecordCooldownTimer() {
  if (transcribingRecordCooldownTimer) {
    window.clearTimeout(transcribingRecordCooldownTimer);
    transcribingRecordCooldownTimer = null;
  }
}

function beginTranscribingRecordCooldown() {
  clearTranscribingRecordCooldownTimer();
  transcribingRecordCooldownUntil = Date.now() + TRANSCRIBING_RECORD_REENABLE_MS;
  transcribingRecordCooldownTimer = window.setTimeout(() => {
    transcribingRecordCooldownTimer = null;
    updateActionButtons();
  }, TRANSCRIBING_RECORD_REENABLE_MS + 20);
}

function isRecordButtonTemporarilyDisabled(): boolean {
  return currentAppState === 'transcribing' && Date.now() < transcribingRecordCooldownUntil;
}

function getUiText() {
  return UI_TEXT[settingsDraft.uiLanguage];
}

function translateStateLabel(state: string): string {
  const labels = STATE_LABELS[settingsDraft.uiLanguage];
  return labels[state] ?? (state.charAt(0).toUpperCase() + state.slice(1));
}

function translateStateMessage(message?: string): string {
  if (!message) {
    return '';
  }
  if (message === 'Idle') {
    return getUiText().idleHint;
  }
  if (settingsDraft.uiLanguage !== 'nl') {
    return message;
  }
  return STATUS_TRANSLATIONS_NL[message] ?? message;
}

function updateLanguageSwitchButtons() {
  languageNlButton.classList.toggle('is-active', settingsDraft.uiLanguage === 'nl');
  languageEnButton.classList.toggle('is-active', settingsDraft.uiLanguage === 'en');
}

function syncDeveloperModeView() {
  const uiText = getUiText();
  const isDeveloperMode = settingsDraft.developerMode;
  developerModeInput.checked = isDeveloperMode;
  developerProviderField.hidden = !isDeveloperMode;
  developerModelField.hidden = !isDeveloperMode;
  developerToolsRow.hidden = false;

  providerCodeInput.disabled = isSettingsBusy || !isDeveloperMode;
  modelCodeInput.disabled = isSettingsBusy || !isDeveloperMode;
  resetProviderCodeButton.disabled = isSettingsBusy || !isDeveloperMode;
  resetModelCodeButton.disabled = isSettingsBusy || !isDeveloperMode;
  openLogsButton.disabled = isSettingsBusy;

  apiKeyLabel.textContent = isDeveloperMode ? uiText.apiKey : uiText.openAiApiKey;
  apiKeyInput.placeholder = isDeveloperMode ? uiText.apiKey : 'sk-...';
  apiKeyHelpButton.hidden = isDeveloperMode;
  apiKeyHelpButton.disabled = isDeveloperMode;

  if (isSettingsOpen) {
    window.voicepaste.setSettingsDeveloperMode(isDeveloperMode);
  }
}

function applyLocalizedLabels() {
  const uiText = getUiText();
  settingsTitleText.textContent = uiText.settingsTitle;
  developerModeLabel.textContent = uiText.developerMode;
  providerCodeLabel.textContent = uiText.providerCode;
  modelCodeLabel.textContent = uiText.modelCode;
  providerCodeInput.placeholder = uiText.providerCode;
  modelCodeInput.placeholder = uiText.modelCode;
  resetProviderCodeButton.title = uiText.resetButton;
  resetModelCodeButton.title = uiText.resetButton;
  resetProviderCodeButton.setAttribute('aria-label', uiText.resetProviderCode);
  resetModelCodeButton.setAttribute('aria-label', uiText.resetModelCode);

  const hotkeyTextByKey: Record<
    SettingsHotkeyKey,
    {
      label: string;
      resetLabel: string;
    }
  > = {
    toggleRecord: {
      label: uiText.recordHotkey,
      resetLabel: uiText.resetRecordHotkey,
    },
    pasteTranscript: {
      label: uiText.pasteHotkey,
      resetLabel: uiText.resetPasteHotkey,
    },
    cancelRecording: {
      label: uiText.cancelHotkey,
      resetLabel: uiText.resetCancelHotkey,
    },
    stopAndTranscribe: {
      label: uiText.stopAndTranscribeHotkey,
      resetLabel: uiText.resetStopAndTranscribeHotkey,
    },
    showControlWindow: {
      label: uiText.showControlWindowHotkey,
      resetLabel: uiText.resetShowControlWindowHotkey,
    },
  };

  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    hotkeyLabelElements[hotkeyKey].textContent = hotkeyTextByKey[hotkeyKey].label;
    hotkeyCaptureButtons[hotkeyKey].textContent = uiText.setButton;
    hotkeyResetButtons[hotkeyKey].title = uiText.resetButton;
    hotkeyResetButtons[hotkeyKey].setAttribute('aria-label', hotkeyTextByKey[hotkeyKey].resetLabel);
  }

  openLogsButton.textContent = uiText.openLogs;
  cancelSettingsButton.textContent = uiText.cancel;
  saveSettingsButton.textContent = uiText.save;
  recordActionLabel.textContent = uiText.record;
  copyActionLabel.textContent = uiText.copy;
  stateText.textContent = translateStateLabel(currentAppState);
  statusText.textContent = translateStateMessage(lastStateMessageRaw);
  updateLanguageSwitchButtons();
  syncDeveloperModeView();
}

function syncSettingsDraftFromInputs() {
  settingsDraft = {
    ...settingsDraft,
    developerMode: developerModeInput.checked,
    providerCode: providerCodeInput.value,
    modelCode: modelCodeInput.value,
    apiKey: apiKeyInput.value,
  };
}

function updateActionButtons() {
  const recordMode = currentAppState === 'recording' || isRecordButtonTemporarilyDisabled() ? 'stop' : 'play';
  recordActionButton.dataset.mode = recordMode;
  recordActionButton.disabled = isRecordButtonTemporarilyDisabled();

  const canCopy = currentAppState === 'ready' && Boolean(lastTranscriptText);
  copyButton.disabled = !canCopy;
}

function setStateView(state: string, message?: string, preview?: string) {
  const previousState = currentAppState;
  currentAppState = state;
  lastStateMessageRaw = message ?? '';

  if (state === 'transcribing') {
    if (previousState !== 'transcribing') {
      beginTranscribingRecordCooldown();
    }
  } else {
    transcribingRecordCooldownUntil = 0;
    clearTranscribingRecordCooldownTimer();
  }

  container.dataset.state = state;
  stateText.textContent = translateStateLabel(state);
  statusText.textContent = translateStateMessage(message);
  previewText.textContent = preview ?? '';

  const showSpinner = state === 'transcribing';
  spinner.style.display = showSpinner ? 'inline-block' : 'none';

  const showTimer = state === 'recording';
  timerText.style.display = showTimer ? 'inline-block' : 'none';
  updateActionButtons();
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startTimer() {
  recordingStartedAt = Date.now();
  timerText.textContent = '00:00';
  if (timerInterval) {
    window.clearInterval(timerInterval);
  }
  timerInterval = window.setInterval(() => {
    timerText.textContent = formatTimer(Date.now() - recordingStartedAt);
  }, 500);
}

function stopTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function chooseMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const option of options) {
    if (MediaRecorder.isTypeSupported(option)) {
      return option;
    }
  }
  return '';
}

function resetSegmentBuffers() {
  segmentChunks = [];
  segmentBytes = 0;
  segmentStartAt = Date.now();
}

async function flushSegment(chunks: Blob[], bytes: number, index: number) {
  if (!sessionId || !chunks.length) {
    return;
  }
  const blob = new Blob(chunks, { type: mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const path = await window.voicepaste.saveSegment({
    sessionId,
    index,
    arrayBuffer,
    mimeType,
  });
  segmentPaths.push(path);
  window.voicepaste.notifySegmentReady({ path, index, bytes });
}

function queueFlush() {
  const chunks = segmentChunks;
  const bytes = segmentBytes;
  const index = segmentIndex;
  segmentIndex += 1;
  resetSegmentBuffers();
  flushQueue = flushQueue.then(() => flushSegment(chunks, bytes, index));
}

async function handleDataAvailable(event: BlobEvent) {
  if (!event.data || event.data.size === 0) {
    return;
  }
  if (isCancelling) {
    return;
  }
  segmentChunks.push(event.data);
  segmentBytes += event.data.size;
  const elapsed = Date.now() - segmentStartAt;
  if (shouldRotateSegment(segmentBytes, elapsed, rotationPolicy)) {
    requestRotation();
  }
}

async function finalizeRecording() {
  if (isCancelling) {
    segmentChunks = [];
    segmentBytes = 0;
    await flushQueue;
    return;
  }
  if (segmentChunks.length) {
    queueFlush();
  }
  await flushQueue;
}

function setupRecorder(stream: MediaStream): MediaRecorder {
  const chosenType = chooseMimeType();
  const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
  mimeType = recorder.mimeType || 'audio/webm';

  recorder.ondataavailable = (event) => {
    void handleDataAvailable(event);
  };

  recorder.onerror = () => {
    window.voicepaste.notifyRecordingError('Recording failed.');
  };

  recorder.onstop = async () => {
    await finalizeRecording();

    const cancelled = isCancelling;
    isCancelling = false;

    if (isRotating && !isStopping && mediaStream) {
      isRotating = false;
      resetSegmentBuffers();
      const nextRecorder = setupRecorder(mediaStream);
      mediaRecorder = nextRecorder;
      nextRecorder.start(TIMESLICE_MS);
      return;
    }

    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
    stopTimer();
    if (sessionId) {
      if (cancelled) {
        window.voicepaste.notifyRecordingCancelled({
          sessionId,
          segmentPaths,
        });
      } else {
        window.voicepaste.notifyRecordingStopped({
          sessionId,
          segmentPaths,
          mimeType,
        });
      }
    }
    sessionId = null;
    isStopping = false;
  };

  return recorder;
}

function requestRotation() {
  if (!mediaRecorder || isRotating || isStopping || isCancelling) {
    return;
  }
  isRotating = true;
  mediaRecorder.requestData();
  mediaRecorder.stop();
}

async function startRecording() {
  if (mediaRecorder) {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = stream;
    sessionId = await window.voicepaste.beginRecordingSession();
    segmentIndex = 0;
    segmentPaths = [];
    resetSegmentBuffers();
    flushQueue = Promise.resolve();
    isStopping = false;
    isRotating = false;
    isCancelling = false;
    lastTranscriptText = null;
    updateActionButtons();
    const recorder = setupRecorder(stream);
    mediaRecorder = recorder;
    recorder.start(TIMESLICE_MS);
    startTimer();
    window.voicepaste.notifyRecordingStarted();
  } catch {
    window.voicepaste.notifyRecordingError('Microphone access failed.');
    mediaRecorder = null;
    mediaStream = null;
    stopTimer();
  }
}

function stopRecording() {
  if (!mediaRecorder) {
    return;
  }
  isStopping = true;
  mediaRecorder.requestData();
  mediaRecorder.stop();
}

function cancelRecording() {
  if (!mediaRecorder) {
    return;
  }
  isCancelling = true;
  isStopping = true;
  mediaRecorder.requestData();
  mediaRecorder.stop();
}

function formatHotkeyForUi(hotkey: string): string {
  return formatHotkeyForDisplay(hotkey, hotkeyDisplayPlatform);
}

function resetHotkeyToDefault(target: SettingsHotkeyKey) {
  cancelHotkeyCapture();
  settingsDraft.hotkeys[target] = PLATFORM_DEFAULT_HOTKEYS[target];
  applySettingsToView(settingsDraft);
  setSettingsStatus(getUiText().valueResetHint);
}

function resetSettingFieldToDefault(target: 'providerCode' | 'modelCode') {
  cancelHotkeyCapture();
  settingsDraft[target] = target === 'providerCode' ? DEFAULT_PROVIDER : DEFAULT_MODEL;
  applySettingsToView(settingsDraft);
  setSettingsStatus(getUiText().valueResetHint);
}

function setSettingsStatus(message: string, tone: StatusTone = 'neutral') {
  settingsStatusText.textContent = message;
  if (tone === 'neutral') {
    delete settingsStatusText.dataset.tone;
    return;
  }
  settingsStatusText.dataset.tone = tone;
}

function resetCaptureState() {
  captureActiveKeys = new Set<string>();
  captureLastCombo = '';
  captureHasNonModifier = false;
  capturePendingCombo = null;
  captureTarget = null;
}

function updateCaptureButtons() {
  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    hotkeyCaptureButtons[hotkeyKey].classList.toggle('is-capturing', captureTarget === hotkeyKey);
  }
}

function applySettingsToView(settings: RendererSettings) {
  settingsDraft = cloneSettings(settings);
  developerModeInput.checked = settingsDraft.developerMode;
  providerCodeInput.value = settingsDraft.providerCode;
  modelCodeInput.value = settingsDraft.modelCode;
  apiKeyInput.value = settingsDraft.apiKey;
  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    hotkeyValueElements[hotkeyKey].textContent = formatHotkeyForUi(settingsDraft.hotkeys[hotkeyKey]);
  }
  applyLocalizedLabels();
}

function commitSettings(settings: RendererSettings) {
  settingsCommitted = cloneSettings(settings);
  applySettingsToView(settingsCommitted);
}

function setSettingsBusy(isBusy: boolean) {
  isSettingsBusy = isBusy;
  saveSettingsButton.disabled = isBusy;
  cancelSettingsButton.disabled = isBusy;
  openLogsButton.disabled = isBusy;
  languageNlButton.disabled = isBusy;
  languageEnButton.disabled = isBusy;
  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    hotkeyResetButtons[hotkeyKey].disabled = isBusy;
    hotkeyCaptureButtons[hotkeyKey].disabled = isBusy;
  }
  developerModeInput.disabled = isBusy;
  apiKeyInput.disabled = isBusy;
  syncDeveloperModeView();
}

async function loadSettingsIfNeeded() {
  if (settingsLoaded) {
    return;
  }
  setSettingsStatus(getUiText().loadingSettings);
  const settings = await window.voicepaste.getSettings();
  commitSettings(settings);
  settingsLoaded = true;
  setSettingsStatus('');
}

function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

function keyCodeToAccelerator(code: string): string | null {
  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  if (/^F\d{1,2}$/i.test(code)) {
    return code.toUpperCase();
  }

  const mapping: Record<string, string> = {
    Numpad0: 'num0',
    Numpad1: 'num1',
    Numpad2: 'num2',
    Numpad3: 'num3',
    Numpad4: 'num4',
    Numpad5: 'num5',
    Numpad6: 'num6',
    Numpad7: 'num7',
    Numpad8: 'num8',
    Numpad9: 'num9',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    NumpadDecimal: 'numdec',
    NumpadEnter: 'Enter',
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Escape: 'Escape',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
  };

  return mapping[code] ?? null;
}

function getAcceleratorFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (event.key === 'Meta') {
    return 'Command';
  }
  if (event.key === 'Control') {
    return 'Control';
  }
  if (event.key === 'Alt') {
    return 'Alt';
  }
  if (event.key === 'Shift') {
    return 'Shift';
  }
  return keyCodeToAccelerator(event.code);
}

function formatCapturedHotkey(keys: Set<string>): string {
  const modifiers = MODIFIER_KEY_ORDER.filter((modifier) => keys.has(modifier));
  const nonModifiers = Array.from(keys)
    .filter((key) => !isModifierKey(key))
    .sort((left, right) => left.localeCompare(right));
  return [...modifiers, ...nonModifiers].join('+');
}

function formatCapturedHotkeyFromEvent(event: KeyboardEvent, key: string): string {
  const keys = new Set<string>();

  if (event.metaKey || key === 'Command') {
    keys.add('Command');
  }
  if (event.ctrlKey || key === 'Control') {
    keys.add('Control');
  }
  if (event.altKey || key === 'Alt') {
    keys.add('Alt');
  }
  if (event.shiftKey || key === 'Shift') {
    keys.add('Shift');
  }
  if (!isModifierKey(key)) {
    keys.add(key);
  }

  return formatCapturedHotkey(keys);
}

async function saveSettingsFromUi(successMessage: string): Promise<boolean> {
  syncSettingsDraftFromInputs();
  setSettingsBusy(true);
  const payload: RendererSettings = {
    developerMode: settingsDraft.developerMode,
    uiLanguage: settingsDraft.uiLanguage,
    providerCode: settingsDraft.providerCode,
    modelCode: settingsDraft.modelCode,
    apiKey: apiKeyInput.value,
    hotkeys: { ...settingsDraft.hotkeys },
  };

  try {
    const result = await window.voicepaste.saveSettings(payload);
    if (!result.ok) {
      setSettingsStatus(result.error ?? 'Failed to save settings.', 'error');
      return false;
    }

    if (result.settings) {
      commitSettings(result.settings);
    } else {
      commitSettings(payload);
    }
    setSettingsStatus(successMessage, 'success');
    return true;
  } finally {
    setSettingsBusy(false);
    updateCaptureButtons();
  }
}

async function finalizeHotkeyCapture() {
  const target = captureTarget;
  const captured = capturePendingCombo ?? captureLastCombo;
  const hasNonModifier = captureHasNonModifier;

  resetCaptureState();
  updateCaptureButtons();

  if (!target) {
    settingsCaptureHint.textContent = '';
    return;
  }

  if (!captured || !hasNonModifier) {
    settingsCaptureHint.textContent = '';
    setSettingsStatus(getUiText().hotkeyInvalid, 'error');
    return;
  }

  settingsDraft.hotkeys[target] = captured;
  applySettingsToView(settingsDraft);
  settingsCaptureHint.textContent = '';
  setSettingsStatus(getUiText().hotkeyCaptured, 'neutral');
}

function beginHotkeyCapture(target: SettingsHotkeyKey) {
  if (isSettingsBusy) {
    return;
  }

  resetCaptureState();
  captureTarget = target;
  updateCaptureButtons();
  settingsCaptureHint.textContent = getUiText().hotkeyCaptureHint;
  setSettingsStatus('');
}

function cancelHotkeyCapture() {
  if (!captureTarget) {
    return;
  }
  resetCaptureState();
  updateCaptureButtons();
  settingsCaptureHint.textContent = '';
}

function revertSettingsDraft() {
  cancelHotkeyCapture();
  commitSettings(settingsCommitted);
  setSettingsStatus(getUiText().changesDiscarded);
}

function onCaptureKeyDown(event: KeyboardEvent) {
  if (!isSettingsOpen || !captureTarget) {
    return;
  }

  const key = getAcceleratorFromKeyboardEvent(event);
  if (!key) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.repeat && captureActiveKeys.has(key)) {
    return;
  }

  captureActiveKeys.add(key);
  captureLastCombo = formatCapturedHotkeyFromEvent(event, key);

  if (!isModifierKey(key)) {
    captureHasNonModifier = true;
    capturePendingCombo = captureLastCombo;
    settingsDraft.hotkeys[captureTarget] = captureLastCombo;
    applySettingsToView(settingsDraft);
  }

  settingsCaptureHint.textContent = `${getUiText().capturedPrefix}: ${formatHotkeyForUi(captureLastCombo)}`;
}

function onCaptureKeyUp(event: KeyboardEvent) {
  if (!isSettingsOpen || !captureTarget) {
    return;
  }

  const key = getAcceleratorFromKeyboardEvent(event);
  if (!key) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  captureActiveKeys.delete(key);
  const noModifiersPressed = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  if (captureActiveKeys.size === 0 && noModifiersPressed) {
    void finalizeHotkeyCapture();
  }
}

async function openSettingsPanel() {
  if (isSettingsOpen) {
    return;
  }
  isSettingsOpen = true;
  settingsPanel.hidden = false;
  window.voicepaste.setSettingsExpanded(true);
  await loadSettingsIfNeeded();
  setSettingsStatus('');
}

function closeSettingsPanel() {
  if (!isSettingsOpen) {
    return;
  }
  cancelHotkeyCapture();
  isSettingsOpen = false;
  settingsPanel.hidden = true;
  window.voicepaste.setSettingsExpanded(false);
}

window.voicepaste.onCommandStart(() => {
  void startRecording();
});

window.voicepaste.onCommandStop(() => {
  stopRecording();
});

window.voicepaste.onCommandCancel(() => {
  cancelRecording();
});

window.voicepaste.onOpenSettingsPanel(() => {
  void openSettingsPanel();
});

window.voicepaste.onStateUpdate((data: { state: string; message?: string; preview?: string }) => {
  setStateView(data.state, data.message, data.preview);
  if (data.state !== 'recording') {
    stopTimer();
  }
});

window.voicepaste.onTranscriptReady((data: { text: string; preview: string }) => {
  lastTranscriptText = data.text;
  updateActionButtons();
});

window.voicepaste.onError((data: { message: string }) => {
  setStateView('error', data.message);
  stopTimer();
});

hideButton.addEventListener('click', () => {
  window.voicepaste.hideIndicator();
});

restartButton.addEventListener('click', () => {
  window.voicepaste.restartApp();
});

settingsButton.addEventListener('click', () => {
  void openSettingsPanel();
});

closeSettingsButton.addEventListener('click', () => {
  closeSettingsPanel();
});

recordActionButton.addEventListener('click', () => {
  if (recordActionButton.disabled) {
    return;
  }
  window.voicepaste.requestRecordButtonAction();
});

copyButton.addEventListener('click', async () => {
  if (copyButton.disabled) {
    return;
  }
  await window.voicepaste.copyTranscriptToClipboard();
});

for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
  hotkeyCaptureButtons[hotkeyKey].addEventListener('click', () => {
    beginHotkeyCapture(hotkeyKey);
  });

  hotkeyResetButtons[hotkeyKey].addEventListener('click', () => {
    if (isSettingsBusy) {
      return;
    }
    resetHotkeyToDefault(hotkeyKey);
  });
}

resetProviderCodeButton.addEventListener('click', () => {
  if (isSettingsBusy || !settingsDraft.developerMode) {
    return;
  }
  resetSettingFieldToDefault('providerCode');
});

resetModelCodeButton.addEventListener('click', () => {
  if (isSettingsBusy || !settingsDraft.developerMode) {
    return;
  }
  resetSettingFieldToDefault('modelCode');
});

developerModeInput.addEventListener('change', () => {
  settingsDraft.developerMode = developerModeInput.checked;
  applySettingsToView(settingsDraft);
});

providerCodeInput.addEventListener('input', () => {
  settingsDraft.providerCode = providerCodeInput.value;
});

modelCodeInput.addEventListener('input', () => {
  settingsDraft.modelCode = modelCodeInput.value;
});

apiKeyInput.addEventListener('input', () => {
  settingsDraft.apiKey = apiKeyInput.value;
});

languageNlButton.addEventListener('click', () => {
  settingsDraft.uiLanguage = 'nl';
  applyLocalizedLabels();
  setSettingsStatus(getUiText().languageChangedHint);
});

languageEnButton.addEventListener('click', () => {
  settingsDraft.uiLanguage = 'en';
  applyLocalizedLabels();
  setSettingsStatus(getUiText().languageChangedHint);
});

saveSettingsButton.addEventListener('click', async () => {
  if (captureTarget && capturePendingCombo && captureHasNonModifier) {
    settingsDraft.hotkeys[captureTarget] = capturePendingCombo;
    applySettingsToView(settingsDraft);
    cancelHotkeyCapture();
  }
  await saveSettingsFromUi(getUiText().settingsSaved);
});

openLogsButton.addEventListener('click', async () => {
  const opened = await window.voicepaste.openLogsFolder();
  if (!opened) {
    setSettingsStatus(getUiText().logsOpenFailed, 'error');
    return;
  }
  setSettingsStatus(getUiText().logsOpenSuccess, 'success');
});

apiKeyHelpButton.addEventListener('click', async () => {
  const opened = await window.voicepaste.openExternalUrl(OPENAI_API_HELP_URL);
  if (!opened) {
    setSettingsStatus(getUiText().helpOpenFailed, 'error');
  }
});

cancelSettingsButton.addEventListener('click', () => {
  if (isSettingsBusy) {
    return;
  }
  revertSettingsDraft();
});

window.addEventListener('keydown', onCaptureKeyDown, true);
window.addEventListener('keyup', onCaptureKeyUp, true);
window.addEventListener('blur', () => {
  cancelHotkeyCapture();
});

applyLocalizedLabels();
setStateView('idle', 'Idle');
window.voicepaste.setSettingsExpanded(false);
void loadSettingsIfNeeded();
