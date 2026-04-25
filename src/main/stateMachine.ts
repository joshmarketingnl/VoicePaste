import { AppState } from '../shared/types';
import { Logger } from '../shared/logger';

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  idle: ['recording', 'error'],
  recording: ['transcribing', 'error', 'idle'],
  transcribing: ['ready', 'error', 'recording'],
  ready: ['recording', 'idle', 'error'],
  error: ['idle', 'recording'],
};

export interface StateChange {
  previous: AppState;
  next: AppState;
  reason?: string;
}

export class StateMachine {
  private state: AppState;
  private onChange?: (change: StateChange) => void;
  private logger: Logger;

  constructor(initial: AppState, logger: Logger, onChange?: (change: StateChange) => void) {
    this.state = initial;
    this.logger = logger;
    this.onChange = onChange;
  }

  getState(): AppState {
    return this.state;
  }

  transition(next: AppState, reason?: string): void {
    const current = this.state;
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      this.logger.error('Invalid state transition', { from: current, to: next, reason });
      return;
    }
    this.state = next;
    this.logger.info('State transition', { from: current, to: next, reason });
    this.onChange?.({ previous: current, next, reason });
  }
}
