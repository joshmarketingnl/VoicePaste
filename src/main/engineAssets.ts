import { app } from 'electron';
import { spawnSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { Logger } from '../shared/logger';

/**
 * Resolves the local whisper.cpp engine's binary, model and VAD files.
 *
 * Distribution strategy (keeps the installer small, "just works" everywhere):
 * - The small CPU `whisper-server` binary is bundled with the app.
 * - The speech model, VAD model and (on NVIDIA machines) the CUDA build are
 *   downloaded once on first run into the user data dir.
 * - Anything already present on disk (e.g. a previous separate-server install)
 *   is reused instead of re-downloaded.
 */

export interface EngineAssetProgress {
  asset: 'model' | 'vad' | 'cuda' | 'ffmpeg';
  receivedBytes: number;
  totalBytes: number;
  done: boolean;
}

export type ProgressFn = (p: EngineAssetProgress) => void;

const MODEL_FILE = 'ggml-large-v3-turbo-q5_0.bin';
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`;
const MODEL_MIN_BYTES = 400 * 1024 * 1024;

const VAD_FILE = 'ggml-silero-v5.1.2.bin';
const VAD_URL = `https://huggingface.co/ggml-org/whisper-vad/resolve/main/${VAD_FILE}`;
const VAD_MIN_BYTES = 200 * 1024;

const CUDA_ZIP_URL =
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-cublas-12.4.0-bin-x64.zip';

export interface ResolvedEngine {
  binaryPath: string;
  modelPath: string;
  vadPath: string | null;
  gpu: boolean;
  /** Extra directory to prepend to PATH so whisper-server finds ffmpeg. */
  ffmpegDir: string | null;
}

function engineDir(): string {
  const dir = path.join(app.getPath('userData'), 'engine');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function modelsDir(): string {
  const dir = path.join(engineDir(), 'models');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Directory of the bundled CPU binary (outside asar via extraResources). */
function bundledBinDir(): string {
  const platformKey = `${process.platform}-${process.arch}`;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'engine', platformKey);
  }
  return path.join(app.getAppPath(), 'resources', 'engine', platformKey);
}

function serverExeName(): string {
  return process.platform === 'win32' ? 'whisper-server.exe' : 'whisper-server';
}

/** Legacy separate-server install — reuse its models/binaries if present. */
function legacyServerDir(): string | null {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'voicepaste-local-server');
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'voicepaste-local-server');
  }
  return null;
}

function hasNvidiaGpu(): boolean {
  if (process.platform !== 'win32') return false; // mac uses Metal (built into the binary)
  try {
    const res = spawnSync('nvidia-smi', ['-L'], { timeout: 4000 });
    return res.status === 0 && /GPU\s+\d+/.test(res.stdout?.toString() ?? '');
  } catch {
    return false;
  }
}

function fileAtLeast(filePath: string, minBytes: number): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).size >= minBytes;
  } catch {
    return false;
  }
}

// A stalled connection would otherwise hang `reader.read()` forever, leaving
// the engine in "preparing" and the app looking frozen. Abort when no data
// arrives for a while and retry the download from scratch a few times.
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAY_MS = 2_000;

async function download(
  url: string,
  dest: string,
  asset: EngineAssetProgress['asset'],
  onProgress: ProgressFn,
  logger: Logger,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      await downloadOnce(url, dest, asset, onProgress);
      return;
    } catch (error) {
      lastError = error;
      logger.info('Download attempt failed', { asset, attempt, error: String(error) });
      if (attempt < DOWNLOAD_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, DOWNLOAD_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function downloadOnce(url: string, dest: string, asset: EngineAssetProgress['asset'], onProgress: ProgressFn): Promise<void> {
  const partPath = `${dest}.part`;
  const controller = new AbortController();
  let stallTimer: NodeJS.Timeout | null = null;
  const armStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), DOWNLOAD_STALL_TIMEOUT_MS);
  };

  armStallTimer();
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${asset}): HTTP ${response.status}`);
    }
    const totalBytes = Number(response.headers.get('content-length') ?? 0);
    let receivedBytes = 0;
    let lastReport = 0;
    const stream = createWriteStream(partPath);
    try {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armStallTimer();
        receivedBytes += value.byteLength;
        await new Promise<void>((resolve, reject) => {
          stream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
        });
        const now = Date.now();
        if (now - lastReport >= 300) {
          lastReport = now;
          onProgress({ asset, receivedBytes, totalBytes, done: false });
        }
      }
      await new Promise<void>((resolve, reject) => stream.end((err?: Error | null) => (err ? reject(err) : resolve())));
    } catch (error) {
      stream.destroy();
      try { unlinkSync(partPath); } catch { /* noop */ }
      throw error;
    }
    try { unlinkSync(dest); } catch { /* noop */ }
    renameSync(partPath, dest);
    onProgress({ asset, receivedBytes, totalBytes: totalBytes || receivedBytes, done: true });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Download stalled (${asset}): no data received for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s`,
      );
    }
    throw error;
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }
}

/** Resolve the CUDA binary directory, reusing a legacy install or extracting the release zip. */
async function resolveCudaBinary(logger: Logger, onProgress: ProgressFn): Promise<string | null> {
  // 1. Reuse a legacy separate-server CUDA build if present.
  const legacy = legacyServerDir();
  if (legacy) {
    const legacyGpuExe = path.join(legacy, 'bin-gpu', serverExeName());
    if (existsSync(legacyGpuExe)) {
      logger.info('Reusing legacy CUDA whisper-server', { path: legacyGpuExe });
      return path.dirname(legacyGpuExe);
    }
  }

  // 2. Download + extract the official CUDA release once.
  const cudaDir = path.join(engineDir(), 'bin-gpu');
  const cudaExe = path.join(cudaDir, serverExeName());
  if (existsSync(cudaExe)) {
    return cudaDir;
  }
  try {
    mkdirSync(cudaDir, { recursive: true });
    const zipPath = path.join(engineDir(), 'whisper-cublas.zip');
    logger.info('Downloading CUDA whisper-server build');
    await download(CUDA_ZIP_URL, zipPath, 'cuda', onProgress, logger);
    // Extract with PowerShell (Windows-only path).
    const extractDir = path.join(engineDir(), 'cuda-extract');
    spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`], { timeout: 120000 });
    const releaseDir = existsSync(path.join(extractDir, 'Release')) ? path.join(extractDir, 'Release') : extractDir;
    // Copy the exe + all DLLs into cudaDir.
    for (const name of readdirSync(releaseDir)) {
      if (name === serverExeName() || /\.dll$/i.test(name)) {
        copyFileSync(path.join(releaseDir, name), path.join(cudaDir, name));
      }
    }
    try { unlinkSync(zipPath); } catch { /* noop */ }
    rmSync(extractDir, { recursive: true, force: true });
    if (existsSync(cudaExe)) return cudaDir;
  } catch (error) {
    logger.info('CUDA build unavailable, falling back to CPU', { error: String(error) });
  }
  return null;
}

// Static ffmpeg builds for machines that have none. whisper-server's
// `--convert` execs ffmpeg at startup; without it the whole engine dies with
// "ffmpeg: command not found" — caught by the e2e smoke test on clean CI
// machines. Windows: BtbN LGPL build; macOS: Martin Riedl static builds.
const FFMPEG_DOWNLOAD_URLS: Partial<Record<string, string>> = {
  'win32-x64': 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip',
  'darwin-arm64': 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip',
  'darwin-x64': 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip',
};

function ffmpegExeName(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

/** Find ffmpeg (needed for webm->wav conversion): bundled, downloaded, or system PATH. */
function findFfmpeg(): { dir: string | null; available: boolean } {
  const exe = ffmpegExeName();
  // Bundled next to the engine binaries?
  const bundled = path.join(bundledBinDir(), exe);
  if (existsSync(bundled)) return { dir: bundledBinDir(), available: true };
  // Downloaded into engineDir?
  const downloaded = path.join(engineDir(), 'ffmpeg', exe);
  if (existsSync(downloaded)) return { dir: path.dirname(downloaded), available: true };
  // System ffmpeg on PATH — whisper-server will find it itself.
  try {
    const res = spawnSync(exe, ['-version'], { timeout: 4000 });
    if (res.status === 0) return { dir: null, available: true };
  } catch { /* not on PATH */ }
  return { dir: null, available: false };
}

function findFileRecursive(dir: string, lowerName: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFileRecursive(p, lowerName);
      if (hit) return hit;
    } else if (entry.name.toLowerCase() === lowerName) {
      return p;
    }
  }
  return null;
}

/** One-time ffmpeg download into engineDir()/ffmpeg. Returns that directory. */
async function downloadFfmpeg(logger: Logger, onProgress: ProgressFn): Promise<string> {
  const key = `${process.platform}-${process.arch}`;
  const url = FFMPEG_DOWNLOAD_URLS[key];
  if (!url) {
    throw new Error(`No ffmpeg download available for ${key}; install ffmpeg on PATH`);
  }
  const destDir = path.join(engineDir(), 'ffmpeg');
  mkdirSync(destDir, { recursive: true });
  const zipPath = path.join(destDir, 'ffmpeg-download.zip');
  const extractDir = path.join(destDir, 'extract');
  logger.info('Downloading ffmpeg (one-time setup)', { url });
  await download(url, zipPath, 'ffmpeg', onProgress, logger);
  try {
    rmSync(extractDir, { recursive: true, force: true });
    if (process.platform === 'win32') {
      const res = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`],
        { timeout: 120000 },
      );
      if (res.status !== 0) throw new Error(`Expand-Archive failed: ${res.stderr?.toString().slice(0, 300)}`);
    } else {
      const res = spawnSync('unzip', ['-o', zipPath, '-d', extractDir], { timeout: 120000 });
      if (res.status !== 0) throw new Error(`unzip failed: ${res.stderr?.toString().slice(0, 300)}`);
    }
    const found = findFileRecursive(extractDir, ffmpegExeName());
    if (!found) throw new Error('ffmpeg binary not found in downloaded archive');
    const target = path.join(destDir, ffmpegExeName());
    copyFileSync(found, target);
    if (process.platform !== 'win32') chmodSync(target, 0o755);
    logger.info('ffmpeg ready', { path: target });
    return destDir;
  } finally {
    try { unlinkSync(zipPath); } catch { /* noop */ }
    try { rmSync(extractDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

/**
 * Ensure the binary + model + VAD are available, downloading what's missing.
 * Returns the resolved paths for the EngineManager to launch whisper-server.
 */
export async function resolveEngine(logger: Logger, onProgress: ProgressFn = () => {}): Promise<ResolvedEngine> {
  const gpu = hasNvidiaGpu();

  // Binary: CUDA (win+nvidia) or the bundled CPU build.
  let binDir = bundledBinDir();
  if (gpu) {
    const cudaDir = await resolveCudaBinary(logger, onProgress);
    if (cudaDir) binDir = cudaDir;
  }
  const binaryPath = path.join(binDir, serverExeName());
  if (!existsSync(binaryPath)) {
    throw new Error(`Local engine binary missing: ${binaryPath}. Reinstall VoicePaste.`);
  }

  // Model: reuse legacy or a previous download, else fetch.
  let modelPath = path.join(modelsDir(), MODEL_FILE);
  const legacy = legacyServerDir();
  const legacyModel = legacy ? path.join(legacy, 'models', MODEL_FILE) : null;
  if (fileAtLeast(modelPath, MODEL_MIN_BYTES)) {
    // already downloaded
  } else if (legacyModel && fileAtLeast(legacyModel, MODEL_MIN_BYTES)) {
    logger.info('Reusing legacy model', { path: legacyModel });
    modelPath = legacyModel;
  } else {
    logger.info('Downloading speech model (one-time setup)');
    await download(MODEL_URL, modelPath, 'model', onProgress, logger);
  }

  // VAD: reuse or fetch (non-fatal).
  let vadPath: string | null = path.join(modelsDir(), VAD_FILE);
  const legacyVad = legacy ? path.join(legacy, 'models', VAD_FILE) : null;
  if (fileAtLeast(vadPath, VAD_MIN_BYTES)) {
    // present
  } else if (legacyVad && fileAtLeast(legacyVad, VAD_MIN_BYTES)) {
    vadPath = legacyVad;
  } else {
    try {
      await download(VAD_URL, vadPath, 'vad', onProgress, logger);
    } catch (error) {
      logger.info('VAD model unavailable (non-fatal)', { error: String(error) });
      vadPath = null;
    }
  }

  // ffmpeg: bundled/downloaded/PATH, else fetch a static build — without it
  // whisper-server's --convert exits at startup and nothing transcribes.
  let ffmpeg = findFfmpeg();
  if (!ffmpeg.available) {
    try {
      ffmpeg = { dir: await downloadFfmpeg(logger, onProgress), available: true };
    } catch (error) {
      logger.error('ffmpeg unavailable — transcription will fail until it is installed', {
        error: String(error),
      });
    }
  }

  return { binaryPath, modelPath, vadPath, gpu, ffmpegDir: ffmpeg.dir };
}

/** Approx idle threads: leave headroom for the rest of the system. */
export function engineThreadCount(): number {
  const cores = os.cpus()?.length ?? 4;
  return Math.max(2, Math.min(8, cores - 2));
}
