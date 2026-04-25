# VoicePaste PRD

## 1. Summary
VoicePaste is a small desktop utility that runs locally and lets the user:
- Press a global hotkey to start/stop microphone recording (toggle).
- On stop, transcribe speech to text using OpenAI's Audio Transcriptions API.
- Press a second global hotkey to paste/insert the last transcript into the app with focus.

Primary target: macOS (latest). Secondary: Windows (build + run + hotkeys + paste). This is not SaaS; reliability and "just works" are the priority.

## 2. Platforms
- Must work on macOS (latest).
- Should work on Windows (build/run/hotkeys/paste).
- Linux is out of scope, but avoid hard blockers.

## 3. Keybinds (defaults, configurable)
macOS defaults:
- Toggle record/stop+transcribe: Ctrl+Option+R
- Paste last transcript: Ctrl+Option+V

Windows defaults:
- Toggle record/stop+transcribe: Ctrl+Alt+R
- Paste last transcript: Ctrl+Alt+V

Keybinds must be configurable via a simple JSON config file (no full UI required). A tiny "Settings" window/menu is optional if it meaningfully reduces friction.

## 4. UX / UI
- App runs in background (tray/menu bar).
- Small floating always-on-top indicator showing state:
  - Idle
  - Recording (with timer)
  - Transcribing (spinner)
  - Ready (short preview or "Ready to paste")
  - Error (short message)
- No transcript history.
- No timestamps.

## 5. Recording
- Use default system microphone.
- Toggle behavior: first press starts recording immediately; second press stops, finalizes audio, and starts transcription.
- "Unlimited" recording via chunking to stay under API size limits.
  - Audio Transcriptions uploads limited to 25 MB/file.
  - Chunk by size and time to stay under limit; on stop transcribe all segments in order and join.

## 6. Transcription (OpenAI API only)
- Use OpenAI Audio Transcriptions endpoint: `/v1/audio/transcriptions`.
- Use official OpenAI SDK for Node.
- Models supported include `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` (configurable model, sane default).
- Language: auto-detect by default; optional manual override for Dutch/English/Spanish.
- Output must be verbatim (what was said), not summarized.
- Robust retries for transient errors (e.g., 2 retries with backoff).

## 7. Paste / Insert behavior
Primary mechanism: clipboard + simulated paste keystroke.
- Put transcript into clipboard.
- Trigger paste keystroke in focused app.
- Optionally restore previous clipboard after a short delay (default ON).

Requirements:
- Must work in chat apps, Terminal, IDEs, and browser text inputs.
- macOS paste simulation: use AppleScript/System Events (osascript) to send Cmd+V after setting clipboard.
  - Document Accessibility/Automation permissions in README.
- Windows paste simulation: PowerShell + WScript.Shell SendKeys for Ctrl+V (avoid native deps).
- If paste fails, show error in indicator and keep transcript in clipboard.

## 8. Security / Secrets
- Prefer `OPENAI_API_KEY` environment variable.
- If missing, allow saving in local config (plain text acceptable) with clear warning.
- No data retention features needed.

## 9. Packaging / Build
- Electron app packaged for macOS (DMG or ZIP) and Windows (NSIS or ZIP).
- Scripts: `npm run dev`, `npm run build`, `npm run package:mac`, `npm run package:win`.
- No code-signing/notarization required; document Gatekeeper steps.

## 10. Observability
- Local logs only: `logs/app.log` (rotating if easy).
- Include state transitions, errors, and last action.
- Optional "Copy debug info" action.

## 11. Acceptance Criteria
- Global hotkeys work system-wide.
- Recording indicator appears and reflects state.
- Stop -> transcription completes -> transcript stored and ready.
- Paste hotkey inserts transcript into focused app reliably.
- Long recordings work via chunking without exceeding 25MB/file.
- macOS build runs; Windows build instructions work.
