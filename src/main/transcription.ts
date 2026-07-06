import fs from 'fs';
import OpenAI from 'openai';
import { AppConfig } from '../shared/types';
import { joinTranscriptParts } from '../shared/transcript';
import { Logger } from '../shared/logger';
import { withRetries } from './retry';
import { LOCAL_TRANSCRIPTION_API_KEY } from '../shared/config';

function isRetryable(error: unknown): boolean {
  const anyError = error as { status?: number; response?: { status?: number } };
  const status = anyError?.status ?? anyError?.response?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export interface TranscriptionTarget {
  /** OpenAI-compatible base URL (embedded engine port, OpenAI, or custom). */
  baseUrl: string;
  apiKey: string;
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
  const parts: string[] = [];

  for (const segmentPath of segmentPaths) {
    logger.info('Transcribing segment', { path: segmentPath });
    const response = await withRetries(
      () =>
        client.audio.transcriptions.create({
          file: fs.createReadStream(segmentPath),
          model: config.model,
          language: config.languageMode === 'auto' ? undefined : config.languageMode,
        }),
      2,
      500,
      isRetryable,
    );
    parts.push(response.text ?? '');
  }

  return joinTranscriptParts(parts);
}
