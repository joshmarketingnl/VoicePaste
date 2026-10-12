import { execFile } from 'child_process';

/**
 * NVIDIA detection for the CUDA engine build.
 *
 * Right after a cold boot VoicePaste starts before the NVIDIA driver is fully
 * up: `nvidia-smi` then hangs past the timeout, the app concludes "no GPU",
 * and every dictation that day runs on the CPU (measured: 49 s instead of 1 s).
 * So tell three outcomes apart and only retry the uncertain one:
 * - 'gpu':         an NVIDIA GPU answered.
 * - 'no-driver':   nvidia-smi doesn't exist; no NVIDIA card, don't retry.
 * - 'unavailable': the driver exists but didn't answer (yet); retry now and
 *                  look again later (the engine re-checks when it wakes up).
 */
export type GpuCheck = 'gpu' | 'no-driver' | 'unavailable';

export interface ProbeResult {
  /** nvidia-smi isn't installed (spawn failed with ENOENT). */
  missing: boolean;
  /** Exit code 0 and at least one "GPU n:" line. */
  found: boolean;
}

export type GpuProbe = (timeoutMs: number) => Promise<ProbeResult>;

export const nvidiaSmiProbe: GpuProbe = (timeoutMs) =>
  new Promise((resolve) => {
    execFile('nvidia-smi', ['-L'], { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === 'ENOENT') {
        resolve({ missing: true, found: false });
        return;
      }
      resolve({ missing: false, found: !error && /GPU\s+\d+/.test(String(stdout)) });
    });
  });

export interface DetectOptions {
  attempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  wait?: (ms: number) => Promise<void>;
}

export async function detectNvidiaGpu(probe: GpuProbe = nvidiaSmiProbe, options: DetectOptions = {}): Promise<GpuCheck> {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retryDelayMs = options.retryDelayMs ?? 3_000;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await probe(timeoutMs);
    if (result.missing) {
      return 'no-driver';
    }
    if (result.found) {
      return 'gpu';
    }
    if (attempt < attempts) {
      await wait(retryDelayMs);
    }
  }
  return 'unavailable';
}
