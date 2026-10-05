/**
 * Keeps transcription to Dutch or English ('nl-en' mode). Whisper's automatic
 * language detection occasionally picks a third language (Afrikaans or German
 * for Dutch speech, random languages for short or noisy clips) and then writes
 * the text in that language. Detect that after the fact and redo the segment
 * forced to Dutch or English — only when it happens, so normal dictations
 * cost exactly one request.
 */

export type TargetLanguage = 'nl' | 'en';
export type DetectedLanguage = TargetLanguage | 'other' | 'unknown';

/** What one transcription request told us, whatever the backend. */
export interface TranscriptionAttempt {
  text: string;
  /** Language the model used, as returned ("dutch", "nl", "english", ...). */
  language?: string;
  /** Per-language probabilities keyed by ISO code (whisper.cpp verbose_json). */
  languageProbabilities?: Record<string, number>;
  /** Mean log-probability of the output; higher means more certain. */
  confidence?: number;
}

export type LanguageDecision =
  | { action: 'accept' }
  | { action: 'retry'; language: TargetLanguage }
  | { action: 'retry-both' };

const LANGUAGE_NAMES: Record<string, TargetLanguage> = {
  nl: 'nl',
  dutch: 'nl',
  en: 'en',
  english: 'en',
};

/** Map an API language value onto nl/en/other; undefined when absent. */
export function normalizeLanguage(raw: string | undefined | null): TargetLanguage | 'other' | undefined {
  if (!raw || !raw.trim()) {
    return undefined;
  }
  return LANGUAGE_NAMES[raw.trim().toLowerCase()] ?? 'other';
}

// Words that are distinctive for Dutch or English. Words shared with other
// European languages are left out on purpose ("de", "en", "je", "die", "was", "so",
// "hier", "ja"...), otherwise Spanish, French or German text would pass.
const DUTCH_WORDS = new Set([
  'het', 'een', 'van', 'ik', 'niet', 'dat', 'op', 'zijn', 'met', 'voor', 'maar', 'ook', 'wat',
  'als', 'dan', 'nog', 'wel', 'naar', 'om', 'bij', 'ze', 'we', 'hij', 'zo', 'nu', 'heb', 'heeft',
  'kan', 'moet', 'ga', 'gaat', 'gaan', 'dit', 'deze', 'mijn', 'jij', 'jouw', 'geen', 'iets', 'even',
  'gewoon', 'eigenlijk', 'misschien', 'toch', 'nou', 'waarom', 'hoe', 'welke', 'omdat', 'want',
  'dus', 'uit', 'door', 'heel', 'veel', 'zou', 'wil', 'wordt', 'worden', 'hebben', 'kunnen',
  'moeten', 'mee', 'daar', 'waar', 'is', 'of', 'te', 'ben', 'bent', 'wij', 'jullie', 'hun',
  'onze', 'ons', 'zeg', 'oké', 'goed', 'beetje', 'gedaan', 'doen', 'komt', 'komen',
]);
const ENGLISH_WORDS = new Set([
  'the', 'and', 'to', 'of', 'is', 'that', 'it', 'for', 'you', 'with', 'this', 'be', 'are', 'have',
  'not', 'but', 'what', 'we', 'they', 'my', 'your', 'can', 'will', 'just', 'do', 'if', 'at', 'or',
  'from', 'there', 'about', 'would', 'could', 'should', 'been', 'has', 'had', 'their', 'them',
  'he', 'she', 'his', 'her', 'our', 'an', 'by', 'all', 'one', 'me', 'up', 'out', 'get', 'like',
  'think', 'know', 'want', 'need', 'make', 'going', 'really', 'yeah', 'okay', 'please',
  "it's", "i'm", "don't", 'i',
]);
// Strong markers of the languages Whisper confuses Dutch/English with.
const OTHER_LANGUAGE_WORDS = new Set([
  // Afrikaans
  'nie', 'ek', 'jy', 'hulle', 'vir', 'baie', 'sê',
  // German
  'und', 'ich', 'ist', 'nicht', 'das', 'der', 'sie', 'mit', 'auf', 'auch', 'sich', 'dem', 'wir',
  'aber', 'oder', 'wenn', 'noch', 'habe', 'haben', 'sind', 'eine', 'einen',
  // Spanish / Portuguese / Italian
  'el', 'la', 'los', 'las', 'que', 'por', 'para', 'con', 'una', 'pero', 'muy', 'como', 'está',
  'não', 'uma', 'com', 'muito', 'della', 'che', 'non', 'sono',
  // French
  'le', 'les', 'des', 'une', 'est', 'pas', 'qui', 'dans', 'pour', 'avec', 'sur', 'vous', 'nous',
  'mais', 'très', "c'est",
]);

const MIN_WORDS_TO_JUDGE = 4;
const MIN_TARGET_WORD_RATIO = 0.12;
const MIN_LATIN_LETTER_RATIO = 0.7;

/**
 * Best-effort language guess from the transcript text alone, for backends that
 * don't report the language (OpenAI gpt-4o-*-transcribe). 'unknown' means the
 * text is too short to tell, which callers treat as fine.
 */
export function guessLanguageFromText(text: string): DetectedLanguage {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) {
    return 'unknown';
  }
  const latinLetters = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  if (latinLetters / letters.length < MIN_LATIN_LETTER_RATIO) {
    return 'other';
  }

  const words = text.toLowerCase().replace(/’/g, "'").match(/\p{L}+(?:'\p{L}+)?/gu) ?? [];
  if (words.length < MIN_WORDS_TO_JUDGE) {
    return 'unknown';
  }

  let dutch = 0;
  let english = 0;
  let target = 0;
  let other = 0;
  for (const word of words) {
    const isDutch = DUTCH_WORDS.has(word);
    const isEnglish = ENGLISH_WORDS.has(word);
    if (isDutch) dutch += 1;
    if (isEnglish) english += 1;
    if (isDutch || isEnglish) target += 1;
    if (OTHER_LANGUAGE_WORDS.has(word)) other += 1;
  }

  if (other > target || target / words.length < MIN_TARGET_WORD_RATIO) {
    return 'other';
  }
  return dutch >= english ? 'nl' : 'en';
}

/** Decide what to do with an unforced ('nl-en' mode) transcription. */
export function decideLanguage(attempt: TranscriptionAttempt): LanguageDecision {
  const detected = normalizeLanguage(attempt.language) ?? guessLanguageFromText(attempt.text);
  if (detected !== 'other') {
    return { action: 'accept' };
  }

  const probabilities = attempt.languageProbabilities;
  if (probabilities && (typeof probabilities.nl === 'number' || typeof probabilities.en === 'number')) {
    const nl = probabilities.nl ?? 0;
    const en = probabilities.en ?? 0;
    return { action: 'retry', language: nl >= en ? 'nl' : 'en' };
  }

  return { action: 'retry-both' };
}

/**
 * After forcing both languages, keep the more certain transcript. Without a
 * certainty measure on both, fall back to the user's preferred language.
 */
export function pickMoreCertain(
  dutch: TranscriptionAttempt,
  english: TranscriptionAttempt,
  preferred: TargetLanguage,
): TargetLanguage {
  if (typeof dutch.confidence === 'number' && typeof english.confidence === 'number') {
    if (dutch.confidence === english.confidence) {
      return preferred;
    }
    return dutch.confidence > english.confidence ? 'nl' : 'en';
  }
  return preferred;
}

/** Mean of the finite numbers, or undefined when there are none. */
export function meanOf(values: Array<number | undefined | null>): number | undefined {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) {
    return undefined;
  }
  return finite.reduce((sum, v) => sum + v, 0) / finite.length;
}
