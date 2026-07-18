import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { Logger } from '../shared/logger';
import { engineThreadCount, ProgressFn, resolveEngine, ResolvedEngine } from './engineAssets';

/**
 * Manages the embedded whisper.cpp engine as a child process, so the app is a
 * self-contained local transcription tool — no separate server to install or
 * start. Spawns whisper-server on a private localhost port, auto-restarts it if
 * it dies, and shuts it down when the app quits.
 */

export type EngineStatus = 'stopped' | 'preparing' | 'starting' | 'ready' | 'error';

const READY_TIMEOUT_MS = 120_000; // includes model load from disk
const POLL_INTERVAL_MS = 250;
const RESTART_BACKOFF_MS = 1_500;
const MAX_RESTARTS = 5;

export class EngineManager {
  private readonly logger: Logger;
  private proc: ChildProcess | null = null;
  private port: number | null = null;
  private resolved: ResolvedEngine | null = null;
  private startPromise: Promise<void> | null = null;
  private status: EngineStatus = 'stopped';
  private restarts = 0;
  private disposed = false;
  private vadDisabled = false;
  private lastError: string | null = null;
  private onProgress: ProgressFn;
  private onStatusChange: (status: EngineStatus) => void;

  constructor(
    logger: Logger,
    hooks: { onProgress?: ProgressFn; onStatusChange?: (status: EngineStatus) => void } = {},
  ) {
    this.logger = logger;
    this.onProgress = hooks.onProgress ?? (() => {});
    this.onStatusChange = hooks.onStatusChange ?? (() => {});
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  /** OpenAI-compatible base URL of the running engine, or null if not ready. */
  getBaseUrl(): string | null {
    return this.port ? `http://127.0.0.1:${this.port}/v1` : null;
  }

  private setStatus(status: EngineStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange(status);
    }
  }

  /**
   * Ensure the engine is up. Idempotent: concurrent callers await the same
   * startup. Downloads assets on first run, then launches whisper-server.
   */
  async ensureReady(): Promise<void> {
    if (this.disposed) throw new Error('EngineManager disposed');
    if (this.proc && this.port && this.status === 'ready') return;
    if (!this.startPromise) {
      this.startPromise = this.start().finally(() => {
        this.startPromise = null;
      });
    }
    return this.startPromise;
  }

  private async start(): Promise<void> {
    try {
      if (!this.resolved) {
        this.setStatus('preparing');
        this.resolved = await resolveEngine(this.logger, this.onProgress);
      }
      this.setStatus('starting');
      const port = await findFreePort();
      const useVad = !this.vadDisabled && !!this.resolved.vadPath;
      await this.spawnAndWait(port, useVad);
      this.port = port;
      this.restarts = 0;
      this.lastError = null;
      this.setStatus('ready');
      this.logger.info('Local engine ready', { port, gpu: this.resolved.gpu });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.setStatus('error');
      this.logger.error('Local engine failed to start', { error: this.lastError });
      throw error;
    }
  }

  private spawnAndWait(port: number, useVad: boolean): Promise<void> {
    const resolved = this.resolved!;
    return new Promise<void>((resolve, reject) => {
      const args = [
        '-m', resolved.modelPath,
        '-l', 'auto',
        '-t', String(engineThreadCount()),
        '--host', '127.0.0.1',
        '--port', String(port),
        '--convert',
        '--inference-path', '/v1/audio/transcriptions',
        // Break internal segments on word boundaries; without this the server
        // can split a segment mid-word ("zod\nat") and the newline-to-space
        // normalisation in joinTranscriptParts turns that into "zod at".
        '--split-on-word',
      ];
      if (useVad && resolved.vadPath) {
        args.push('--vad', '--vad-model', resolved.vadPath);
      }

      // Prepend the engine binary dir + ffmpeg dir to PATH so the DLLs and
      // ffmpeg are found even in a packaged app.
      const binDir = path.dirname(resolved.binaryPath);
      const extraPath = [binDir, resolved.ffmpegDir].filter(Boolean).join(path.delimiter);
      const env = { ...process.env, PATH: `${extraPath}${path.delimiter}${process.env.PATH ?? ''}` };

      const proc = spawn(resolved.binaryPath, args, {
        cwd: binDir, // whisper-server writes temp wav files to cwd; keep it writable
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env,
      });

      let settled = false;
      let stderrTail = '';
      const startedAt = Date.now();

      proc.stdout?.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line) this.logger.debug('[engine]', { line: line.slice(0, 300) });
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-2000);
      });

      proc.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(new Error(`Failed to launch engine: ${err.message}`));
        }
      });

      proc.on('exit', (code, signal) => {
        this.logger.info('Engine process exited', { code, signal, uptimeMs: Date.now() - startedAt });
        if (this.proc === proc) {
          this.proc = null;
          this.port = null;
        }
        if (!settled) {
          settled = true;
          reject(new Error(`Engine exited early (code=${code}). ${stderrTail.slice(-300)}`));
        } else if (!this.disposed && this.status === 'ready') {
          this.scheduleRestart();
        }
      });

      this.proc = proc;

      waitForHttp(port, proc, READY_TIMEOUT_MS)
        .then(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            try { proc.kill(); } catch { /* noop */ }
            // Retry once without VAD in case the build rejects the flags.
            if (useVad) {
              this.vadDisabled = true;
              this.logger.info('Engine start failed with VAD, retrying without it', { error: String(err) });
              this.spawnAndWait(port, false).then(resolve).catch(reject);
            } else {
              reject(err);
            }
          }
        });
    });
  }

  private scheduleRestart(): void {
    if (this.disposed) return;
    if (this.restarts >= MAX_RESTARTS) {
      this.setStatus('error');
      this.lastError = 'Engine crashed repeatedly';
      this.logger.error('Engine restart limit reached');
      return;
    }
    this.restarts += 1;
    this.setStatus('starting');
    this.logger.info('Restarting engine', { attempt: this.restarts });
    setTimeout(() => {
      if (this.disposed) return;
      this.start().catch((err) => this.logger.error('Engine restart failed', { error: String(err) }));
    }, RESTART_BACKOFF_MS);
  }

  dispose(): void {
    this.disposed = true;
    this.setStatus('stopped');
    if (this.proc) {
      this.logger.info('Stopping local engine');
      try {
        this.proc.removeAllListeners();
        this.proc.kill();
      } catch { /* already dead */ }
      this.proc = null;
    }
    this.port = null;
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to allocate port')));
      }
    });
  });
}

async function waitForHttp(port: number, proc: ChildProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      throw new Error('Engine process exited during startup');
    }
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1000);
      await fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal });
      clearTimeout(t);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`Engine did not become ready within ${timeoutMs}ms`);
}
