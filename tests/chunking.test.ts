import { describe, expect, it } from 'vitest';
import { shouldRotateSegment } from '../src/shared/chunking';

describe('shouldRotateSegment', () => {
  const policy = { maxBytes: 100, maxMs: 1000 };

  it('returns false under limits', () => {
    expect(shouldRotateSegment(50, 500, policy)).toBe(false);
  });

  it('returns true when size limit exceeded', () => {
    expect(shouldRotateSegment(100, 100, policy)).toBe(true);
  });

  it('returns true when time limit exceeded', () => {
    expect(shouldRotateSegment(10, 1000, policy)).toBe(true);
  });
});
