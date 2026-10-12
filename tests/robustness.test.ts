import { describe, expect, it } from 'vitest';
import { classifyMicError, isNoSignal, isRetryableMicError, micHelp } from '../src/shared/micErrors';
import {
  classifyTranscriptionError,
  failedRecordingsToPrune,
  isWorthRetrying,
  transcriptionErrorMessage,
} from '../src/shared/transcriptionErrors';

describe('classifyMicError', () => {
  it('tells permission, missing device and a busy or broken device apart', () => {
    expect(classifyMicError('NotAllowedError')).toBe('permission');
    expect(classifyMicError('NotFoundError')).toBe('no-device');
    expect(classifyMicError('NotReadableError')).toBe('busy-or-broken');
    expect(classifyMicError('SomethingNew')).toBe('unknown');
    expect(classifyMicError(undefined)).toBe('unknown');
  });

  it('retries only a busy or broken device', () => {
    expect(isRetryableMicError('NotReadableError')).toBe(true);
    expect(isRetryableMicError('NotAllowedError')).toBe(false);
  });
});

describe('micHelp', () => {
  it('points a blocked microphone at the right settings page per platform', () => {
    expect(micHelp('permission', 'win32', 'nl').settingsUrl).toBe('ms-settings:privacy-microphone');
    expect(micHelp('permission', 'darwin', 'en').settingsUrl).toContain('Privacy_Microphone');
    expect(micHelp('permission', 'linux', 'en').settingsUrl).toBeUndefined();
  });

  it('suggests replugging a USB microphone that does not respond', () => {
    expect(micHelp('busy-or-broken', 'win32', 'nl').message).toContain('USB');
    expect(micHelp('busy-or-broken', 'win32', 'nl').settingsUrl).toBeUndefined();
  });

  it('speaks the interface language', () => {
    expect(micHelp('no-device', 'win32', 'nl').message).toMatch(/^Geen microfoon/);
    expect(micHelp('no-device', 'win32', 'en').message).toMatch(/^No microphone/);
  });
});

describe('isNoSignal', () => {
  it('flags only true silence, never a quiet room', () => {
    expect(isNoSignal(-1000)).toBe(true); // digital zeros
    expect(isNoSignal(-91)).toBe(true); // macOS privacy block (July 2026)
    expect(isNoSignal(-63)).toBe(false); // real mic, nobody speaking
    expect(isNoSignal(-20)).toBe(false);
    expect(isNoSignal(null)).toBe(false); // not measured: never block
  });
});

describe('classifyTranscriptionError', () => {
  it('recognises the failures seen in the field', () => {
    expect(classifyTranscriptionError({ status: 401, message: '401 Incorrect API key provided' })).toBe('key');
    expect(classifyTranscriptionError(new Error('Connection error.'))).toBe('offline');
    expect(
      classifyTranscriptionError({ status: 400, message: '400 audio duration 0.06 seconds is shorter than 0.1 seconds' }),
    ).toBe('too-short');
    expect(classifyTranscriptionError({ status: 429, message: 'You exceeded your current quota' })).toBe('quota');
    expect(classifyTranscriptionError({ code: 'ECONNREFUSED' })).toBe('offline');
    expect(classifyTranscriptionError(new Error('Engine exited early (code=1)'))).toBe('engine');
  });

  it('offers a retry only where one can help', () => {
    expect(isWorthRetrying('offline')).toBe(true);
    expect(isWorthRetrying('too-short')).toBe(false);
    expect(isWorthRetrying('key')).toBe(false);
  });

  it('says the recording was kept when it was', () => {
    expect(transcriptionErrorMessage('offline', 'nl')).toContain('bewaard');
    expect(transcriptionErrorMessage('too-short', 'nl')).not.toContain('bewaard');
  });
});

describe('failedRecordingsToPrune', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  it('keeps the newest five and nothing older than a week', () => {
    const names = [
      '2026-10-12T11-00-00-a', '2026-10-12T10-00-00-b', '2026-10-11T10-00-00-c', '2026-10-10T10-00-00-d',
      '2026-10-09T10-00-00-e', '2026-10-08T10-00-00-f', '2026-09-01T10-00-00-old',
    ];
    expect(failedRecordingsToPrune(names, now).sort()).toEqual(['2026-09-01T10-00-00-old', '2026-10-08T10-00-00-f'].sort());
  });
});
