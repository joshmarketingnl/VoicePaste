import fs from 'fs';
import OpenAI from 'openai';
import { AppConfig, TranscriptionEngine } from '../shared/types';
import { joinTranscriptParts } from '../shared/transcript';
import { Logger } from '../shared/logger';
import { withRetries } from './retry';
import { LOCAL_TRANSCRIPTION_API_KEY } from '../shared/config';
import { decideLanguage, meanOf, pickMoreCertain, TranscriptionAttempt } from '../shared/languageGuard';

function httpStatus(error: unknown): number | undefined {
  const anyError = error as { status?: number; response?: { status?: number } };
  return anyError?.status ?? anyError?.response?.status;
}

function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 429 || (typeof status === 'number' && status >= 500);
}

function isClientError(error: unknown): boolean {
  const status = httpStatus(error);
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
}

export interface TranscriptionTarget {
  /** OpenAI-compatible base URL (embedded engine port, OpenAI, or custom). */
  baseUrl: string;
  apiKey: string;
}

/**
 * How much language and certainty information a backend can return:
 * - verbose: verbose_json with the language used (+ probabilities on whisper.cpp)
 * - json-logprobs: OpenAI gpt-4o(-mini)-transcribe, which has no verbose_json
 *   but can return token log-probabilities
 * - json: text only
 */
export type ResponseFlavor = 'verbose' | 'json-logprobs' | 'json';

export function responseFlavorFor(engine: TranscriptionEngine, model: string): ResponseFlavor {
  if (engine === 'local') {
    return 'verbose';
  }
  const name = model.toLowerCase();
  if (name.startsWith('whisper')) {
    return 'verbose';
  }
  if (name.includes('transcribe')) {
    return 'json-logprobs';
  }
  // Unknown model on a custom server: try verbose_json, fall back on rejection.
  return engine === 'custom' ? 'verbose' : 'json';
}

interface VerboseResponse {
  text?: string;
  language?: string;
  language_probabilities?: Record<string, number>;
  segments?: Array<{ avg_logprob?: number }>;
}

interface LogprobsResponse {
  text?: string;
  logprobs?: Array<{ logprob?: number }>;
}

async function requestAttempt(
  client: OpenAI,
  segmentPath: string,
  model: string,
  language: string | undefined,
  flavor: ResponseFlavor,
): Promise<TranscriptionAttempt> {
  const base = { file: fs.createReadStream(segmentPath), model, language };

  if (flavor === 'verbose') {
    const response = (await client.audio.transcriptions.create({
      ...base,
      response_format: 'verbose_json',
    })) as unknown as VerboseResponse;
    return {
      text: response.text ?? '',
      language: response.language,
      languageProbabilities: response.language_probabilities,
      confidence: meanOf((response.segments ?? []).map((segment) => segment.avg_logprob)),
    };
  }

  if (flavor === 'json-logprobs') {
    const response = (await client.audio.transcriptions.create({
      ...base,
      response_format: 'json',
      include: ['logprobs'],
    })) as unknown as LogprobsResponse;
    return {
      text: response.text ?? '',
      confidence: meanOf((response.logprobs ?? []).map((token) => token.logprob)),
    };
  }

  const response = await client.audio.transcriptions.create(base);
  return { text: response.text ?? '' };
}

export async function transcribeSegments(
  segmentPaths: string[],
  config: AppConfig,
  target: TranscriptionTarget,
  logger: Logger,
): Promise<string> {
  const client = new OpenAI({
    apiKey: target.apiKey || LOCAL_TRANSCRIPTION_API_KEY,
    baseURL: target.baseUrl,
  });
  let flavor = responseFlavorFor(config.engine, config.model);

  const attempt = async (segmentPath: string, language?: string): Promise<TranscriptionAttempt> => {
    const run = () => withRetries(() => requestAttempt(client, segmentPath, config.model, language, flavor), 2, 500, isRetryable);
    try {
      return await run();
    } catch (error) {
      // A server that doesn't speak verbose_json/logprobs: plain json from now on.
      if (flavor !== 'json' && isClientError(error)) {
        logger.info('Endpoint rejected rich response format; using plain json', { flavor, error: String(error) });
        flavor = 'json';
        return run();
      }
      throw error;
    }
  };

  const parts: string[] = [];
  for (const segmentPath of segmentPaths) {
    logger.info('Transcribing segment', { path: segmentPath });

    if (config.languageMode !== 'nl-en') {
      parts.push((await attempt(segmentPath, config.languageMode)).text);
      continue;
    }

    const first = await attempt(segmentPath);
    const decision = decideLanguage(first);
    if (decision.action === 'accept') {
      parts.push(first.text);
      continue;
    }

    const detected = first.language ?? 'text-check';
    if (decision.action === 'retry') {
      logger.info('Third language detected; transcribing again', { detected, forced: decision.language });
      parts.push((await attempt(segmentPath, decision.language)).text);
      continue;
    }

    logger.info('Third language detected; transcribing as Dutch and as English', { detected });
    const dutch = await attempt(segmentPath, 'nl');
    const english = await attempt(segmentPath, 'en');
    const chosen = pickMoreCertain(dutch, english, config.uiLanguage === 'en' ? 'en' : 'nl');
    logger.info('Kept the more certain transcript', {
      chosen,
      dutchConfidence: dutch.confidence,
      englishConfidence: english.confidence,
    });
    parts.push(chosen === 'nl' ? dutch.text : english.text);
  }

  return joinTranscriptParts(parts);
}
