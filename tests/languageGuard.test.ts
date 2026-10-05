import { describe, expect, it } from 'vitest';
import {
  decideLanguage,
  guessLanguageFromText,
  meanOf,
  normalizeLanguage,
  pickMoreCertain,
} from '../src/shared/languageGuard';

describe('normalizeLanguage', () => {
  it('maps full names and codes for Dutch and English', () => {
    expect(normalizeLanguage('dutch')).toBe('nl');
    expect(normalizeLanguage('Dutch')).toBe('nl');
    expect(normalizeLanguage('nl')).toBe('nl');
    expect(normalizeLanguage('english')).toBe('en');
    expect(normalizeLanguage('en')).toBe('en');
  });

  it('marks every other language as other, and missing as undefined', () => {
    expect(normalizeLanguage('afrikaans')).toBe('other');
    expect(normalizeLanguage('german')).toBe('other');
    expect(normalizeLanguage(undefined)).toBeUndefined();
    expect(normalizeLanguage('  ')).toBeUndefined();
  });
});

describe('guessLanguageFromText', () => {
  it('recognises plain Dutch and English', () => {
    expect(guessLanguageFromText('Ik denk dat we morgen de nieuwe versie gewoon kunnen uitrollen.')).toBe('nl');
    expect(guessLanguageFromText('Please send the updated proposal to the client before Friday.')).toBe('en');
  });

  it('keeps Dutch with English tech terms as Dutch', () => {
    expect(guessLanguageFromText('Ik ga de pull request even mergen in de main branch en dan deploy ik.')).toBe('nl');
  });

  it('flags German, Spanish, French and Afrikaans as another language', () => {
    expect(guessLanguageFromText('Ich habe das gestern schon gesagt, aber er hat nicht zugehört.')).toBe('other');
    expect(guessLanguageFromText('Vivo en la ciudad de Madrid desde hace cinco años.')).toBe('other');
    expect(guessLanguageFromText("Je pense que c'est une bonne idée pour nous.")).toBe('other');
    expect(guessLanguageFromText('Ek het nie geweet dat hy so baie werk het nie.')).toBe('other');
  });

  it('flags non-Latin script', () => {
    expect(guessLanguageFromText('Привет, как у тебя дела сегодня?')).toBe('other');
  });

  it('does not judge text that is too short', () => {
    expect(guessLanguageFromText('Okay, quick test.')).toBe('unknown');
    expect(guessLanguageFromText('')).toBe('unknown');
  });
});

describe('decideLanguage', () => {
  it('accepts Dutch or English reported by the backend without extra requests', () => {
    expect(decideLanguage({ text: 'Hallo', language: 'dutch' })).toEqual({ action: 'accept' });
    expect(decideLanguage({ text: 'Hello', language: 'english' })).toEqual({ action: 'accept' });
  });

  it('retries once, forced to the likelier of nl/en, when probabilities are known', () => {
    expect(
      decideLanguage({ text: 'x', language: 'afrikaans', languageProbabilities: { af: 0.6, nl: 0.35, en: 0.01 } }),
    ).toEqual({ action: 'retry', language: 'nl' });
    expect(
      decideLanguage({ text: 'x', language: 'welsh', languageProbabilities: { cy: 0.5, en: 0.3, nl: 0.02 } }),
    ).toEqual({ action: 'retry', language: 'en' });
  });

  it('retries both languages when nothing says which of the two is likelier', () => {
    expect(decideLanguage({ text: 'x', language: 'german' })).toEqual({ action: 'retry-both' });
    expect(decideLanguage({ text: 'Ich habe das gestern schon gesagt, aber er hat nicht zugehört.' })).toEqual({
      action: 'retry-both',
    });
  });

  it('falls back to a text check when the backend reports no language', () => {
    expect(decideLanguage({ text: 'Ik denk dat we dit gewoon morgen kunnen doen.' })).toEqual({ action: 'accept' });
    expect(decideLanguage({ text: 'Ok.' })).toEqual({ action: 'accept' });
  });
});

describe('pickMoreCertain', () => {
  it('keeps the transcript with the higher mean log-probability', () => {
    expect(pickMoreCertain({ text: 'a', confidence: -0.2 }, { text: 'b', confidence: -0.9 }, 'en')).toBe('nl');
    expect(pickMoreCertain({ text: 'a', confidence: -1.1 }, { text: 'b', confidence: -0.3 }, 'nl')).toBe('en');
  });

  it('falls back to the preferred language without certainty on both', () => {
    expect(pickMoreCertain({ text: 'a' }, { text: 'b', confidence: -0.3 }, 'nl')).toBe('nl');
    expect(pickMoreCertain({ text: 'a', confidence: -0.5 }, { text: 'b', confidence: -0.5 }, 'en')).toBe('en');
  });
});

describe('meanOf', () => {
  it('ignores missing values', () => {
    expect(meanOf([-1, undefined, -3, null])).toBe(-2);
    expect(meanOf([])).toBeUndefined();
  });
});
