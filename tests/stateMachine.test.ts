import { describe, expect, it } from 'vitest';
import { StateMachine } from '../src/main/stateMachine';
import { Logger } from '../src/shared/logger';

const logger: Logger = {
  info: () => {},
  error: () => {},
  debug: () => {},
};

describe('StateMachine', () => {
  it('allows valid transitions', () => {
    const machine = new StateMachine('idle', logger);
    machine.transition('recording', 'start');
    expect(machine.getState()).toBe('recording');
    machine.transition('idle', 'cancel');
    expect(machine.getState()).toBe('idle');
    machine.transition('recording', 'start again');
    machine.transition('transcribing', 'stop');
    expect(machine.getState()).toBe('transcribing');
    machine.transition('recording', 'interrupt transcription and re-record');
    expect(machine.getState()).toBe('recording');
  });

  it('rejects invalid transitions', () => {
    const machine = new StateMachine('idle', logger);
    machine.transition('ready', 'skip');
    expect(machine.getState()).toBe('idle');
  });
});
