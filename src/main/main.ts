import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  globalShortcut,
  ipcMain,
  shell,
  screen,
  clipboard,
  type MenuItemConstructorOptions,
} from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AppConfig, AppState, HotkeyId, HotkeysConfig } from '../shared/types';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, isLocalProvider } from '../shared/config';
import { buildPreview } from '../shared/transcript';
import { Logger } from '../shared/logger';
import { loadConfig, saveConfig } from './config';
import { createLogger } from './logger';
import { StateMachine } from './stateMachine';
import { transcribeSegments } from './transcription';
import { pasteTranscript } from './paste';
import { createTrayIcon } from './trayIcon';
import {
  getCursorIndicatorAlwaysOnTopLevel,
  isCursorIndicatorSupportedPlatform,
  shouldUseCursorIndicatorAllWorkspaces,
  shouldUseTransparentCursorIndicatorWindow,
  shouldWatchCursorIndicatorVisibility,
} from './cursorIndicatorPlatform';
import { evaluateAutoRestart, resolvePasteHotkeyAction } from './failsafe';
import {
  RectLike,
  computeBottomRightWindowBounds,
  computeTopLeftWindowBounds,
  computeTrayAnchoredWindowBounds,
} from './windowBounds';

type CursorIndicatorState = 'recording' | 'transcribing' | 'ready' | 'error';
type CursorPoint = { x: number; y: number };
type StopAndTranscribeSource = 'toggle' | 'secondaryHotkey' | 'pasteFailsafe' | 'uiButton' | 'trayMenu';
type SettingsHotkeyKey = HotkeyId;
type UiLanguage = 'en' | 'nl';

interface SettingsPayload {
  developerMode: boolean;
  uiLanguage: UiLanguage;
  providerCode: string;
  modelCode: string;
  apiKey: string;
  hotkeys: HotkeysConfig;
}

interface SettingsResponse {
  developerMode: boolean;
  uiLanguage: UiLanguage;
  providerCode: string;
  modelCode: string;
  apiKey: string;
  hotkeys: HotkeysConfig;
}

const CONTROL_WINDOW_WIDTH = 380;
const CONTROL_WINDOW_HEIGHT = 200;
const CONTROL_WINDOW_SETTINGS_HEIGHT = 560;
const CONTROL_WINDOW_SETTINGS_DEVELOPER_HEIGHT = 640;
const CONTROL_WINDOW_MARGIN = 16;
const WINDOWS_TRAY_WINDOW_MARGIN = 12;

const CURSOR_INDICATOR_SIZE = 32;
const CURSOR_INDICATOR_WINDOW_PADDING = 4;
const CURSOR_INDICATOR_WINDOW_SIZE = CURSOR_INDICATOR_SIZE + CURSOR_INDICATOR_WINDOW_PADDING * 2;
const CURSOR_INDICATOR_OFFSET_X = 10;
const CURSOR_INDICATOR_OFFSET_Y = 0;
const CURSOR_FOLLOW_INTERVAL_MS = 16;
const CURSOR_FOLLOW_SMOOTHING = 0.45;
const CURSOR_FOLLOW_SNAP_DISTANCE = 1.2;
const CURSOR_FOLLOW_LARGE_JUMP_PX = 72;
const CURSOR_VISIBILITY_WATCHDOG_INTERVAL_MS = 250;
const CURSOR_INDICATOR_MAX_LOCAL_RECOVERY_ATTEMPTS = 1;
const READY_INDICATOR_HIDE_MS = 5_000;
const ERROR_INDICATOR_HIDE_MS = 5_000;
const AUTO_RESTART_DELAY_MS = 1_200;
const AUTO_RESTART_WINDOW_MS = 60_000;
const AUTO_RESTART_MAX_ATTEMPTS = 3;
const TRAY_RETRY_DELAY_MS = 1_500;
const TRAY_MAX_INIT_ATTEMPTS = 2;
const TRAY_TITLE_FALLBACK = 'VP';
const HOTKEY_MODIFIER_PARTS = new Set(['command', 'commandorcontrol', 'control', 'ctrl', 'alt', 'shift', 'super']);
const WINDOWS_LAUNCH_HIDDEN_ARG = '--launch-hidden';
const APP_USER_MODEL_ID = 'com.voicepaste.developerbeta.v11';
const SETTINGS_HOTKEY_KEYS: SettingsHotkeyKey[] = [
  'toggleRecord',
  'pasteTranscript',
  'cancelRecording',
  'stopAndTranscribe',
  'showControlWindow',
];
const SETTINGS_HOTKEY_LABELS: Record<SettingsHotkeyKey, string> = {
  toggleRecord: 'Record hotkey',
  pasteTranscript: 'Paste hotkey',
  cancelRecording: 'Cancel hotkey',
  stopAndTranscribe: 'Stop and transcribe hotkey',
  showControlWindow: 'Show window hotkey',
};

let mainWindow: BrowserWindow | null = null;
let cursorIndicatorWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let config: AppConfig;
let configPath = '';
let logger: Logger;
let stateMachine: StateMachine;
let lastTranscript: string | null = null;
let lastError: string | null = null;
let activeTranscriptionJobs = 0;
let indicatorHiddenByUser = false;
let hasShownOnLaunch = false;
let isQuitting = false;
let settingsWindowExpanded = false;
let settingsWindowDeveloperMode = false;

let cursorFollowInterval: NodeJS.Timeout | null = null;
let cursorRenderPos: CursorPoint | null = null;
let cursorAppliedPos: CursorPoint | null = null;
let cursorVisibilityWatchdog: NodeJS.Timeout | null = null;
let cursorIndicatorState: CursorIndicatorState | null = null;
let cursorIndicatorReady = false;
let cursorIndicatorLocalRecoveryAttempts = 0;
let readyIndicatorTimer: NodeJS.Timeout | null = null;
let errorIndicatorTimer: NodeJS.Timeout | null = null;
let autoRestartTimer: NodeJS.Timeout | null = null;
let autoRestartAttemptTimestamps: number[] = [];
let pasteQueuedAfterTranscription = false;
let trayRetryTimer: NodeJS.Timeout | null = null;
let activeTranscriptionJobId = 0;
const cancelledTranscriptionJobIds = new Set<number>();
const launchHidden = process.argv.includes(WINDOWS_LAUNCH_HIDDEN_ARG);

const sessionDirs = new Map<string, string>();

function getRendererIndexPath(): string {
  return path.join(__dirname, '..', 'renderer', 'index.html');
}

function getCursorIndicatorIndexPath(): string {
  return path.join(__dirname, '..', 'renderer', 'cursor-indicator.html');
}

function isCursorIndicatorSupported(): boolean {
  return isCursorIndicatorSupportedPlatform(process.platform);
}

function normalizeHotkey(input: string): string {
  const mapping: Record<string, string> = {
    ctrl: 'Control',
    control: 'Control',
    cmd: 'Command',
    command: 'Command',
    cmdorctrl: 'CommandOrControl',
    commandorcontrol: 'CommandOrControl',
    option: 'Alt',
    alt: 'Alt',
    shift: 'Shift',
  };

  return input
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      if (mapping[lower]) {
        return mapping[lower];
      }
      return token.length === 1 ? token.toUpperCase() : token;
    })
    .join('+');
}

function splitHotkeyParts(input: string): string[] {
  return normalizeHotkey(input)
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasNonModifierHotkeyPart(input: string): boolean {
  const parts = splitHotkeyParts(input);
  return parts.some((part) => !HOTKEY_MODIFIER_PARTS.has(part.toLowerCase()));
}

function normalizeApiKeyForStorage(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSettingsHotkeys(hotkeys: HotkeysConfig): HotkeysConfig {
  const normalizedHotkeys = {} as HotkeysConfig;
  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    normalizedHotkeys[hotkeyKey] = normalizeHotkey(hotkeys[hotkeyKey]);
  }
  return normalizedHotkeys;
}

function getSettingsResponse(): SettingsResponse {
  return {
    developerMode: config.developerMode,
    uiLanguage: config.uiLanguage,
    providerCode: config.provider,
    modelCode: config.model,
    apiKey: config.apiKey ?? '',
    hotkeys: { ...config.hotkeys },
  };
}

function validateSettingsPayload(payload: SettingsPayload): string | null {
  if (
    !payload ||
    typeof payload.developerMode !== 'boolean' ||
    (payload.uiLanguage !== 'en' && payload.uiLanguage !== 'nl') ||
    typeof payload.providerCode !== 'string' ||
    typeof payload.modelCode !== 'string' ||
    typeof payload.apiKey !== 'string'
  ) {
    return 'Invalid settings payload.';
  }
  if (!payload.hotkeys) {
    return 'Invalid hotkey values.';
  }

  const normalizedHotkeys = {} as HotkeysConfig;

  for (const hotkeyKey of SETTINGS_HOTKEY_KEYS) {
    const hotkeyValue = payload.hotkeys[hotkeyKey];
    if (typeof hotkeyValue !== 'string') {
      return 'Invalid hotkey values.';
    }

    const normalizedHotkey = normalizeHotkey(hotkeyValue);
    if (!hasNonModifierHotkeyPart(normalizedHotkey)) {
      return `${SETTINGS_HOTKEY_LABELS[hotkeyKey]} must include at least one non-modifier key.`;
    }

    normalizedHotkeys[hotkeyKey] = normalizedHotkey;
  }

  if (payload.developerMode) {
    if (!payload.providerCode.trim()) {
      return 'Provider code is required when developer mode is enabled.';
    }
    if (!payload.modelCode.trim()) {
      return 'Model code is required when developer mode is enabled.';
    }
  }

  const normalizedPairs = new Map<string, string>();
  for (const [hotkeyName, hotkeyValue] of Object.entries(normalizedHotkeys)) {
    const normalized = normalizeHotkey(hotkeyValue).toLowerCase();
    const existing = normalizedPairs.get(normalized);
    if (existing) {
      return `Hotkey conflict: ${SETTINGS_HOTKEY_LABELS[hotkeyName as SettingsHotkeyKey]} matches ${SETTINGS_HOTKEY_LABELS[existing as SettingsHotkeyKey]}.`;
    }
    normalizedPairs.set(normalized, hotkeyName);
  }

  return null;
}

function sendStateUpdate(state: AppState, message?: string, preview?: string) {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send('stateUpdate', { state, message, preview });

  if (mainWindow.isVisible()) {
    return;
  }

  if (state === 'ready' && !pasteQueuedAfterTranscription) {
    const body = preview ? `Ready to paste: ${preview}` : message ?? 'Transcript ready to paste.';
    notifyBackgroundStatus('VoicePaste ready', body, 'info');
    return;
  }

  if (state === 'error' && message) {
    notifyBackgroundStatus('VoicePaste error', message, 'error');
  }
}

function sendCursorIndicatorUpdate(state: CursorIndicatorState) {
  if (!cursorIndicatorWindow || !cursorIndicatorReady) {
    return;
  }
  cursorIndicatorWindow.webContents.send('cursorIndicatorUpdate', {
    state,
    sizePx: CURSOR_INDICATOR_SIZE,
  });
}

function markCursorIndicatorRendererReady(reason: string) {
  cursorIndicatorReady = true;
  cursorIndicatorLocalRecoveryAttempts = 0;

  if (!cursorIndicatorState) {
    logger.debug('Cursor indicator renderer ready without active state', { reason });
    return;
  }

  sendCursorIndicatorUpdate(cursorIndicatorState);
  refreshCursorIndicatorWindow(reason);
  startCursorFollowLoop();
  startCursorVisibilityWatchdog();
}

function notifyBackgroundStatus(title: string, body: string, mode: 'info' | 'error') {
  if (mainWindow?.isVisible()) {
    return;
  }

  if (process.platform === 'win32' && tray) {
    tray.displayBalloon({
      title,
      content: body,
      iconType: mode === 'error' ? 'error' : 'info',
      largeIcon: true,
    });
    return;
  }

  if (!Notification.isSupported()) {
    return;
  }

  new Notification({
    title,
    body,
    urgency: mode === 'error' ? 'critical' : 'normal',
    silent: mode !== 'error',
  }).show();
}

function clearReadyIndicatorTimer() {
  if (!readyIndicatorTimer) {
    return;
  }
  clearTimeout(readyIndicatorTimer);
  readyIndicatorTimer = null;
}

function clearErrorIndicatorTimer() {
  if (!errorIndicatorTimer) {
    return;
  }
  clearTimeout(errorIndicatorTimer);
  errorIndicatorTimer = null;
}

function clearAutoRestartTimer() {
  if (!autoRestartTimer) {
    return;
  }
  clearTimeout(autoRestartTimer);
  autoRestartTimer = null;
}

function clearTrayRetryTimer() {
  if (!trayRetryTimer) {
    return;
  }
  clearTimeout(trayRetryTimer);
  trayRetryTimer = null;
}

function clearCursorVisibilityWatchdog() {
  if (!cursorVisibilityWatchdog) {
    return;
  }
  clearInterval(cursorVisibilityWatchdog);
  cursorVisibilityWatchdog = null;
}

function clearQueuedPaste(reason: string) {
  if (!pasteQueuedAfterTranscription) {
    return;
  }
  pasteQueuedAfterTranscription = false;
  logger.debug('Queued paste cleared', { reason });
}

function queuePasteAfterTranscription(reason: string): boolean {
  if (pasteQueuedAfterTranscription) {
    logger.info('Paste hotkey ignored; paste already queued', {
      reason,
      state: stateMachine.getState(),
    });
    return false;
  }
  pasteQueuedAfterTranscription = true;
  logger.info('Paste queued for post-transcription', {
    reason,
    state: stateMachine.getState(),
  });
  return true;
}

function scheduleAutoRestart(reason: string) {
  if (isQuitting) {
    return;
  }

  if (autoRestartTimer) {
    logger.debug('Auto-restart already scheduled', { reason });
    return;
  }

  const now = Date.now();
  const decision = evaluateAutoRestart(autoRestartAttemptTimestamps, now, {
    windowMs: AUTO_RESTART_WINDOW_MS,
    maxAttempts: AUTO_RESTART_MAX_ATTEMPTS,
  });

  autoRestartAttemptTimestamps = decision.attempts;

  if (!decision.allowed) {
    logger.error('Auto-restart suppressed (loop guard)', {
      reason,
      windowMs: AUTO_RESTART_WINDOW_MS,
      maxAttempts: AUTO_RESTART_MAX_ATTEMPTS,
      attemptsInWindow: autoRestartAttemptTimestamps.length,
    });
    return;
  }

  logger.error('Auto-restart scheduled', {
    reason,
    delayMs: AUTO_RESTART_DELAY_MS,
    windowMs: AUTO_RESTART_WINDOW_MS,
    maxAttempts: AUTO_RESTART_MAX_ATTEMPTS,
    attemptsInWindow: autoRestartAttemptTimestamps.length,
  });

  autoRestartTimer = setTimeout(() => {
    autoRestartTimer = null;
    logger.info('Auto-restart executing', { reason });
    app.relaunch();
    app.exit(0);
  }, AUTO_RESTART_DELAY_MS);
}

function getMainWindowSize() {
  if (!mainWindow) {
    return {
      width: CONTROL_WINDOW_WIDTH,
      height: settingsWindowExpanded
        ? settingsWindowDeveloperMode
          ? CONTROL_WINDOW_SETTINGS_DEVELOPER_HEIGHT
          : CONTROL_WINDOW_SETTINGS_HEIGHT
        : CONTROL_WINDOW_HEIGHT,
    };
  }
  const bounds = mainWindow.getBounds();
  return { width: bounds.width, height: bounds.height };
}

function toRectLike(bounds: Electron.Rectangle): RectLike {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function positionMainWindow() {
  if (!mainWindow) {
    return;
  }

  const windowSize = getMainWindowSize();
  const primaryWorkArea = toRectLike(screen.getPrimaryDisplay().workArea);

  const nextBounds =
    process.platform === 'win32'
      ? (() => {
          if (tray) {
            const trayBounds = tray.getBounds();
            if (trayBounds.width > 0 && trayBounds.height > 0) {
              const targetDisplay = screen.getDisplayMatching(trayBounds);
              return computeTrayAnchoredWindowBounds(
                windowSize,
                toRectLike(trayBounds),
                toRectLike(targetDisplay.bounds),
                toRectLike(targetDisplay.workArea),
                WINDOWS_TRAY_WINDOW_MARGIN,
              );
            }
          }
          return computeBottomRightWindowBounds(windowSize, primaryWorkArea, CONTROL_WINDOW_MARGIN);
        })()
      : computeTopLeftWindowBounds(windowSize, primaryWorkArea, CONTROL_WINDOW_MARGIN);

  mainWindow.setBounds(nextBounds, false);
}

function resizeMainWindowForSettings() {
  if (!mainWindow) {
    return;
  }
  const nextHeight = !settingsWindowExpanded
    ? CONTROL_WINDOW_HEIGHT
    : settingsWindowDeveloperMode
      ? CONTROL_WINDOW_SETTINGS_DEVELOPER_HEIGHT
      : CONTROL_WINDOW_SETTINGS_HEIGHT;
  const currentBounds = mainWindow.getBounds();
  if (currentBounds.width === CONTROL_WINDOW_WIDTH && currentBounds.height === nextHeight) {
    return;
  }
  mainWindow.setBounds(
    {
      x: currentBounds.x,
      y: currentBounds.y,
      width: CONTROL_WINDOW_WIDTH,
      height: nextHeight,
    },
    false,
  );
  positionMainWindow();
  const settingsMode = settingsWindowDeveloperMode ? 'developer' : 'standard';
  logger.debug('Control window resized', {
    mode: !settingsWindowExpanded ? 'default' : `settings-${settingsMode}`,
    width: CONTROL_WINDOW_WIDTH,
    height: nextHeight,
  });
}

function handleShowControlWindow(reason: string) {
  if (!mainWindow) {
    if (logger) {
      logger.error('Show control window requested before main window exists', { reason });
    }
    return;
  }
  showIndicator(reason);
}

function showIndicator(reason: string) {
  if (!mainWindow) {
    return;
  }
  indicatorHiddenByUser = false;
  positionMainWindow();
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  updateTrayMenu();
  logger.info('Indicator shown', { reason });
}

function hideIndicator(reason: string) {
  if (!mainWindow) {
    return;
  }
  indicatorHiddenByUser = true;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  }
  updateTrayMenu();
  logger.info('Indicator hidden', { reason });
}

function reassertCursorIndicatorZOrder(reason: string) {
  if (!cursorIndicatorWindow || !isCursorIndicatorSupported()) {
    return;
  }

  cursorIndicatorWindow.setAlwaysOnTop(true, getCursorIndicatorAlwaysOnTopLevel(process.platform));
  if (process.platform === 'win32' && cursorIndicatorWindow.isVisible()) {
    cursorIndicatorWindow.setVisibleOnAllWorkspaces(false);
    cursorIndicatorWindow.moveTop();
  }

  if (reason !== 'watchdog') {
    logger.debug('Cursor indicator z-order reasserted', {
      reason,
      platform: process.platform,
      visible: cursorIndicatorWindow.isVisible(),
    });
  }
}

function ensureCursorIndicatorWindow(reason: string): boolean {
  if (!isCursorIndicatorSupported()) {
    return false;
  }

  if (cursorIndicatorWindow && !cursorIndicatorWindow.isDestroyed()) {
    return true;
  }

  const window = createCursorIndicatorWindow();
  if (!window) {
    logger.error('Failed to create cursor indicator window on demand', { reason });
    return false;
  }

  logger.info('Cursor indicator window created on demand', { reason });
  return true;
}

function recoverCursorIndicatorWindow(reason: string) {
  if (!isCursorIndicatorSupported() || isQuitting) {
    return;
  }

  if (cursorIndicatorLocalRecoveryAttempts >= CURSOR_INDICATOR_MAX_LOCAL_RECOVERY_ATTEMPTS) {
    logger.error('Cursor indicator local recovery exhausted', {
      reason,
      attempts: cursorIndicatorLocalRecoveryAttempts,
      activeState: cursorIndicatorState,
    });
    scheduleAutoRestart(reason);
    return;
  }

  cursorIndicatorLocalRecoveryAttempts += 1;
  logger.error('Attempting local cursor indicator recovery', {
    reason,
    attempt: cursorIndicatorLocalRecoveryAttempts,
    activeState: cursorIndicatorState,
  });

  const previousWindow = cursorIndicatorWindow;
  cursorIndicatorWindow = null;
  cursorIndicatorReady = false;
  stopCursorFollowLoop();
  clearCursorVisibilityWatchdog();

  if (previousWindow && !previousWindow.isDestroyed()) {
    previousWindow.destroy();
  }

  const recreatedWindow = createCursorIndicatorWindow();
  if (!recreatedWindow) {
    scheduleAutoRestart(`${reason}:recreate-failed`);
    return;
  }

  if (!cursorIndicatorState) {
    return;
  }

  tickCursorFollow();
  if (!recreatedWindow.isVisible()) {
    recreatedWindow.showInactive();
  }
  reassertCursorIndicatorZOrder(`${reason}:recreated`);
  startCursorFollowLoop();
  startCursorVisibilityWatchdog();
}

function refreshCursorIndicatorWindow(reason: string) {
  if (!cursorIndicatorWindow || !cursorIndicatorState || !isCursorIndicatorSupported()) {
    return;
  }

  tickCursorFollow();

  if (!cursorIndicatorWindow.isVisible()) {
    cursorIndicatorWindow.showInactive();
    logger.debug('Cursor indicator visibility restored', {
      reason,
      state: cursorIndicatorState,
    });
  }

  reassertCursorIndicatorZOrder(reason);
}

function startCursorVisibilityWatchdog() {
  if (!cursorIndicatorState || cursorVisibilityWatchdog || !shouldWatchCursorIndicatorVisibility(process.platform)) {
    return;
  }

  cursorVisibilityWatchdog = setInterval(() => {
    if (!cursorIndicatorState || !cursorIndicatorWindow || !isCursorIndicatorSupported()) {
      return;
    }
    refreshCursorIndicatorWindow('watchdog');
  }, CURSOR_VISIBILITY_WATCHDOG_INTERVAL_MS);
}

function handleCursorIndicatorDisplayChange(reason: string, metadata?: Record<string, unknown>) {
  if (!cursorIndicatorState || !isCursorIndicatorSupported()) {
    return;
  }

  cursorRenderPos = null;
  cursorAppliedPos = null;
  refreshCursorIndicatorWindow(reason);
  logger.debug('Cursor indicator display change handled', {
    reason,
    state: cursorIndicatorState,
    ...metadata,
  });
}

function handleCursorIndicatorDisplayMetricsChanged(
  _event: Electron.Event,
  display: Electron.Display,
  changedMetrics: string[],
) {
  handleCursorIndicatorDisplayChange('display-metrics-changed', {
    displayId: display.id,
    changedMetrics,
  });
}

function handleCursorIndicatorDisplayAdded(_event: Electron.Event, display: Electron.Display) {
  handleCursorIndicatorDisplayChange('display-added', {
    displayId: display.id,
  });
}

function handleCursorIndicatorDisplayRemoved(_event: Electron.Event, display: Electron.Display) {
  handleCursorIndicatorDisplayChange('display-removed', {
    displayId: display.id,
  });
}

function getClampedIndicatorPosition(point: CursorPoint): CursorPoint | null {
  if (!cursorIndicatorWindow || !isCursorIndicatorSupported()) {
    return null;
  }

  const targetDisplay = screen.getDisplayNearestPoint(point);
  const bounds = targetDisplay.workArea;
  const windowBounds = cursorIndicatorWindow.getBounds();

  const rawX = point.x + CURSOR_INDICATOR_OFFSET_X - CURSOR_INDICATOR_WINDOW_PADDING;
  const rawY = point.y + CURSOR_INDICATOR_OFFSET_Y - CURSOR_INDICATOR_WINDOW_PADDING;

  const maxX = bounds.x + bounds.width - windowBounds.width;
  const maxY = bounds.y + bounds.height - windowBounds.height;

  const x = Math.max(bounds.x, Math.min(rawX, maxX));
  const y = Math.max(bounds.y, Math.min(rawY, maxY));

  return { x, y };
}

function applyIndicatorPosition(point: CursorPoint) {
  if (!cursorIndicatorWindow || !isCursorIndicatorSupported()) {
    return;
  }

  const x = Math.round(point.x);
  const y = Math.round(point.y);

  if (cursorAppliedPos && cursorAppliedPos.x === x && cursorAppliedPos.y === y) {
    return;
  }

  cursorIndicatorWindow.setPosition(x, y, false);
  cursorAppliedPos = { x, y };
}

function tickCursorFollow() {
  if (!cursorIndicatorWindow || !isCursorIndicatorSupported()) {
    return;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const target = getClampedIndicatorPosition(cursorPoint);
  if (!target) {
    return;
  }

  if (!cursorRenderPos) {
    cursorRenderPos = target;
    applyIndicatorPosition(target);
    return;
  }

  const dx = target.x - cursorRenderPos.x;
  const dy = target.y - cursorRenderPos.y;
  const distance = Math.hypot(dx, dy);

  if (distance >= CURSOR_FOLLOW_LARGE_JUMP_PX || distance <= CURSOR_FOLLOW_SNAP_DISTANCE) {
    cursorRenderPos = target;
    applyIndicatorPosition(target);
    return;
  }

  cursorRenderPos = {
    x: cursorRenderPos.x + dx * CURSOR_FOLLOW_SMOOTHING,
    y: cursorRenderPos.y + dy * CURSOR_FOLLOW_SMOOTHING,
  };
  applyIndicatorPosition(cursorRenderPos);
}

function startCursorFollowLoop() {
  if (!isCursorIndicatorSupported() || cursorFollowInterval) {
    return;
  }

  cursorRenderPos = null;
  cursorAppliedPos = null;
  tickCursorFollow();
  cursorFollowInterval = setInterval(() => {
    tickCursorFollow();
  }, CURSOR_FOLLOW_INTERVAL_MS);
}

function stopCursorFollowLoop() {
  if (!cursorFollowInterval) {
    return;
  }
  clearInterval(cursorFollowInterval);
  cursorFollowInterval = null;
  cursorRenderPos = null;
  cursorAppliedPos = null;
}

function showCursorIndicator(state: CursorIndicatorState, reason: string) {
  cursorIndicatorState = state;

  if (!ensureCursorIndicatorWindow(`show:${reason}`)) {
    return;
  }

  sendCursorIndicatorUpdate(state);
  refreshCursorIndicatorWindow(`show:${reason}`);
  if (process.platform === 'win32') {
    setTimeout(() => refreshCursorIndicatorWindow(`show:${reason}:deferred`), 50);
  }
  startCursorFollowLoop();
  startCursorVisibilityWatchdog();
  logger.debug('Cursor indicator shown', { state, reason });
}

function hideCursorIndicator(reason: string) {
  cursorIndicatorState = null;

  if (!cursorIndicatorWindow || !isCursorIndicatorSupported()) {
    clearCursorVisibilityWatchdog();
    stopCursorFollowLoop();
    return;
  }

  if (cursorIndicatorWindow.isVisible()) {
    cursorIndicatorWindow.hide();
  }
  clearCursorVisibilityWatchdog();
  stopCursorFollowLoop();
  logger.debug('Cursor indicator hidden', { reason });
}

function attachProcessErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: String(error) });
    scheduleAutoRestart('uncaught-exception');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
    scheduleAutoRestart('unhandled-rejection');
  });
}

function updateCursorIndicatorForState(state: AppState, reason: string) {
  if (!isCursorIndicatorSupported()) {
    return;
  }

  clearReadyIndicatorTimer();

  switch (state) {
    case 'idle': {
      clearErrorIndicatorTimer();
      hideCursorIndicator(`${reason}:idle`);
      return;
    }
    case 'recording': {
      clearErrorIndicatorTimer();
      showCursorIndicator('recording', `${reason}:recording`);
      return;
    }
    case 'transcribing': {
      clearErrorIndicatorTimer();
      showCursorIndicator('transcribing', `${reason}:transcribing`);
      return;
    }
    case 'ready': {
      clearErrorIndicatorTimer();
      showCursorIndicator('ready', `${reason}:ready`);
      readyIndicatorTimer = setTimeout(() => {
        hideCursorIndicator('ready-timeout');
        logger.info('Cursor ready indicator hidden after timeout', {
          timeoutMs: READY_INDICATOR_HIDE_MS,
        });
      }, READY_INDICATOR_HIDE_MS);
      return;
    }
    case 'error': {
      showCursorIndicator('error', `${reason}:error`);
      clearErrorIndicatorTimer();
      errorIndicatorTimer = setTimeout(() => {
        hideCursorIndicator('error-timeout');
      }, ERROR_INDICATOR_HIDE_MS);
      return;
    }
    default: {
      hideCursorIndicator(`${reason}:unknown`);
    }
  }
}

function updateIndicatorVisibility(state: AppState) {
  if (!mainWindow) {
    return;
  }

  if (!hasShownOnLaunch) {
    hasShownOnLaunch = true;
    if (launchHidden) {
      hideIndicator('launch-hidden');
    } else {
      showIndicator('launch');
    }
    return;
  }

  if (indicatorHiddenByUser) {
    mainWindow.hide();
    return;
  }

  if (config.indicator === 'showAlways') {
    if (!mainWindow.isVisible()) {
      mainWindow.showInactive();
    }
    return;
  }

  if (state === 'idle') {
    mainWindow.hide();
  } else if (!mainWindow.isVisible()) {
    mainWindow.showInactive();
  }
}

function performQuit() {
  isQuitting = true;
  clearQueuedPaste('app-quit');
  clearAutoRestartTimer();
  clearTrayRetryTimer();
  app.quit();
}

function performRestart(reason: string) {
  logger.info('Restart requested', { reason });
  clearQueuedPaste('app-restart');
  clearAutoRestartTimer();
  clearTrayRetryTimer();
  app.relaunch();
  app.exit(0);
}

async function openLogsFolder(reason: string): Promise<boolean> {
  const logDir = path.join(app.getPath('userData'), 'logs');
  const result = await shell.openPath(logDir);
  if (result) {
    logger.error('Failed to open logs folder', { result, logDir, reason });
    return false;
  }
  logger.info('Logs folder opened', { logDir, reason });
  return true;
}

function requestOpenSettingsPanel(reason: string) {
  if (!mainWindow) {
    logger.error('Open settings requested before main window exists', { reason });
    return;
  }

  showIndicator(reason);
  const sendOpenSettings = () => {
    mainWindow?.webContents.send('openSettingsPanel');
    logger.info('Settings panel requested', { reason });
  };

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', () => {
      sendOpenSettings();
    });
    return;
  }

  sendOpenSettings();
}

function requestStartRecordingFromShell(reason: string) {
  if (!mainWindow) {
    logger.error('Start recording requested before main window exists', { reason });
    return;
  }

  mainWindow.webContents.send('commandStart');
  logger.info('Recording start requested', { reason, state: stateMachine.getState() });
}

function toggleIndicatorFromTray() {
  if (!mainWindow) {
    logger.error('Tray toggle requested before main window exists');
    return;
  }

  if (mainWindow.isVisible()) {
    hideIndicator('tray-toggle');
    return;
  }

  handleShowControlWindow('tray-toggle');
}

function getTrayPrimaryAction(): MenuItemConstructorOptions {
  const state = stateMachine.getState();

  if (state === 'recording') {
    return {
      label: 'Stop And Transcribe',
      click: () => {
        handleStopAndTranscribe('trayMenu');
      },
    };
  }

  if (state === 'transcribing') {
    return {
      label: 'Transcribing...',
      enabled: false,
    };
  }

  return {
    label: 'Start Recording',
    click: () => {
      requestStartRecordingFromShell('tray-menu');
    },
  };
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: mainWindow?.isVisible() ? 'Hide VoicePaste' : 'Show VoicePaste',
      click: () => {
        toggleIndicatorFromTray();
      },
    },
    getTrayPrimaryAction(),
  ];

  if (stateMachine.getState() === 'recording') {
    menuTemplate.push({
      label: 'Cancel Recording',
      click: () => {
        handleCancelRecording();
      },
    });
  }

  menuTemplate.push(
    {
      label: 'Paste Last Transcript',
      enabled: Boolean(lastTranscript),
      click: () => {
        void handlePaste();
      },
    },
    {
      label: 'Settings',
      click: () => {
        requestOpenSettingsPanel('tray-menu-settings');
      },
    },
    {
      label: 'Open Logs',
      click: () => {
        void openLogsFolder('tray-menu');
      },
    },
    { type: 'separator' },
    {
      label: 'Restart VoicePaste',
      click: () => performRestart('tray-menu'),
    },
    { label: 'Quit VoicePaste', click: () => performQuit() },
  );

  const menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
}

function createIndicatorWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: CONTROL_WINDOW_WIDTH,
    height: CONTROL_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  positionMainWindow();

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideIndicator('window-close');
  });

  mainWindow.loadFile(getRendererIndexPath()).catch((error) => {
    logger.error('Failed to load indicator window', { error: String(error) });
    scheduleAutoRestart('indicator-window-load-failed');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    sendStateUpdate(stateMachine.getState(), stateMachine.getState() === 'idle' ? 'Idle' : undefined);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Indicator renderer process gone', {
      reason: details.reason,
      exitCode: details.exitCode,
    });
    scheduleAutoRestart('indicator-render-process-gone');
  });
}

function createCursorIndicatorWindow(): BrowserWindow | null {
  if (!isCursorIndicatorSupported()) {
    return null;
  }

  const preloadPath = path.join(__dirname, 'preload.js');
  const useTransparentWindow = shouldUseTransparentCursorIndicatorWindow(process.platform);
  const window = new BrowserWindow({
    width: CURSOR_INDICATOR_WINDOW_SIZE,
    height: CURSOR_INDICATOR_WINDOW_SIZE,
    frame: false,
    transparent: useTransparentWindow,
    backgroundColor: useTransparentWindow ? '#00000000' : '#050607',
    hasShadow: false,
    resizable: false,
    focusable: process.platform === 'win32',
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    fullscreenable: false,
    thickFrame: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  cursorIndicatorWindow = window;
  cursorIndicatorReady = false;

  window.setIgnoreMouseEvents(true, { forward: true });
  window.setSkipTaskbar(true);
  if (shouldUseCursorIndicatorAllWorkspaces(process.platform)) {
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
  }
  window.setAlwaysOnTop(true, getCursorIndicatorAlwaysOnTopLevel(process.platform));
  window.setOpacity(1);

  window.loadFile(getCursorIndicatorIndexPath()).catch((error) => {
    if (cursorIndicatorWindow !== window) {
      return;
    }
    logger.error('Failed to load cursor indicator window', { error: String(error) });
    recoverCursorIndicatorWindow('cursor-indicator-window-load-failed');
  });

  window.webContents.on('did-finish-load', () => {
    if (cursorIndicatorWindow !== window) {
      return;
    }

    markCursorIndicatorRendererReady('did-finish-load');
  });

  window.on('closed', () => {
    if (cursorIndicatorWindow !== window) {
      return;
    }
    clearCursorVisibilityWatchdog();
    stopCursorFollowLoop();
    cursorIndicatorReady = false;
    cursorIndicatorWindow = null;
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    if (cursorIndicatorWindow !== window) {
      return;
    }
    logger.error('Cursor indicator renderer process gone', {
      reason: details.reason,
      exitCode: details.exitCode,
    });
    recoverCursorIndicatorWindow('cursor-indicator-render-process-gone');
  });

  return window;
}

function handleToggleRecording() {
  const state = stateMachine.getState();
  if (state === 'recording') {
    handleStopAndTranscribe('toggle');
    return;
  }
  if (state === 'transcribing') {
    logger.info('Recording toggle ignored while transcribing');
    return;
  }
  mainWindow?.webContents.send('commandStart');
}

function handleCancelRecording() {
  const state = stateMachine.getState();
  if (state !== 'recording') {
    logger.info('Cancel ignored; not recording');
    return;
  }
  mainWindow?.webContents.send('commandCancel');
}

function handleStopAndTranscribe(source: StopAndTranscribeSource): boolean {
  const state = stateMachine.getState();
  if (state !== 'recording') {
    logger.info('Stop+transcribe ignored; not recording', { source, state });
    return false;
  }
  mainWindow?.webContents.send('commandStop');
  logger.info('Stop+transcribe requested', { source });
  return true;
}

function interruptTranscriptionAndStartRecording(reason: string): boolean {
  const state = stateMachine.getState();
  if (state !== 'transcribing') {
    logger.info('Interrupt transcription ignored; not transcribing', { state, reason });
    return false;
  }

  cancelledTranscriptionJobIds.add(activeTranscriptionJobId);
  clearQueuedPaste('transcription-interrupted-by-ui');
  stateMachine.transition('recording', 'Transcription interrupted by record button');
  sendStateUpdate('recording', 'Recording...');
  mainWindow?.webContents.send('commandStart');
  logger.info('Transcription interrupted; starting new recording', {
    reason,
    transcriptionJobId: activeTranscriptionJobId,
    activeTranscriptionJobs,
  });
  return true;
}

function handleRecordButtonActionFromUi() {
  const state = stateMachine.getState();
  if (state === 'recording') {
    handleStopAndTranscribe('uiButton');
    return;
  }
  if (state === 'transcribing') {
    interruptTranscriptionAndStartRecording('ui-record-button');
    return;
  }
  mainWindow?.webContents.send('commandStart');
  logger.info('Record button requested start', { state });
}

function handlePasteHotkey() {
  const state = stateMachine.getState();
  const action = resolvePasteHotkeyAction(state, pasteQueuedAfterTranscription);

  switch (action) {
    case 'queue-stop-transcribe': {
      queuePasteAfterTranscription('hotkey-while-recording');
      logger.info('Paste hotkey rerouted to stop+transcribe (failsafe)', { state });
      handleStopAndTranscribe('pasteFailsafe');
      return;
    }
    case 'queue-after-transcribe': {
      queuePasteAfterTranscription('hotkey-while-transcribing');
      return;
    }
    case 'ignore-duplicate-queue': {
      logger.info('Paste hotkey ignored; duplicate queue request', { state });
      return;
    }
    case 'paste-now':
    default: {
      void handlePaste();
      return;
    }
  }
}

async function handlePaste() {
  if (!lastTranscript) {
    stateMachine.transition('error', 'Paste requested with no transcript');
    lastError = 'Nothing to paste yet.';
    sendStateUpdate('error', lastError);
    scheduleAutoRestart('paste-requested-without-transcript');
    return;
  }

  try {
    await pasteTranscript(lastTranscript, { restoreClipboard: config.restoreClipboard, restoreDelayMs: 800 });
    logger.info('Paste triggered');

    if (stateMachine.getState() === 'ready') {
      clearReadyIndicatorTimer();
      hideCursorIndicator('paste-hotkey');
    }
  } catch (error) {
    const errorText = String(error);
    const fallback = process.platform === 'darwin' ? 'Copied; press Cmd+V manually.' : 'Copied; press Ctrl+V manually.';
    const permissionHint =
      process.platform === 'darwin' && errorText.includes('not allowed to send keystrokes')
        ? 'Enable Accessibility and Automation permissions for VoicePaste.'
        : 'Check permissions for simulated paste.';
    const message = `Paste failed. ${permissionHint} ${fallback}`;
    lastError = message;
    stateMachine.transition('error', 'Paste failed');
    logger.error('Paste failed', { error: String(error) });
    sendStateUpdate('error', message);
    scheduleAutoRestart('paste-failed');
  }
}

interface HotkeyRegistrationResult {
  allOk: boolean;
  toggleOk: boolean;
  pasteOk: boolean;
  cancelOk: boolean;
  stopAndTranscribeOk: boolean;
  showControlWindowOk: boolean;
  toggleKey: string;
  pasteKey: string;
  cancelKey: string;
  stopAndTranscribeKey: string;
  showControlWindowKey: string;
}

function registerHotkeysForConfig(targetConfig: AppConfig): HotkeyRegistrationResult {
  const toggleKey = normalizeHotkey(targetConfig.hotkeys.toggleRecord);
  const pasteKey = normalizeHotkey(targetConfig.hotkeys.pasteTranscript);
  const cancelKey = normalizeHotkey(targetConfig.hotkeys.cancelRecording);
  const stopAndTranscribeKey = normalizeHotkey(targetConfig.hotkeys.stopAndTranscribe);
  const showControlWindowKey = normalizeHotkey(targetConfig.hotkeys.showControlWindow);

  const toggleOk = globalShortcut.register(toggleKey, handleToggleRecording);
  const pasteOk = globalShortcut.register(pasteKey, handlePasteHotkey);
  const cancelOk = globalShortcut.register(cancelKey, handleCancelRecording);
  const stopAndTranscribeOk = globalShortcut.register(stopAndTranscribeKey, () => {
    handleStopAndTranscribe('secondaryHotkey');
  });
  const showControlWindowOk = globalShortcut.register(showControlWindowKey, () => {
    handleShowControlWindow('hotkey-show-control-window');
  });

  const allOk = toggleOk && pasteOk && cancelOk && stopAndTranscribeOk && showControlWindowOk;
  return {
    allOk,
    toggleOk,
    pasteOk,
    cancelOk,
    stopAndTranscribeOk,
    showControlWindowOk,
    toggleKey,
    pasteKey,
    cancelKey,
    stopAndTranscribeKey,
    showControlWindowKey,
  };
}

function logHotkeyRegistrationFailure(message: string, result: HotkeyRegistrationResult) {
  logger.error(message, {
    toggleOk: result.toggleOk,
    pasteOk: result.pasteOk,
    cancelOk: result.cancelOk,
    stopAndTranscribeOk: result.stopAndTranscribeOk,
    showControlWindowOk: result.showControlWindowOk,
    toggleKey: result.toggleKey,
    pasteKey: result.pasteKey,
    cancelKey: result.cancelKey,
    stopAndTranscribeKey: result.stopAndTranscribeKey,
    showControlWindowKey: result.showControlWindowKey,
  });
}

function registerHotkeysOrFail() {
  globalShortcut.unregisterAll();
  const result = registerHotkeysForConfig(config);
  if (result.allOk) {
    logger.info('Global hotkeys registered', {
      toggleKey: result.toggleKey,
      pasteKey: result.pasteKey,
      cancelKey: result.cancelKey,
      stopAndTranscribeKey: result.stopAndTranscribeKey,
      showControlWindowKey: result.showControlWindowKey,
    });
    return true;
  }

  const message = 'Failed to register global hotkeys.';
  logHotkeyRegistrationFailure(message, result);
  stateMachine.transition('error', message);
  sendStateUpdate('error', message);
  scheduleAutoRestart('hotkey-registration-failed');
  return false;
}

function rebindHotkeysAfterSettingsSave(previousConfig: AppConfig): string | null {
  globalShortcut.unregisterAll();
  const result = registerHotkeysForConfig(config);
  if (result.allOk) {
    logger.info('Global hotkeys rebound after settings save', {
      toggleKey: result.toggleKey,
      pasteKey: result.pasteKey,
      cancelKey: result.cancelKey,
      stopAndTranscribeKey: result.stopAndTranscribeKey,
      showControlWindowKey: result.showControlWindowKey,
    });
    return null;
  }

  logHotkeyRegistrationFailure('Failed to register updated hotkeys; rolling back', result);
  config = previousConfig;
  saveConfig(configPath, config);

  globalShortcut.unregisterAll();
  const rollbackResult = registerHotkeysForConfig(config);
  if (rollbackResult.allOk) {
    logger.info('Hotkey rollback completed');
    return 'Selected hotkeys could not be registered. Previous hotkeys were restored.';
  }

  logHotkeyRegistrationFailure('Failed to restore previous hotkeys after rollback', rollbackResult);
  stateMachine.transition('error', 'Hotkey rollback failed.');
  sendStateUpdate('error', 'Hotkey rollback failed.');
  scheduleAutoRestart('hotkey-rollback-failed');
  return 'Failed to apply or restore hotkeys. App restart scheduled.';
}

function setupTray(attempt = 1) {
  if (tray) {
    updateTrayMenu();
    return;
  }

  try {
    const icon = createTrayIcon();

    tray = new Tray(icon);
    if (icon.isEmpty()) {
      tray.setTitle(TRAY_TITLE_FALLBACK);
      logger.error('Tray icon empty; using title fallback', { title: TRAY_TITLE_FALLBACK });
    } else {
      tray.setTitle('');
    }
    tray.setToolTip('VoicePaste');
    updateTrayMenu();
    tray.on('click', () => {
      if (process.platform === 'win32') {
        toggleIndicatorFromTray();
        return;
      }
      tray?.popUpContextMenu();
    });
    tray.on('right-click', () => {
      tray?.popUpContextMenu();
    });
    tray.on('double-click', () => {
      if (process.platform === 'win32') {
        toggleIndicatorFromTray();
      }
    });
    logger.info('Tray initialized', { attempt });
    clearTrayRetryTimer();
  } catch (error) {
    logger.error('Tray initialization failed', { attempt, error: String(error) });
    tray = null;
    if (!trayRetryTimer && attempt < TRAY_MAX_INIT_ATTEMPTS) {
      trayRetryTimer = setTimeout(() => {
        trayRetryTimer = null;
        setupTray(attempt + 1);
      }, TRAY_RETRY_DELAY_MS);
    }
  }
}

function ensureSessionDir(): { id: string; dir: string } {
  const baseDir = path.join(os.tmpdir(), 'voicepaste');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const sessionDir = fs.mkdtempSync(path.join(baseDir, 'session-'));
  const id = path.basename(sessionDir);
  sessionDirs.set(id, sessionDir);
  return { id, dir: sessionDir };
}

function getSessionDir(sessionId: string): string | null {
  return sessionDirs.get(sessionId) ?? null;
}

function cleanupSession(sessionId: string, segmentPaths: string[]) {
  for (const segmentPath of segmentPaths) {
    try {
      if (fs.existsSync(segmentPath)) {
        fs.unlinkSync(segmentPath);
      }
    } catch (error) {
      logger.debug('Failed to remove segment', { path: segmentPath, error: String(error) });
    }
  }

  const dir = sessionDirs.get(sessionId);
  if (dir) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      logger.debug('Failed to remove session dir', { dir, error: String(error) });
    }
  }
  sessionDirs.delete(sessionId);
}

function setupIpcHandlers() {
  ipcMain.handle('beginRecordingSession', () => {
    const session = ensureSessionDir();
    logger.info('Recording session created', { sessionId: session.id });
    return session.id;
  });

  ipcMain.handle(
    'saveSegment',
    (_event, payload: { sessionId: string; index: number; arrayBuffer: ArrayBuffer; mimeType: string }) => {
      const { sessionId, index, arrayBuffer, mimeType } = payload;
      const dir = getSessionDir(sessionId);
      if (!dir) {
        throw new Error('Unknown recording session');
      }
      const extension = mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('mp4')
          ? 'm4a'
          : 'wav';
      const filename = `segment-${String(index).padStart(4, '0')}.${extension}`;
      const fullPath = path.join(dir, filename);
      const buffer = Buffer.from(new Uint8Array(arrayBuffer));
      fs.writeFileSync(fullPath, buffer);
      return fullPath;
    },
  );

  ipcMain.on('startRecording', () => {
    clearQueuedPaste('recording-started');
    lastTranscript = null;
    lastError = null;
    if (stateMachine.getState() !== 'recording') {
      stateMachine.transition('recording', 'Recording started');
    }
    sendStateUpdate('recording', 'Recording...');
  });

  ipcMain.on('audioSegmentReady', (_event, payload: { path: string; index: number; bytes: number }) => {
    logger.debug('Segment ready', payload);
  });

  ipcMain.on(
    'stopRecording',
    async (
      _event,
      payload: { sessionId: string; segmentPaths: string[]; mimeType: string },
    ) => {
      if (activeTranscriptionJobs > 0 && stateMachine.getState() === 'transcribing') {
        logger.info('Transcription already in progress');
        return;
      }
      const { sessionId, segmentPaths } = payload;
      if (!segmentPaths.length) {
        const message = 'No audio captured.';
        clearQueuedPaste('no-audio-captured');
        stateMachine.transition('error', message);
        lastError = message;
        sendStateUpdate('error', message);
        scheduleAutoRestart('stop-recording-no-audio');
        cleanupSession(sessionId, segmentPaths);
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY ?? config.apiKey;
      if (!apiKey && !isLocalProvider(config.provider)) {
        const message = 'Missing OPENAI_API_KEY.';
        clearQueuedPaste('missing-api-key');
        stateMachine.transition('error', message);
        lastError = message;
        sendStateUpdate('error', message);
        scheduleAutoRestart('missing-api-key');
        cleanupSession(sessionId, segmentPaths);
        return;
      }

      activeTranscriptionJobs += 1;
      const transcriptionJobId = ++activeTranscriptionJobId;
      stateMachine.transition('transcribing', 'Transcribing');
      sendStateUpdate('transcribing', 'Transcribing...');

      const isTranscriptionJobCancelled = () => cancelledTranscriptionJobIds.has(transcriptionJobId);

      try {
        const transcript = await transcribeSegments(segmentPaths, config, apiKey ?? '', logger);
        if (isTranscriptionJobCancelled()) {
          logger.info('Transcription result ignored; job cancelled', { transcriptionJobId });
          return;
        }
        lastTranscript = transcript;
        const preview = buildPreview(transcript);
        stateMachine.transition('ready', 'Transcript ready');
        sendStateUpdate('ready', 'Ready to paste', preview);
        mainWindow?.webContents.send('transcriptReady', { text: transcript, preview });
        if (pasteQueuedAfterTranscription) {
          clearQueuedPaste('consumed-on-transcript-ready');
          logger.info('Executing queued paste after transcription');
          void handlePaste();
        }
      } catch (error) {
        if (isTranscriptionJobCancelled()) {
          logger.info('Transcription error ignored; job cancelled', {
            transcriptionJobId,
            error: String(error),
          });
          return;
        }
        const message = 'Transcription failed.';
        clearQueuedPaste('transcription-failed');
        lastError = message;
        stateMachine.transition('error', message);
        logger.error('Transcription failed', { error: String(error) });
        sendStateUpdate('error', message);
        scheduleAutoRestart('transcription-failed');
      } finally {
        cancelledTranscriptionJobIds.delete(transcriptionJobId);
        cleanupSession(sessionId, segmentPaths);
        activeTranscriptionJobs = Math.max(0, activeTranscriptionJobs - 1);
      }
    },
  );

  ipcMain.on('recordingCancelled', (_event, payload: { sessionId: string; segmentPaths: string[] }) => {
    const { sessionId, segmentPaths } = payload;
    clearQueuedPaste('recording-cancelled');
    logger.info('Recording cancelled', { sessionId });
    stateMachine.transition('idle', 'Recording cancelled');
    sendStateUpdate('idle', 'Idle');
    cleanupSession(sessionId, segmentPaths);
  });

  ipcMain.on('recordingError', (_event, message: string) => {
    clearQueuedPaste('recording-error');
    lastError = message;
    stateMachine.transition('error', message);
    sendStateUpdate('error', message);
    scheduleAutoRestart('renderer-recording-error');
  });

  ipcMain.on('hideIndicator', () => {
    hideIndicator('ui');
  });

  ipcMain.on('restartApp', () => {
    performRestart('renderer-ui');
  });

  ipcMain.on('cursorIndicatorReady', () => {
    markCursorIndicatorRendererReady('renderer-ipc-ready');
  });

  ipcMain.handle('getSettings', () => {
    return getSettingsResponse();
  });

  ipcMain.handle('saveSettings', (_event, payload: SettingsPayload) => {
    const validationError = validateSettingsPayload(payload);
    if (validationError) {
      logger.info('Settings save rejected', { reason: validationError });
      return { ok: false, error: validationError };
    }

    const previousConfig: AppConfig = {
      ...config,
      hotkeys: {
        ...config.hotkeys,
      },
    };

    config = {
      ...config,
      developerMode: payload.developerMode,
      uiLanguage: payload.uiLanguage,
      provider: payload.developerMode ? payload.providerCode.trim() : DEFAULT_PROVIDER,
      model: payload.developerMode ? payload.modelCode.trim() : DEFAULT_MODEL,
      apiKey: normalizeApiKeyForStorage(payload.apiKey),
      hotkeys: normalizeSettingsHotkeys(payload.hotkeys),
    };

    try {
      saveConfig(configPath, config);
    } catch (error) {
      logger.error('Failed to persist settings', { error: String(error) });
      config = previousConfig;
      return { ok: false, error: 'Failed to save settings.' };
    }

    const rebindError = rebindHotkeysAfterSettingsSave(previousConfig);
    if (rebindError) {
      return { ok: false, error: rebindError };
    }

    logger.info('Settings saved', {
      developerMode: config.developerMode,
      uiLanguage: config.uiLanguage,
      provider: config.provider,
      model: config.model,
      hotkeys: config.hotkeys,
      hasApiKey: Boolean(config.apiKey),
    });
    return { ok: true, settings: getSettingsResponse() };
  });

  ipcMain.handle('openLogsFolder', async () => {
    return openLogsFolder('renderer-settings');
  });

  ipcMain.handle('openExternalUrl', async (_event, url: string) => {
    if (typeof url !== 'string') {
      return false;
    }
    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      logger.info('Rejected external URL without http/https scheme', { url: trimmedUrl });
      return false;
    }

    try {
      await shell.openExternal(trimmedUrl);
      return true;
    } catch (error) {
      logger.error('Failed to open external URL', { url: trimmedUrl, error: String(error) });
      return false;
    }
  });

  ipcMain.on('setSettingsExpanded', (_event, isExpanded: boolean) => {
    settingsWindowExpanded = Boolean(isExpanded);
    if (!settingsWindowExpanded) {
      settingsWindowDeveloperMode = false;
    }
    resizeMainWindowForSettings();
  });

  ipcMain.on('setSettingsDeveloperMode', (_event, isDeveloperMode: boolean) => {
    settingsWindowDeveloperMode = Boolean(isDeveloperMode);
    if (settingsWindowExpanded) {
      resizeMainWindowForSettings();
    }
  });

  ipcMain.on('requestRecordButtonAction', () => {
    handleRecordButtonActionFromUi();
  });

  ipcMain.handle('copyTranscriptToClipboard', () => {
    if (!lastTranscript) {
      logger.info('Copy transcript ignored; no transcript available');
      return false;
    }
    clipboard.writeText(lastTranscript);
    logger.info('Transcript copied to clipboard');
    return true;
  });
}

function initializeApp() {
  const loaded = loadConfig();
  config = loaded.config;
  configPath = loaded.configPath;
  indicatorHiddenByUser = launchHidden;
  hasShownOnLaunch = false;

  if (process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: true });
    if (app.isPackaged && app.dock) {
      app.dock.hide();
    }
  } else if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: [WINDOWS_LAUNCH_HIDDEN_ARG],
      });
    }
  }

  const logDir = path.join(app.getPath('userData'), 'logs');
  logger = createLogger(logDir, config.diagnostics);
  logger.info('App starting', { configPath: loaded.configPath, launchHidden });
  if (loaded.migrationSourcePath) {
    logger.info('Config migrated from previous version', { from: loaded.migrationSourcePath });
  }
  attachProcessErrorHandlers();

  stateMachine = new StateMachine('idle', logger, (change) => {
    updateIndicatorVisibility(change.next);
    updateCursorIndicatorForState(change.next, 'state-change');
    updateTrayMenu();
    if (change.next === 'error') {
      clearQueuedPaste('state-error');
      scheduleAutoRestart(`state-error:${change.reason ?? 'unspecified'}`);
    }
  });

  createIndicatorWindow();
  createCursorIndicatorWindow();
  if (isCursorIndicatorSupported()) {
    screen.on('display-metrics-changed', handleCursorIndicatorDisplayMetricsChanged);
    screen.on('display-added', handleCursorIndicatorDisplayAdded);
    screen.on('display-removed', handleCursorIndicatorDisplayRemoved);
  }
  setupTray();
  setupIpcHandlers();
  registerHotkeysOrFail();

  sendStateUpdate('idle', 'Idle');
  updateIndicatorVisibility('idle');
  updateCursorIndicatorForState('idle', 'initialize');
  updateTrayMenu();
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {});

app.on('will-quit', () => {
  clearQueuedPaste('will-quit');
  clearReadyIndicatorTimer();
  clearErrorIndicatorTimer();
  clearAutoRestartTimer();
  clearTrayRetryTimer();
  clearCursorVisibilityWatchdog();
  stopCursorFollowLoop();
  screen.removeListener('display-metrics-changed', handleCursorIndicatorDisplayMetricsChanged);
  screen.removeListener('display-added', handleCursorIndicatorDisplayAdded);
  screen.removeListener('display-removed', handleCursorIndicatorDisplayRemoved);
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
  initializeApp();
});

app.on('activate', () => {
  handleShowControlWindow('app-activate');
});
