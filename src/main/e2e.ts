import { app } from 'electron';
import http from 'http';

/**
 * Test mode for the end-to-end recording test (scripts/e2e-recording.mjs).
 *
 * Only active with VOICEPASTE_E2E=1. The app then runs in its own userData
 * folder (so it never touches a real install, and gets its own single-instance
 * lock), hears a wav file instead of a microphone, and leaves the machine
 * alone: no hotkeys, autostart, tray, cursor indicator, notifications,
 * updater or paste. A small control server on 127.0.0.1 lets the test press
 * the buttons and read back what the user would have seen.
 */
export const isE2E = process.env.VOICEPASTE_E2E === '1';

/** Must run before anything reads userData (crash reporter, lock, logs). */
export function prepareE2eProcess(): void {
  if (!isE2E) {
    return;
  }
  const userDataDir = process.env.VOICEPASTE_USER_DATA_DIR;
  if (userDataDir) {
    app.setPath('userData', userDataDir);
  }
  const fakeMicWav = process.env.VOICEPASTE_FAKE_MIC;
  if (fakeMicWav) {
    app.commandLine.appendSwitch('use-fake-device-for-media-stream');
    app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
    app.commandLine.appendSwitch('use-file-for-fake-audio-capture', fakeMicWav);
    if (process.platform === 'darwin') {
      // macOS: the sandboxed audio service may not read the wav ("Failed to
      // read ... as input to the fake device"); the app then hears silence.
      app.commandLine.appendSwitch('no-sandbox');
    }
  }
}

const events: Array<Record<string, unknown>> = [];

/** Record what the user would see (state line, transcript, paste). */
export function e2eEvent(event: Record<string, unknown>): void {
  if (isE2E) {
    events.push({ at: Date.now(), ...event });
  }
}

export type E2eCommands = Record<string, () => unknown>;

export function startE2eControl(commands: E2eCommands, log: (message: string, meta?: Record<string, unknown>) => void): void {
  if (!isE2E) {
    return;
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/events') {
      res.end(JSON.stringify(events.slice(Number(url.searchParams.get('since') ?? 0))));
      return;
    }
    const command = commands[url.pathname.replace(/^\/cmd\//, '')];
    if (!command) {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: 'unknown command' }));
      return;
    }
    Promise.resolve()
      .then(() => command())
      .then((result) => res.end(JSON.stringify({ ok: true, result: result ?? null })))
      .catch((error) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      });
  });
  server.listen(Number(process.env.VOICEPASTE_E2E_PORT || 0), '127.0.0.1', () => {
    const address = server.address();
    log('E2E control listening', { port: typeof address === 'object' && address ? address.port : null });
  });
}
