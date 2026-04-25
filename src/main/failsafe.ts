import { AppState } from '../shared/types';

export interface AutoRestartPolicy {
  windowMs: number;
  maxAttempts: number;
}

export interface AutoRestartDecision {
  allowed: boolean;
  attempts: number[];
}

export type PasteHotkeyAction =
  | 'paste-now'
  | 'queue-stop-transcribe'
  | 'queue-after-transcribe'
  | 'ignore-duplicate-queue';

export function resolvePasteHotkeyAction(state: AppState, hasQueuedPaste: boolean): PasteHotkeyAction {
  if (state === 'recording') {
    return hasQueuedPaste ? 'ignore-duplicate-queue' : 'queue-stop-transcribe';
  }
  if (state === 'transcribing') {
    return hasQueuedPaste ? 'ignore-duplicate-queue' : 'queue-after-transcribe';
  }
  return 'paste-now';
}

export function evaluateAutoRestart(
  previousAttempts: number[],
  now: number,
  policy: AutoRestartPolicy,
): AutoRestartDecision {
  const freshAttempts = previousAttempts.filter((timestamp) => now - timestamp <= policy.windowMs);
  if (freshAttempts.length >= policy.maxAttempts) {
    return { allowed: false, attempts: freshAttempts };
  }
  return { allowed: true, attempts: [...freshAttempts, now] };
}
