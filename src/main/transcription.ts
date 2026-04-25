import fs from 'fs';
import OpenAI from 'openai';
import { AppConfig } from '../shared/types';
import { joinTranscriptParts } from '../shared/transcript';
import { Logger } from '../shared/logger';
import { withRetries } from './retry';
import { DEFAULT_PROVIDER, LOCAL_TRANSCRIPTION_API_KEY } from '../shared/config';

function isRetryable(error: unknown): boolean {
  const anyError = error as { status?: number; response?: { status?: number } };
  const status = anyError?.status ?? anyError?.response?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export async function transcribeSegments(
  segmentPaths: string[],
  config: AppConfig,
  apiKey: string,
  logger: Logger,
): Promise<string> {
  const provider = config.provider?.trim() || DEFAULT_PROVIDER;
  const client = new OpenAI({ apiKey: apiKey || LOCAL_TRANSCRIPTION_API_KEY, baseURL: provider });
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
