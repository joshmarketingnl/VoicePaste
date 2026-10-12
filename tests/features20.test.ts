import { describe, expect, it } from 'vitest';
import { chooseModelSize } from '../src/shared/engineModel';
import { vocabularyPrompt } from '../src/shared/vocabulary';
import { addToHistory, historyLabel, parseHistory } from '../src/shared/history';
import { mergeConfig } from '../src/shared/config';

describe('chooseModelSize', () => {
  it('runs the small model only where the large one is slow', () => {
    expect(chooseModelSize('auto', 'win32', 'no-driver')).toBe('small');
    expect(chooseModelSize('auto', 'win32', 'gpu')).toBe('large');
    expect(chooseModelSize('auto', 'darwin', 'no-driver')).toBe('large');
  });

  it('waits for a slow NVIDIA driver instead of downloading the small model', () => {
    expect(chooseModelSize('auto', 'win32', 'unavailable')).toBe('large');
  });

  it('follows an explicit choice', () => {
    expect(chooseModelSize('accurate', 'win32', 'no-driver')).toBe('large');
    expect(chooseModelSize('fast', 'win32', 'gpu')).toBe('small');
  });
});

describe('vocabularyPrompt', () => {
  it('turns lines and commas into one short hint', () => {
    expect(vocabularyPrompt('BNNX\nSmart Scale, JB Stone')).toBe('BNNX, Smart Scale, JB Stone.');
  });

  it('drops empties and duplicates, and says nothing without words', () => {
    expect(vocabularyPrompt(' \n , ')).toBeUndefined();
    expect(vocabularyPrompt('')).toBeUndefined();
    expect(vocabularyPrompt('CRM\ncrm\n  CRM  ')).toBe('CRM.');
  });

  it('stays short however long the list is', () => {
    const long = Array.from({ length: 200 }, (_, i) => `term${i}`).join('\n');
    const prompt = vocabularyPrompt(long)!;
    expect(prompt.length).toBeLessThanOrEqual(601);
    expect(prompt.split(', ').length).toBeLessThanOrEqual(50);
  });
});

describe('history', () => {
  const at = new Date('2026-10-12T15:30:00');

  it('keeps the newest ten, newest first, without empty or repeated entries', () => {
    let list = addToHistory([], 'eerste', at);
    list = addToHistory(list, '   ', at);
    list = addToHistory(list, 'eerste', at);
    expect(list.map((e) => e.text)).toEqual(['eerste']);
    for (let i = 0; i < 12; i += 1) list = addToHistory(list, `dictaat ${i}`, at);
    expect(list).toHaveLength(10);
    expect(list[0].text).toBe('dictaat 11');
  });

  it('labels an entry with its time and first words', () => {
    const [entry] = addToHistory([], 'Ik heb vanochtend de offerte gestuurd en wacht nu op een reactie van de klant', at);
    const label = historyLabel(entry, at);
    expect(label.startsWith('15:30  Ik heb vanochtend')).toBe(true);
    expect(label.endsWith('…')).toBe(true);
  });

  it('ignores a damaged history file', () => {
    expect(parseHistory('nonsense')).toEqual([]);
    expect(parseHistory([{ text: 'ok', at: 'x' }, { nope: 1 }])).toHaveLength(1);
  });
});

describe('new settings in config.json', () => {
  it('have safe defaults for an existing install', () => {
    const config = mergeConfig({ engine: 'openai', apiKey: 'sk-test' }, 'win32');
    expect(config.localModel).toBe('auto');
    expect(config.recordKeyPastes).toBe(false);
    expect(config.vocabulary).toBe('');
    expect(config.keepHistory).toBe(true);
    expect(config.offlineFallback).toBe(true);
  });

  it('keep what the user chose and reject nonsense', () => {
    const config = mergeConfig(
      { localModel: 'fast', recordKeyPastes: true, vocabulary: 'BNNX', keepHistory: false, offlineFallback: false },
      'win32',
    );
    expect(config).toMatchObject({ localModel: 'fast', recordKeyPastes: true, vocabulary: 'BNNX', keepHistory: false, offlineFallback: false });
    expect(mergeConfig({ localModel: 'huge' as never }, 'win32').localModel).toBe('auto');
  });
});
