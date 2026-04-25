# VoicePaste

VoicePaste is a small desktop utility that lets you record speech with a global hotkey, transcribe via OpenAI or a local OpenAI-compatible transcription server, and paste the result into any focused app.

## Requirements
- Node.js 18+ (Node 20 recommended)
- macOS (primary) or Windows (secondary)
- An OpenAI API key (ENV `OPENAI_API_KEY` preferred), unless using a local OpenAI-compatible transcription server

## Install
```bash
npm install
```

## Run (dev)
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Package
```bash
# macOS
npm run package:mac

# Windows x64 (default public build)
npm run package:win

# Windows arm64
npm run package:win:arm64

# Windows x64 + arm64
npm run package:win:all
```

Artifacts are emitted to the `release/` folder (macOS ZIP by default).
On Windows, run the NSIS installer (or use the ZIP) from that folder.
The default Windows packaging lane now targets `x64`.
Cross-packaging from macOS works, but final smoke validation should still happen on a real Windows machine.

## Gatekeeper (macOS)
If the packaged app is blocked, run one of these options:
- Right-click the app and choose Open
- Or remove quarantine attributes:
```bash
xattr -dr com.apple.quarantine /Applications/VoicePaste\ v0.5.app
```

## Configuration
Config lives in the app userData folder as `config.json`:
- macOS: `~/Library/Application Support/voicepaste-v0.5/config.json`
- Windows: `%APPDATA%\\voicepaste-v0.5\\config.json`

Example:
```json
{
  "hotkeys": {
    "toggleRecord": "Command+Option+R",
    "pasteTranscript": "Command+Option+V",
    "cancelRecording": "Command+Option+S",
    "stopAndTranscribe": "Command+Option+C",
    "showControlWindow": "Command+Option+M"
  },
  "provider": "https://api.openai.com/v1",
  "model": "gpt-4o-mini-transcribe",
  "developerMode": false,
  "uiLanguage": "en",
  "languageMode": "auto",
  "restoreClipboard": true,
  "indicator": "showAlways",
  "diagnostics": false
}
```

If `OPENAI_API_KEY` is not set, the app can store `apiKey` in this file (plain text). This is acceptable for local use but not ideal.
For local providers on `localhost`, `127.0.0.1`, or `[::1]`, no API key is required.
On first v0.5 launch, if v0.5 config is missing, VoicePaste automatically imports your v0.4 config.
You can also edit `apiKey`, record hotkey, paste hotkey, developer mode (`provider` + `model`), and UI language from the in-app `Settings` button.
Settings now also expose cancel, stop+transcribe, and show-window hotkeys.

## Local transcription
Recommended small local setup:
- Run an OpenAI-compatible Whisper server locally, for example `faster-whisper-server` or `whisper.cpp`.
- In VoicePaste Settings, enable developer mode.
- Set provider to `http://localhost:8000/v1`.
- Set model to the local model exposed by the server.
- Leave API key empty.

Good starting models:
- `base` / `base.en`: small, fast, usually good enough for clean short dictation.
- `small` / `small.en`: better accuracy, still practical on modern laptops.

Example with `faster-whisper-server`:
```bash
pip install faster-whisper-server
faster-whisper-server base --host 127.0.0.1 --port 8000
```

If a server expects a non-empty key even for local use, VoicePaste sends a local dummy key internally.

## Defaults
- macOS: control window shows on app launch near the top-left.
- Windows: manual launches show the control window near the tray; startup launches open hidden in the tray.
- Closing the control window hides it; the app keeps running in the menu bar.
- Click the tray/menu-bar icon to open the context menu, then choose `Show VoicePaste` to show/focus the control window.
- Windows packaged builds register open-at-login and start hidden in the tray.
- Cursor indicator is the primary live status:
- `recording`: small red dot near cursor
- `transcribing`: small spinner near cursor
- `ready`: small checkmark near cursor (auto-hide after 15s, or hide on VoicePaste paste action)
- `error`: small red cross near cursor (shows for 5s)
- macOS packaged app runs as a menu bar utility and enables open-at-login.
- macOS hotkeys: Command+Option+R (toggle record/stop+transcribe), Command+Option+C (stop+transcribe), Command+Option+V (smart paste: during recording/transcribing it queues exactly one auto-paste after transcription), Command+Option+S (cancel without transcription), Command+Option+M (show/focus control window)
- Windows hotkeys: Ctrl+Alt+R (toggle record/stop+transcribe), Ctrl+Alt+C (stop+transcribe), Ctrl+Alt+V (smart paste: during recording/transcribing it queues exactly one auto-paste after transcription), Ctrl+Alt+S (cancel without transcription), Ctrl+Alt+M (show/focus control window)
- Windows tray behavior: left-click toggles show/hide, right-click opens the tray menu, and the tray menu exposes start/stop, paste, settings, logs, restart, and quit actions.
- Error fail-safe: when the app enters an error path, it automatically relaunches (with loop guard to avoid restart thrashing).

## Permissions (macOS)
- Microphone access (System Settings > Privacy & Security > Microphone)
- Accessibility access (for simulated paste)
- Automation permission for `System Events`/`osascript` if prompted

## Permissions (Windows)
- Ensure PowerShell is available (default on Windows).
- If paste fails in elevated apps, run VoicePaste at the same privilege level.
- If the tray icon is not visible immediately, check the hidden-icons arrow in the Windows notification area.

## Troubleshooting
- If paste doesn't work, ensure Accessibility permissions are granted to VoicePaste.
- If cloud transcription fails, confirm `OPENAI_API_KEY` is set or `apiKey` in config.
- If local transcription fails, confirm the local server is running and the provider URL includes `/v1`.
- Check logs at `logs/app.log` in the userData folder.
- If paste fails, the transcript remains in your clipboard; press Cmd+V/Ctrl+V manually.
- If the app hits repeated fatal errors, auto-restart may be suppressed by loop guard; inspect `logs/app.log` and use the UI restart button after fixing root cause.

## Scripts
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run package:win`
- `npm run package:win:arm64`
