import { app, shell } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { Logger } from '../shared/logger';

/**
 * Keeps installs current from GitHub Releases.
 *
 * - Windows: downloads in the background and installs silently at a quiet
 *   moment (nothing dictated for a while, window hidden), then relaunches.
 *   Settings live in userData, which the installer never touches.
 * - macOS: an unsigned app can't replace itself (Squirrel.Mac requires a
 *   signed build), so only tell the user a new version exists and link the
 *   download page.
 */

const RELEASES_URL = 'https://github.com/joshmarketingnl/VoicePaste/releases/latest';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Overridable so the update path can be tested end to end without waiting.
const FIRST_CHECK_DELAY_MS = Number(process.env.VOICEPASTE_UPDATE_FIRST_CHECK_MS) || 60_000;
const QUIET_BEFORE_INSTALL_MS = Number(process.env.VOICEPASTE_UPDATE_QUIET_MS) || 10 * 60 * 1000;

export type UpdateStatus =
  | { kind: 'none' }
  /** Windows: downloaded, waiting for a quiet moment (or the tray item). */
  | { kind: 'ready'; version: string }
  /** macOS: a newer version exists on the download page. */
  | { kind: 'available'; version: string };

export interface UpdaterHooks {
  logger: Logger;
  /** True when installing now would not interrupt the user. */
  isQuiet: (quietForMs: number) => boolean;
  onStatusChange: (status: UpdateStatus) => void;
  /** Called right before the app quits to install. */
  beforeInstall: () => void;
}

let status: UpdateStatus = { kind: 'none' };
let hooks: UpdaterHooks | null = null;
let quietWatcher: NodeJS.Timeout | null = null;

export function getUpdateStatus(): UpdateStatus {
  return status;
}

function setStatus(next: UpdateStatus): void {
  status = next;
  hooks?.onStatusChange(next);
}

export function startUpdater(updaterHooks: UpdaterHooks): void {
  if (!app.isPackaged || (process.platform !== 'win32' && process.platform !== 'darwin')) {
    return;
  }
  hooks = updaterHooks;
  const { logger } = updaterHooks;

  autoUpdater.logger = {
    info: (message?: unknown) => logger.debug(`[updater] ${String(message)}`),
    warn: (message?: unknown) => logger.info(`[updater] ${String(message)}`),
    error: (message?: unknown) => logger.info(`[updater] ${String(message)}`),
    debug: (message: string) => logger.debug(`[updater] ${message}`),
  };
  // We ship a full NSIS installer, never a web installer.
  autoUpdater.disableWebInstaller = true;
  autoUpdater.autoDownload = process.platform === 'win32';
  autoUpdater.autoInstallOnAppQuit = process.platform === 'win32';

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available', { version: info.version });
    if (process.platform === 'darwin') {
      setStatus({ kind: 'available', version: info.version });
    }
  });
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded; installing at the next quiet moment', { version: info.version });
    setStatus({ kind: 'ready', version: info.version });
    watchForQuietMoment();
  });
  // Offline, GitHub hiccup, rate limit: never fatal, the next check retries.
  autoUpdater.on('error', (error: Error) => {
    logger.info('Update check failed', { error: String(error) });
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      logger.info('Update check failed', { error: String(error) });
    });
  };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS);
}

function watchForQuietMoment(): void {
  if (quietWatcher) {
    return;
  }
  quietWatcher = setInterval(() => {
    if (status.kind === 'ready' && hooks?.isQuiet(QUIET_BEFORE_INSTALL_MS)) {
      installUpdateNow('quiet-moment');
    }
  }, Math.min(60_000, QUIET_BEFORE_INSTALL_MS));
}

export function installUpdateNow(reason: string): void {
  if (status.kind !== 'ready' || !hooks) {
    return;
  }
  hooks.logger.info('Installing update', { version: status.version, reason });
  if (quietWatcher) {
    clearInterval(quietWatcher);
    quietWatcher = null;
  }
  hooks.beforeInstall();
  // Silent install, then start the new version again.
  autoUpdater.quitAndInstall(true, true);
}

export function openDownloadPage(): void {
  void shell.openExternal(RELEASES_URL);
}
