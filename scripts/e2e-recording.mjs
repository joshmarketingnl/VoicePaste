#!/usr/bin/env node
/**
 * End-to-end recording test: drives the real app with a fake microphone.
 *
 * Chromium plays a wav file as if it were the microphone, so the whole chain
 * runs for real: getUserMedia -> MediaRecorder -> segments on disk -> local
 * engine -> transcript. The app runs in test mode (src/main/e2e.ts): its own
 * userData folder, no hotkeys, tray, autostart, updater or paste, so it can run
 * next to a real VoicePaste without touching it.
 *
 * Scenarios, each checked against what the user would see:
 *   normal        record, stop, transcript has the spoken words
 *   stop-paste    the paste key during recording stops, transcribes and pastes
 *   cancel        cancel throws the recording away
 *   mic-lost      microphone drops out mid-recording; what was said is kept
 *   suspend       the computer goes to sleep mid-recording; recording is finished
 *   engine-crash  whisper-server is killed; the next recording still works
 *   no-signal     a dead/blocked microphone (digital silence) is explained
 *   too-short     a recording stopped at once is explained, not an error
 *   offline       endpoint unreachable: recording kept, retry works once back
 *   long          (with --long) 100 s: segment rotation + early transcription
 *   offline-here  OpenAI/custom without a connection: done on this computer,
 *                 ended with the record key (one-key option), kept in history
 *   fast-model    the small model (PCs without NVIDIA)
 *
 * Usage: node scripts/e2e-recording.mjs --engine-source <dir> [--long] [--only a,b] [--work <dir>]
 *   <dir> holds `models/` (and on Windows+NVIDIA optionally `bin-gpu/`), e.g.
 *   the engine folder of an installed VoicePaste. Files are hard-linked (or
 *   copied) into a temporary userData folder; the source is never written.
 */
import { spawn, spawnSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const engineSource = argValue('--engine-source');
const only = argValue('--only')?.split(',');
const includeLong = args.includes('--long');
// Optional folder with extra model files (e.g. ggml-small-q5_1.bin) so the
// small-model scenario doesn't download 190 MB on every local run.
const extraModels = argValue('--extra-models');
const ENGINE_READY_MS = 15 * 60 * 1000;
const TRANSCRIBE_MS = Number(process.env.E2E_TRANSCRIBE_TIMEOUT_MS || 5 * 60 * 1000);
const EXPECT_WORDS = ['quick', 'brown', 'fox', 'lazy', 'dog'];
const NETWORK_TEXT = 'Network test passed.';

if (!engineSource || !fs.existsSync(path.join(engineSource, 'models'))) {
  console.error('Usage: node scripts/e2e-recording.mjs --engine-source <dir with models/> [--long] [--only a,b]');
  process.exit(2);
}

const workRoot = argValue('--work') ?? os.tmpdir();
fs.mkdirSync(workRoot, { recursive: true });
const work = fs.mkdtempSync(path.join(workRoot, 'voicepaste-e2e-'));
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- audio ----------

function writeWav(file, samples, rate = 16000) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

// For the long recording: all different sentences. Whisper itself folds
// identical repeats together (20 loops of one sentence come back as 4), so a
// looped sentence can't show whether a segment went missing.
const LONG_TEXT = [
  'On Monday morning the bakery on the corner opened an hour later than usual.',
  'A delivery van had blocked the street while the driver searched for an address.',
  'Inside, the owner counted the loaves and wrote the prices on a small chalkboard.',
  'Her first customer was a teacher who always bought two croissants and a newspaper.',
  'They talked about the weather, which had turned cold and windy during the night.',
  'Later a group of students came in to escape the rain before their exams started.',
  'One of them spilled coffee on a notebook full of chemistry formulas.',
  'The owner gave him a towel and a free cookie to make up for the bad luck.',
  'Around noon the oven made a strange noise and the kitchen filled with smoke.',
  'A technician arrived within thirty minutes and replaced a broken fan.',
  'He explained that the motor had been running too hot for several weeks.',
  'In the afternoon a tourist asked for directions to the old harbour and the museum.',
  'The owner drew a simple map on the back of a receipt and circled the bridge.',
  'Business was quiet after three, so she cleaned the shelves and ordered more flour.',
  'Her nephew called to say that the football match had been cancelled because of the storm.',
  'At five o clock the regular evening crowd arrived for bread and apple pie.',
  'A neighbour brought back the umbrella he had borrowed the previous week.',
  'By seven the shop was empty and the owner turned off the lights in the window.',
  'She walked home along the canal, thinking about a new recipe with walnuts and honey.',
  'The next morning she would try it out and ask the teacher what she thought of it.',
  'Meanwhile the delivery driver finally found the address he had been looking for.',
  'It turned out to be a small office above the pharmacy on the other side of town.',
  'The parcel contained twelve green chairs for a meeting room that was still being painted.',
  'Nobody had expected them so early, so the chairs waited in the hallway all day.',
  'A cleaner moved them twice before somebody finally signed for the delivery.',
  'When the painters left, the manager arranged the chairs around a long wooden table.',
  'The first meeting in the new room was about a summer festival in the city park.',
  'Volunteers promised to bring tents, lamps, a sound system and plenty of lemonade.',
  'The bakery was asked to provide cakes, and the owner happily agreed to help.',
].join(' ');

function makeSpeechWav(file, sentence = 'The quick brown fox jumps over the lazy dog.') {
  if (process.platform === 'win32') {
    const ps = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      "$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)",
      `$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}', $fmt)`,
      `$s.Speak('${sentence.replace(/'/g, "''")}')`,
      '$s.Dispose()',
    ].join('; ');
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  } else if (process.platform === 'darwin') {
    const aiff = file.replace(/\.wav$/, '.aiff');
    spawnSync('say', ['-o', aiff, sentence], { stdio: 'inherit' });
    spawnSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, file], { stdio: 'inherit' });
  }
  if (!fs.existsSync(file)) throw new Error('Could not make the spoken test wav (no TTS on this platform)');
  // Half a second of quiet between repeats: the fake microphone loops the file.
  const pcm = fs.readFileSync(file).subarray(44);
  const samples = Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2));
  writeWav(file, [...samples, ...new Array(8000).fill(0)]);
}

// ---------- app ----------

function linkTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) linkTree(from, to);
    else {
      try {
        fs.linkSync(from, to);
      } catch {
        fs.copyFileSync(from, to);
      }
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function launch(name, { wav, config }) {
  const userData = path.join(work, name);
  linkTree(engineSource, path.join(userData, 'engine'));
  if (extraModels) linkTree(extraModels, path.join(userData, 'engine', 'models'));
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ uiLanguage: 'en', ...config }, null, 2));
  const port = await freePort();
  const electronPath = require('electron');
  const proc = spawn(electronPath, ['.', '--launch-hidden'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      VOICEPASTE_E2E: '1',
      VOICEPASTE_USER_DATA_DIR: userData,
      VOICEPASTE_FAKE_MIC: wav,
      VOICEPASTE_E2E_PORT: String(port),
    },
  });
  let exited = false;
  proc.on('exit', () => {
    exited = true;
  });
  const app = {
    name,
    userData,
    logPath: path.join(userData, 'logs', 'app.log'),
    seen: 0,
    get exited() {
      return exited;
    },
    async cmd(command) {
      if (exited) throw new Error('app is no longer running');
      const res = await fetch(`http://127.0.0.1:${port}/cmd/${command}`);
      const json = await res.json();
      if (!json.ok) throw new Error(`${command}: ${json.error}`);
      return json.result;
    },
    async events() {
      const res = await fetch(`http://127.0.0.1:${port}/events`);
      return res.json();
    },
    /** Wait for the first event after `seen` that matches; returns it. */
    async waitFor(label, match, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (exited) throw new Error(`app exited while waiting for ${label}`);
        const all = await app.events();
        const hit = all.slice(app.seen).find(match);
        if (hit) return hit;
        await sleep(250);
      }
      throw new Error(`timed out waiting for ${label}`);
    },
    /** Everything that happened since the last mark. */
    async since() {
      const all = await app.events();
      return all.slice(app.seen);
    },
    async mark() {
      app.seen = (await app.events()).length;
    },
    async waitState(state, timeoutMs = 15000) {
      return app.waitFor(`state ${state}`, (e) => e.state === state, timeoutMs);
    },
    async quit() {
      try {
        await app.cmd('quit');
      } catch {
        /* already gone */
      }
      const deadline = Date.now() + 15000;
      while (!exited && Date.now() < deadline) await sleep(200);
      if (!exited) {
        if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)]);
        else proc.kill('SIGKILL');
      }
    },
    kill() {
      if (exited) return;
      if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)]);
      else proc.kill('SIGKILL');
    },
  };
  process.on('exit', () => app.kill());

  // Control server up and the window loaded (its script handles the commands)?
  const deadline = Date.now() + 60000;
  for (;;) {
    if (exited) throw new Error(`${name}: app exited during start-up\n${logTail(app.logPath)}`);
    try {
      if ((await app.cmd('state')).windowLoaded) break;
      throw new Error('window still loading');
    } catch {
      if (Date.now() > deadline) throw new Error(`${name}: control server never came up\n${logTail(app.logPath)}`);
      await sleep(500);
    }
  }
  if (config.engine === 'local') {
    const engineDeadline = Date.now() + ENGINE_READY_MS;
    let state = await app.cmd('state');
    while (state.engine !== 'ready') {
      if (Date.now() > engineDeadline || state.engine === 'error') {
        throw new Error(`${name}: engine not ready (${state.engine})\n${logTail(app.logPath)}`);
      }
      await sleep(1000);
      state = await app.cmd('state');
    }
  }
  return app;
}

function logTail(file, lines = 30) {
  try {
    return fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
}

function countWords(text) {
  const lower = String(text ?? '').toLowerCase();
  return EXPECT_WORDS.filter((w) => lower.includes(w)).length;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function scenario(app, name, fn) {
  if (only && !only.includes(name)) return;
  const startedAt = Date.now();
  process.stdout.write(`- ${name} ... `);
  try {
    await app.mark();
    const detail = await fn();
    const ms = Date.now() - startedAt;
    results.push({ name, ok: true, ms, detail: detail ?? null });
    console.log(`ok (${(ms / 1000).toFixed(1)} s)${detail ? ` ${JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    const ms = Date.now() - startedAt;
    const events = await app.since().catch(() => []);
    results.push({ name, ok: false, ms, error: String(error?.message ?? error), events });
    console.log(`FAILED: ${error?.message ?? error}`);
    console.log(`  events: ${JSON.stringify(events)}`);
    console.log(logTail(app.logPath, 15).replace(/^/gm, '  | '));
    // Leave the app in a known state for the next scenario.
    await app.cmd('cancel').catch(() => {});
    await sleep(1500);
  }
}

/**
 * After a launch: nothing uncaught, and never two engines at once (each
 * start must follow the previous process's exit).
 */
function checkLog(app) {
  if (only && !only.includes('log')) return;
  const log = fs.readFileSync(app.logPath, 'utf8');
  const uncaught = log.split(/\r?\n/).filter((l) => /Uncaught exception|Unhandled rejection/.test(l));
  const starts = (log.match(/Local engine ready/g) ?? []).length;
  const exits = (log.match(/Engine process exited/g) ?? []).length;
  const crashes = (log.match(/"code":3221225477/g) ?? []).length;
  const ok = !uncaught.length && starts <= exits + 1;
  results.push({ name: `log:${app.name}`, ok, detail: { starts, exits, crashes, uncaught } });
  console.log(`- log:${app.name} ... ${ok ? 'ok' : 'FAILED'} ${JSON.stringify({ starts, exits, crashes, uncaught: uncaught.length })}`);
  uncaught.forEach((l) => console.log(`  | ${l}`));
}

/** Record `seconds`, then end it with `how`; returns the transcript event. */
async function dictate(app, seconds, how = 'stop') {
  await app.cmd('record');
  await app.waitState('recording');
  await sleep(seconds * 1000);
  await app.cmd(how);
  return app.waitFor('a transcript or an error', (e) => 'transcript' in e || e.state === 'error', TRANSCRIBE_MS);
}

// ---------- fake transcription endpoint (for the offline scenario) ----------

function fakeEndpoint(port) {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ text: NETWORK_TEXT }));
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// ---------- run ----------

async function main() {
  const speech = path.join(work, 'speech.wav');
  const silence = path.join(work, 'silence.wav');
  makeSpeechWav(speech);
  writeWav(silence, new Array(16000 * 3).fill(0));
  console.log(`Work folder: ${work}`);

  // 1. A working microphone and the local engine.
  console.log('\n[speech] local engine, spoken sentence as microphone');
  let app = await launch('speech', { wav: speech, config: { engine: 'local' } });
  await scenario(app, 'normal', async () => {
    const hit = await dictate(app, 6);
    assert('transcript' in hit, `expected a transcript, got ${JSON.stringify(hit)}`);
    assert(countWords(hit.transcript) >= 2, `transcript lacks the spoken words: "${hit.transcript}"`);
    return { words: countWords(hit.transcript) };
  });
  await scenario(app, 'stop-paste', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(5000);
    await app.cmd('stop-paste');
    const hit = await app.waitFor('paste', (e) => 'paste' in e || e.state === 'error', TRANSCRIBE_MS);
    assert('paste' in hit, `expected a paste, got ${JSON.stringify(hit)}`);
    assert(countWords(hit.paste) >= 2, `pasted text lacks the spoken words: "${hit.paste}"`);
  });
  await scenario(app, 'cancel', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(2000);
    await app.cmd('cancel');
    await sleep(3000);
    const events = await app.since();
    assert(!events.some((e) => 'transcript' in e), 'a cancelled recording was transcribed');
    assert(!events.some((e) => e.state === 'error'), `cancel showed an error: ${JSON.stringify(events)}`);
  });
  await scenario(app, 'mic-lost', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(4000);
    await app.cmd('drop-mic');
    const hit = await app.waitFor('transcript', (e) => 'transcript' in e || e.state === 'error', TRANSCRIBE_MS);
    const events = await app.since();
    assert(events.some((e) => /dropped out/.test(e.message ?? '')), 'no "microphone dropped out" explanation shown');
    assert('transcript' in hit && countWords(hit.transcript) >= 1, `what was said before the drop was lost: ${JSON.stringify(hit)}`);
  });
  await scenario(app, 'suspend', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(4000);
    await app.cmd('suspend');
    const hit = await app.waitFor('transcript', (e) => 'transcript' in e || e.state === 'error', TRANSCRIBE_MS);
    assert('transcript' in hit && countWords(hit.transcript) >= 1, `recording lost on sleep: ${JSON.stringify(hit)}`);
  });
  await scenario(app, 'engine-crash', async () => {
    const pid = await app.cmd('kill-engine');
    assert(pid, 'engine was not running');
    await sleep(500);
    const hit = await dictate(app, 5);
    assert('transcript' in hit && countWords(hit.transcript) >= 1, `no transcript after an engine crash: ${JSON.stringify(hit)}`);
    return { killedPid: pid };
  });
  await app.quit();
  checkLog(app);

  if (includeLong && (!only || only.includes('long'))) {
    console.log('\n[long] local engine, 100 s of different sentences');
    const longWav = path.join(work, 'long.wav');
    makeSpeechWav(longWav, LONG_TEXT);
    const seconds = (fs.statSync(longWav).size - 44) / 32000;
    app = await launch('long', { wav: longWav, config: { engine: 'local' } });
    await scenario(app, 'long', async () => {
      // Longer than one 90 s segment: rotation, and the first segment is
      // transcribed while the user is still talking.
      // The whole text once (and past the 90 s segment limit).
      const hit = await dictate(app, Math.max(95, Math.ceil(seconds) + 1));
      assert('transcript' in hit, `expected a transcript, got ${JSON.stringify(hit)}`);
      const words = (t) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? []);
      const said = words(LONG_TEXT);
      const heard = words(hit.transcript);
      const found = [...said].filter((w) => heard.has(w)).length;
      const coverage = found / said.size;
      // A lost 90 s segment would leave well under half; misheard words a few percent.
      assert(coverage >= 0.85, `only ${Math.round(coverage * 100)}% of the spoken words came back`);
      const log = fs.readFileSync(app.logPath, 'utf8');
      const segments = new Set(log.match(/segment-\d{4}\.webm/g) ?? []).size;
      assert(segments >= 2, `expected the recording to rotate into 2 segments, saw ${segments}`);
      return { audioSeconds: Math.round(seconds), coverage: Math.round(coverage * 100) / 100, segments };
    });
    await app.quit();
    checkLog(app);
  }

  // 2. A dead microphone: digital silence.
  console.log('\n[silence] local engine, silent microphone');
  app = await launch('silence', { wav: silence, config: { engine: 'local' } });
  await scenario(app, 'no-signal', async () => {
    const hit = await dictate(app, 3);
    assert(hit.state === 'error', `expected an explanation, got ${JSON.stringify(hit)}`);
    assert(/No sound came in/.test(hit.message ?? ''), `expected the no-signal explanation, got "${hit.message}"`);
  });
  await scenario(app, 'too-short', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(300);
    await app.cmd('stop');
    const hit = await app.waitFor('outcome', (e) => 'transcript' in e || e.state === 'error' || e.state === 'idle', TRANSCRIBE_MS);
    assert(
      'transcript' in hit || hit.state === 'idle' || /Nothing was heard|No sound came in/.test(hit.message ?? ''),
      `a too-short recording looked like a failure: "${hit.message}"`,
    );
    const state = await app.cmd('state');
    return { outcome: hit.message ?? hit.state ?? 'transcript', stateAfter: state.state };
  });
  await app.quit();
  checkLog(app);

  // 3. The transcription endpoint is unreachable, then comes back.
  console.log('\n[offline] custom endpoint that is down, then up');
  const endpointPort = await freePort();
  app = await launch('offline', {
    wav: speech,
    // Without the offline reserve: the recording must be kept for a retry.
    config: { engine: 'custom', provider: `http://127.0.0.1:${endpointPort}/v1`, apiKey: 'e2e-test', offlineFallback: false },
  });
  await scenario(app, 'offline', async () => {
    const hit = await dictate(app, 3);
    assert(hit.state === 'error', `expected an error while offline, got ${JSON.stringify(hit)}`);
    assert(hit.action === 'retry-failed', `no "Try again" offered: ${JSON.stringify(hit)}`);
    const failedDir = path.join(app.userData, 'failed');
    const kept = fs.existsSync(failedDir) ? fs.readdirSync(failedDir) : [];
    assert(kept.length === 1, `expected the recording to be kept, found ${kept.length}`);
    const server = await fakeEndpoint(endpointPort);
    try {
      await app.mark();
      await app.cmd('retry');
      const again = await app.waitFor('retry', (e) => 'transcript' in e || e.state === 'error', TRANSCRIBE_MS);
      assert(again.transcript === NETWORK_TEXT, `retry did not deliver: ${JSON.stringify(again)}`);
      assert(!fs.readdirSync(failedDir).length, 'kept recording was not cleaned up after a successful retry');
      return { message: hit.message };
    } finally {
      server.close();
    }
  });
  await app.quit();
  checkLog(app);

  // 4. OpenAI/custom without a connection, with the 2.0 options switched on.
  console.log('\n[offline-here] endpoint down, offline reserve on, one-key dictation, history');
  const deadPort = await freePort();
  app = await launch('offline-here', {
    wav: speech,
    config: {
      engine: 'custom',
      provider: `http://127.0.0.1:${deadPort}/v1`,
      apiKey: 'e2e-test',
      offlineFallback: true,
      recordKeyPastes: true,
      keepHistory: true,
    },
  });
  await scenario(app, 'offline-here', async () => {
    await app.cmd('record');
    await app.waitState('recording');
    await sleep(5000);
    await app.cmd('record'); // the record key again: stop, transcribe and paste
    const hit = await app.waitFor('paste', (e) => 'paste' in e || e.state === 'error', TRANSCRIBE_MS);
    assert('paste' in hit, `expected a paste done on this computer, got ${JSON.stringify(hit)}`);
    assert(countWords(hit.paste) >= 2, `pasted text lacks the spoken words: "${hit.paste}"`);
    const events = await app.since();
    assert(events.some((e) => /on this computer/.test(e.message ?? '')), 'no "transcribing on this computer" message');
    const state = await app.cmd('state');
    assert(state.history?.[0] === hit.paste, `not in the history: ${JSON.stringify(state.history)}`);
    return { words: countWords(hit.paste) };
  });
  await app.quit();
  checkLog(app);

  // 5. The small model (what a PC without NVIDIA gets automatically).
  console.log('\n[fast-model] local engine with the small model');
  app = await launch('fast-model', { wav: speech, config: { engine: 'local', localModel: 'fast' } });
  await scenario(app, 'fast-model', async () => {
    const hit = await dictate(app, 6);
    assert('transcript' in hit, `expected a transcript, got ${JSON.stringify(hit)}`);
    assert(countWords(hit.transcript) >= 2, `transcript lacks the spoken words: "${hit.transcript}"`);
    const log = fs.readFileSync(app.logPath, 'utf8');
    assert(/Local engine ready \{[^}]*"model":"small"/.test(log), 'engine did not run the small model');
    return { words: countWords(hit.transcript) };
  });
  await app.quit();
  checkLog(app);

  const failed = results.filter((r) => !r.ok);
  const report = { platform: `${process.platform}-${process.arch}`, at: new Date().toISOString(), results };
  fs.writeFileSync(path.join(work, 'e2e-results.json'), JSON.stringify(report, null, 2));
  if (process.env.E2E_RESULTS) fs.writeFileSync(process.env.E2E_RESULTS, JSON.stringify(report, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed. Results: ${path.join(work, 'e2e-results.json')}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nE2E FAILED: ${error?.stack ?? error}`);
  process.exit(1);
});
