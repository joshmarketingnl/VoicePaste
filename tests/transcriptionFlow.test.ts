import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { transcribeSegments } from '../src/main/transcription';
import { defaultConfigForPlatform } from '../src/shared/config';
import type { AppConfig } from '../src/shared/types';
import type { Logger } from '../src/shared/logger';

// A fake OpenAI-compatible /audio/transcriptions endpoint: records the form
// fields of every request and answers from a scripted queue.
interface Reply {
  status?: number;
  body: Record<string, unknown>;
}
let requests: Array<Record<string, string>> = [];
let replies: Reply[] = [];
let server: http.Server;
let baseUrl = '';

function formFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)) {
    fields[match[1]] = match[2];
  }
  return fields;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      requests.push(formFields(Buffer.concat(chunks).toString('latin1')));
      const reply = replies.shift() ?? { status: 500, body: { error: 'no scripted reply' } };
      res.writeHead(reply.status ?? 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  requests = [];
  replies = [];
});

const segment = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'voicepaste-flow-')), 'segment-0000.webm');
fs.writeFileSync(segment, Buffer.from('not really audio'));

const logger = { info: () => {}, debug: () => {}, error: () => {}, warn: () => {} } as unknown as Logger;

function config(overrides: Partial<AppConfig>): AppConfig {
  return { ...defaultConfigForPlatform('win32'), ...overrides };
}

async function run(overrides: Partial<AppConfig>): Promise<string> {
  return transcribeSegments([segment], config(overrides), { baseUrl, apiKey: '' }, logger);
}

describe('transcribeSegments in nl-en mode', () => {
  it('local engine, Dutch detected: one request, no forced language', async () => {
    replies = [{ body: { text: 'Ik denk dat het werkt.', language: 'dutch' } }];

    expect(await run({ engine: 'local', languageMode: 'nl-en' })).toBe('Ik denk dat het werkt.');
    expect(requests).toHaveLength(1);
    expect(requests[0].response_format).toBe('verbose_json');
    expect(requests[0].language).toBeUndefined();
  });

  it('local engine, Afrikaans detected: redone once, forced to the likelier Dutch', async () => {
    replies = [
      { body: { text: 'Ek dink dit werk.', language: 'afrikaans', language_probabilities: { af: 0.6, nl: 0.35, en: 0.01 } } },
      { body: { text: 'Ik denk dat het werkt.', language: 'dutch' } },
    ];

    expect(await run({ engine: 'local', languageMode: 'nl-en' })).toBe('Ik denk dat het werkt.');
    expect(requests).toHaveLength(2);
    expect(requests[1].language).toBe('nl');
  });

  it('OpenAI gpt-4o-mini-transcribe, German text: tries both and keeps the more certain', async () => {
    replies = [
      { body: { text: 'Ich habe das gestern schon gesagt, aber er hat nicht zugehört.', logprobs: [{ logprob: -0.4 }] } },
      { body: { text: 'Ik heb dat gisteren al gezegd.', logprobs: [{ logprob: -0.1 }, { logprob: -0.3 }] } },
      { body: { text: 'I said that yesterday already.', logprobs: [{ logprob: -1.2 }] } },
    ];

    const text = await run({ engine: 'openai', model: 'gpt-4o-mini-transcribe', languageMode: 'nl-en' });

    expect(text).toBe('Ik heb dat gisteren al gezegd.');
    expect(requests.map((r) => r.language)).toEqual([undefined, 'nl', 'en']);
    expect(requests[0].response_format).toBe('json');
    expect(requests[0]['include[]']).toBe('logprobs');
  });

  it('custom server without verbose_json support: falls back to plain json', async () => {
    replies = [
      { status: 400, body: { error: { message: 'response_format not supported' } } },
      { body: { text: 'Please send it before Friday, okay?' } },
    ];

    expect(await run({ engine: 'custom', model: 'some-model', languageMode: 'nl-en' })).toBe(
      'Please send it before Friday, okay?',
    );
    expect(requests).toHaveLength(2);
    expect(requests[1].response_format).toBeUndefined();
  });
});

describe('transcribeSegments with a forced language', () => {
  it('sends that language on the single request', async () => {
    replies = [{ body: { text: 'Hello there.', language: 'english' } }];

    expect(await run({ engine: 'local', languageMode: 'en' })).toBe('Hello there.');
    expect(requests).toHaveLength(1);
    expect(requests[0].language).toBe('en');
  });
});
