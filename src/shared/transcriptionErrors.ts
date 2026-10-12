/**
 * What went wrong with a transcription, in words a user can act on.
 *
 * Field data: every failure showed the same "Transcription failed." — two
 * were a wrong OpenAI key (401), four a lost connection, one a recording of
 * 0.06 s that the API rejects as too short. Only the first two are worth a
 * retry button; a too-short recording is simply "nothing heard".
 */

export type TranscriptionProblem = 'key' | 'quota' | 'offline' | 'too-short' | 'engine' | 'unknown';

export interface TranscriptionErrorLike {
  status?: number;
  response?: { status?: number };
  message?: string;
  code?: string;
  cause?: { code?: string };
}

export function classifyTranscriptionError(error: unknown): TranscriptionProblem {
  const e = (error ?? {}) as TranscriptionErrorLike;
  const status = e.status ?? e.response?.status;
  const text = `${e.message ?? ''} ${String(error)}`.toLowerCase();
  const code = (e.code ?? e.cause?.code ?? '').toUpperCase();

  if (status === 401 || status === 403 || text.includes('incorrect api key') || text.includes('missing openai_api_key')) {
    return 'key';
  }
  if (status === 429 || text.includes('quota')) {
    return 'quota';
  }
  if (status === 400 && (text.includes('shorter than') || text.includes('too short'))) {
    return 'too-short';
  }
  if (
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH'].includes(code) ||
    text.includes('connection error') ||
    text.includes('fetch failed') ||
    text.includes('network')
  ) {
    return 'offline';
  }
  if (text.includes('local engine') || text.includes('engine exited') || text.includes('engine did not become ready')) {
    return 'engine';
  }
  return 'unknown';
}

/** Problems a later attempt can fix on its own (network back, engine restarted). */
export function isWorthRetrying(problem: TranscriptionProblem): boolean {
  return problem === 'offline' || problem === 'engine' || problem === 'quota' || problem === 'unknown';
}

const MESSAGES: Record<'nl' | 'en', Record<TranscriptionProblem, string>> = {
  nl: {
    key: 'De OpenAI-sleutel klopt niet of is verlopen. Controleer hem in Instellingen. Je opname is bewaard.',
    quota: 'OpenAI weigert even (limiet of tegoed op). Je opname is bewaard; probeer het zo opnieuw.',
    offline: 'Geen verbinding met de transcriptiedienst. Je opname is bewaard; probeer het opnieuw als je weer online bent.',
    'too-short': 'De opname was te kort om iets te verstaan.',
    engine: 'De spraakmotor deed het even niet. Je opname is bewaard; probeer het opnieuw.',
    unknown: 'Transcriberen is mislukt. Je opname is bewaard; probeer het opnieuw.',
  },
  en: {
    key: 'The OpenAI key is wrong or expired. Check it in Settings. Your recording was kept.',
    quota: 'OpenAI is refusing for now (rate limit or no credit). Your recording was kept; try again shortly.',
    offline: 'No connection to the transcription service. Your recording was kept; try again when you are back online.',
    'too-short': 'The recording was too short to hear anything.',
    engine: 'The speech engine had a hiccup. Your recording was kept; try again.',
    unknown: 'Transcription failed. Your recording was kept; try again.',
  },
};

export function transcriptionErrorMessage(problem: TranscriptionProblem, uiLanguage: string): string {
  return MESSAGES[uiLanguage === 'nl' ? 'nl' : 'en'][problem];
}

export function nothingHeardMessage(uiLanguage: string): string {
  return uiLanguage === 'nl'
    ? 'Niets verstaan. Je vorige tekst staat nog klaar om te plakken.'
    : 'Nothing was heard. Your previous text is still ready to paste.';
}

export function retryLabel(uiLanguage: string): string {
  return uiLanguage === 'nl' ? 'Opnieuw proberen' : 'Try again';
}

/**
 * Which kept recordings to delete: anything older than `maxAgeMs`, and
 * beyond the newest `keep`. Input: directory names that start with an ISO-ish
 * sortable timestamp. Returns the names to remove.
 */
export function failedRecordingsToPrune(names: string[], nowMs: number, keep = 5, maxAgeMs = 7 * 24 * 3600 * 1000): string[] {
  const parsed = names
    .map((name) => {
      const m = /^(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)/.exec(name);
      return { name, at: m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : NaN };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
  return parsed.filter((item, index) => index >= keep || !Number.isFinite(item.at) || nowMs - item.at > maxAgeMs).map((item) => item.name);
}
