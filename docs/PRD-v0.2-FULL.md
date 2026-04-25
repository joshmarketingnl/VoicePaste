# VoicePaste v0.2 PRD

## Summary
VoicePaste is a local desktop utility that records speech on a global hotkey, transcribes via OpenAI, and pastes into any focused app. v0.2 improves indicator visibility/control, adds a cancel-recording hotkey, and strengthens reliability while preserving v0.1 behavior.

## Goals
- Indicator is visible at app start and positioned top-left.
- Indicator can be hidden via a small UI button and shown again by tray click.
- Add a restart button in the indicator UI.
- Add a hotkey to stop recording without transcription (cancel).
- Improve paste failure handling with a clear fallback message.

## Non-goals
- No transcript history or timestamps.
- No UI redesign beyond small controls.
- No new transcription providers or formats.

## Target Platforms
- macOS (primary).
- Windows (secondary; build + run + hotkeys + paste).
- Linux is out of scope but not intentionally blocked.

## UX Flows
### Record
1) User presses global hotkey to start recording.
2) Indicator shows Recording + timer.
3) User presses same hotkey to stop.
4) App transcribes and moves to Ready.

### Paste
1) User presses paste hotkey.
2) App copies transcript to clipboard and simulates paste.
3) If paste fails, keep transcript in clipboard and show "Copied; press Cmd+V/Ctrl+V".

### Cancel (stop without transcription)
1) User presses cancel hotkey while recording.
2) Recording stops, audio segments are discarded.
3) State returns to Idle without transcription.

### Hide / Show indicator
- Hide button hides the indicator window.
- Clicking tray/menu-bar icon shows it again.

### Restart
- Restart button triggers app relaunch.

### Errors
- API errors and permission issues show in the indicator and logs.

## Hotkeys Defaults + Configuration
macOS defaults:
- Toggle record/stop+transcribe: Ctrl+Option+R
- Paste last transcript: Ctrl+Option+V
- Cancel recording (no transcription): Command+Option+S

Windows defaults:
- Toggle record/stop+transcribe: Ctrl+Alt+R
- Paste last transcript: Ctrl+Alt+V
- Cancel recording (no transcription): Ctrl+Alt+S

Hotkeys are configurable in `config.json`.

## Recording & Chunking Strategy
- Use `getUserMedia` + `MediaRecorder` in the renderer.
- Rotate segments by size (20MB) or time (90s) to stay under 25MB limit.
- On rotation, restart `MediaRecorder` to ensure each segment is a valid file.
- On stop, transcribe segments sequentially and join with normalized whitespace.

## OpenAI API Usage + Retry Policy
- Endpoint: `/v1/audio/transcriptions` using the official OpenAI Node SDK.
- Model is configurable; default `gpt-4o-mini-transcribe`.
- Optional `language` setting when not `auto`.
- Retry transient errors (429/5xx) with exponential backoff (2 retries).

## Paste Automation + Permissions
- Clipboard is set to transcript, then paste keystroke simulated.
- macOS: `osascript` with System Events (Cmd+V).
- Windows: PowerShell `WScript.Shell.SendKeys('^v')`.
- If paste fails, keep transcript in clipboard and show fallback guidance.
- Document macOS Accessibility/Automation permissions and Windows privilege caveats.

## Config Format (JSON schema-like)
```json
{
  "hotkeys": {
    "toggleRecord": "Ctrl+Option+R",
    "pasteTranscript": "Ctrl+Option+V",
    "cancelRecording": "Command+Option+S"
  },
  "model": "gpt-4o-mini-transcribe",
  "languageMode": "auto",
  "restoreClipboard": true,
  "indicator": "showAlways",
  "diagnostics": false,
  "apiKey": "sk-..."
}
```

## Logging & Diagnostics
- Logs written to `logs/app.log` in userData.
- Log state transitions, errors, hide/show, restart events.
- `diagnostics=true` enables verbose logs.

## Security / Secrets
- Prefer `OPENAI_API_KEY` env var.
- Allow `apiKey` in config as a local convenience.

## Packaging Strategy
- Electron packaging via `electron-builder`.
- macOS: ZIP (DMG optional if hdiutil is available).
- Windows: NSIS + ZIP.
- No code signing required for local use; document Gatekeeper steps.

## Acceptance Criteria
- Indicator visible on app start and positioned top-left.
- Hide button hides indicator; tray click shows it again.
- Restart button relaunches the app.
- Cancel hotkey stops recording without transcription.
- Long recordings are chunked without exceeding 25MB.
- Paste failure shows fallback guidance and keeps transcript in clipboard.
- macOS build runs; Windows build instructions remain valid.

## Assumptions & Open Questions
- Assumption: Missing `docs/requirements.md`/`docs/PRD-v0.2.md` were derived from existing v0.2 notes.
- Assumption: Indicator default is `showAlways` in v0.2; users can hide via UI.
- Open question: None currently; add here if new behavior needs confirmation.
