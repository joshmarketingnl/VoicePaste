import { describe, expect, it } from 'vitest';
import { evaluateAutoRestart, resolvePasteHotkeyAction } from '../src/main/failsafe';

describe('resolvePasteHotkeyAction', () => {
  it('queues stop+transcribe on recording when no paste is queued yet', () => {
    expect(resolvePasteHotkeyAction('recording', false)).toBe('queue-stop-transcribe');
  });

  it('queues post-transcribe paste when transcribing and none queued', () => {
    expect(resolvePasteHotkeyAction('transcribing', false)).toBe('queue-after-transcribe');
  });

  it('ignores duplicate queue requests while recording/transcribing', () => {
    expect(resolvePasteHotkeyAction('recording', true)).toBe('ignore-duplicate-queue');
    expect(resolvePasteHotkeyAction('transcribing', true)).toBe('ignore-duplicate-queue');
  });

  it('pastes immediately in idle/ready/error', () => {
    expect(resolvePasteHotkeyAction('idle', false)).toBe('paste-now');
    expect(resolvePasteHotkeyAction('ready', false)).toBe('paste-now');
    expect(resolvePasteHotkeyAction('error', false)).toBe('paste-now');
  });
});

describe('evaluateAutoRestart', () => {
  const policy = { windowMs: 60_000, maxAttempts: 3 };

  it('allows restart when attempts are below threshold', () => {
    const now = 1_000_000;
    const decision = evaluateAutoRestart([now - 30_000], now, policy);
    expect(decision.allowed).toBe(true);
    expect(decision.attempts).toEqual([now - 30_000, now]);
  });

  it('suppresses restart when attempts reach threshold in the same window', () => {
    const now = 1_000_000;
    const decision = evaluateAutoRestart([now - 10_000, now - 20_000, now - 30_000], now, policy);
    expect(decision.allowed).toBe(false);
    expect(decision.attempts).toEqual([now - 10_000, now - 20_000, now - 30_000]);
  });

  it('drops stale attempts outside the time window', () => {
    const now = 1_000_000;
    const decision = evaluateAutoRestart([now - 120_000, now - 10_000], now, policy);
    expect(decision.allowed).toBe(true);
    expect(decision.attempts).toEqual([now - 10_000, now]);
  });
});
