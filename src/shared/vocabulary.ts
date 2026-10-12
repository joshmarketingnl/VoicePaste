/**
 * The user's word list (names, jargon) as a hint for the speech model.
 *
 * Whisper reads the prompt as text that came before the audio, so a short
 * list nudges it toward those spellings. Measured on the Dutch-with-jargon
 * test clips (Oct 2026): 9-21% word errors without, 4-7% with the matching
 * terms; terms that aren't spoken changed nothing, and silence or noise still
 * came back empty.
 */

const MAX_TERMS = 50;
const MAX_CHARS = 600;

/** One term per line or comma-separated; returns undefined when empty. */
export function vocabularyPrompt(vocabulary: string | undefined): string | undefined {
  if (!vocabulary) return undefined;
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of vocabulary.split(/[\n,;]/)) {
    const term = raw.trim().replace(/\s+/g, ' ');
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  if (!terms.length) return undefined;
  let prompt = '';
  for (const term of terms) {
    const next = prompt ? `${prompt}, ${term}` : term;
    if (next.length > MAX_CHARS) break;
    prompt = next;
  }
  return `${prompt}.`;
}
