#!/usr/bin/env node
/**
 * End-to-end smoke test: launches the real app (built `dist/`, dev-mode
 * Electron), waits for the embedded engine to come up, posts a spoken wav to
 * the engine's OpenAI-compatible endpoint and asserts the transcript.
 *
 * This exercises the exact chain where environment bugs live: config load,
 * engine asset resolution (bundled binary + model download), whisper-server
 * spawn, HTTP readiness and transcription.
 *
 * Usage: node scripts/e2e-smoke.mjs <path-to-wav>
 * The wav should contain the spoken sentence "The quick brown fox jumps over
 * the lazy dog" (see .github/workflows/e2e-smoke.yml for TTS generation).
 */
import { spawn, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const APP_NAME = 'voicepaste-developer-beta-v1.1';
const READY_TIMEOUT_MS = 15 * 60 * 1000; // first run downloads the ~550MB model
const EXPECT_WORDS = ['quick', 'brown', 'fox', 'lazy', 'dog'];
const MIN_MATCHES = 2;

function userDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? '', APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(os.homedir(), '.config', APP_NAME);
}

function logTail(logPath, lines = 40) {
  try {
    return readFileSync(logPath, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log file)';
  }
}

function fail(message, logPath) {
  console.error(`\nSMOKE FAILED: ${message}`);
  if (logPath) {
    console.error('\n--- app.log (tail) ---');
    console.error(logTail(logPath));
  }
  process.exit(1);
}

async function main() {
  const wavPath = process.argv[2];
  if (!wavPath || !existsSync(wavPath)) {
    fail(`wav file not found: ${wavPath}`);
  }

  const electronPath = require('electron'); // resolves to the binary path in plain node
  const logPath = path.join(userDataDir(), 'logs', 'app.log');
  const startedAt = Date.now();

  console.log(`Launching app (electron: ${electronPath})`);
  const proc = spawn(electronPath, ['.', '--launch-hidden'], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const killApp = () => {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)]);
      } else {
        proc.kill('SIGKILL');
      }
    } catch { /* already gone */ }
  };
  process.on('exit', killApp);

  let appExited = false;
  proc.on('exit', (code) => {
    appExited = true;
    console.log(`App process exited (code=${code})`);
  });

  // Wait for "Local engine ready {"port":N}" written after this script started.
  console.log('Waiting for the embedded engine to become ready...');
  let port = null;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastProgressNote = 0;
  while (Date.now() < deadline) {
    if (appExited) fail('App exited before the engine became ready', logPath);
    let content = '';
    try {
      content = readFileSync(logPath, 'utf8');
    } catch { /* log not created yet */ }
    if (content) {
      // Only look at lines from this run: the app logs "App starting" on boot.
      const runStart = content.lastIndexOf('App starting');
      const recent = runStart >= 0 ? content.slice(runStart) : content;
      const ready = recent.match(/Local engine ready \{"port":(\d+)/);
      if (ready) {
        port = Number(ready[1]);
        break;
      }
      if (/Local engine failed to start/.test(recent)) {
        fail('Engine reported a startup failure', logPath);
      }
      const progress = recent.match(/"receivedBytes":(\d+)/g);
      if (progress && Date.now() - lastProgressNote > 15000) {
        lastProgressNote = Date.now();
        console.log('  (engine assets still downloading...)');
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!port) fail(`Engine not ready within ${READY_TIMEOUT_MS / 60000} minutes`, logPath);
  console.log(`Engine ready on port ${port} after ${Math.round((Date.now() - startedAt) / 1000)}s`);

  // Transcribe the wav through the same endpoint the app itself uses.
  const form = new FormData();
  form.append('file', new Blob([readFileSync(wavPath)]), 'smoke.wav');
  form.append('model', 'whisper-1');
  let text = '';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/audio/transcriptions`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) fail(`Transcription HTTP ${res.status}: ${await res.text()}`, logPath);
    const json = await res.json();
    text = String(json.text ?? '');
  } catch (error) {
    fail(`Transcription request failed: ${error}`, logPath);
  }

  const lower = text.toLowerCase();
  const matches = EXPECT_WORDS.filter((w) => lower.includes(w));
  console.log(`Transcript: ${text.trim().replace(/\s+/g, ' ')}`);
  console.log(`Matched ${matches.length}/${EXPECT_WORDS.length} expected words: ${matches.join(', ') || '(none)'}`);
  if (matches.length < MIN_MATCHES) {
    fail(`Transcript did not contain enough expected words (need ${MIN_MATCHES})`, logPath);
  }

  killApp();
  console.log('\nSMOKE PASSED');
  process.exit(0);
}

main().catch((error) => fail(String(error)));
