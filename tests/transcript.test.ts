import { describe, expect, it } from 'vitest';
import { buildPreview, joinTranscriptParts } from '../src/shared/transcript';

describe('joinTranscriptParts', () => {
  it('joins and collapses whitespace', () => {
    const result = joinTranscriptParts([' Hello ', 'world', '   from', 'VoicePaste ']);
    expect(result).toBe('Hello world from VoicePaste');
  });
});

describe('buildPreview', () => {
  it('truncates long text with ellipsis', () => {
    const text = 'a'.repeat(90);
    const preview = buildPreview(text, 20);
    expect(preview.length).toBe(20);
    expect(preview.endsWith('...')).toBe(true);
  });
});
