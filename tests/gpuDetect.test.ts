import { describe, expect, it } from 'vitest';
import { detectNvidiaGpu, GpuProbe, ProbeResult } from '../src/main/gpuDetect';

function scripted(results: ProbeResult[]): { probe: GpuProbe; calls: () => number } {
  let n = 0;
  return {
    probe: async () => results[Math.min(n++, results.length - 1)],
    calls: () => n,
  };
}

const noWait = async () => {};

describe('detectNvidiaGpu', () => {
  it('reports a GPU on the first answer', async () => {
    const s = scripted([{ missing: false, found: true }]);
    expect(await detectNvidiaGpu(s.probe, { wait: noWait })).toBe('gpu');
    expect(s.calls()).toBe(1);
  });

  it('does not retry when nvidia-smi is not installed', async () => {
    const s = scripted([{ missing: true, found: false }]);
    expect(await detectNvidiaGpu(s.probe, { wait: noWait })).toBe('no-driver');
    expect(s.calls()).toBe(1);
  });

  it('retries while the driver is still starting (cold boot), then finds the GPU', async () => {
    const s = scripted([
      { missing: false, found: false },
      { missing: false, found: false },
      { missing: false, found: true },
    ]);
    expect(await detectNvidiaGpu(s.probe, { wait: noWait })).toBe('gpu');
    expect(s.calls()).toBe(3);
  });

  it('reports unavailable (check again later) when the driver never answers', async () => {
    const s = scripted([{ missing: false, found: false }]);
    expect(await detectNvidiaGpu(s.probe, { attempts: 3, wait: noWait })).toBe('unavailable');
    expect(s.calls()).toBe(3);
  });
});
