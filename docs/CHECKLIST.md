# VoicePaste Checklist

## Docs
- [x] Write `docs/PRD.md`
- [x] Write `docs/CHECKLIST.md`
- [x] Write `docs/PROGRESS.md` with initial timestamp
- [x] Write `docs/ARCHITECTURE.md`
- [x] Write `docs/TEST_PLAN.md`
- [x] Write `README.md` (install/run/build/permissions/troubleshooting)
- [x] Write `AGENTS.md` (repo working rules)

## Repo Setup
- [x] Initialize Node/Electron + TypeScript project
- [x] Add lint config (ESLint) and formatting (Prettier)
- [x] Add typecheck (tsc)
- [x] Add scripts: dev, lint, typecheck, test, build, package:mac, package:win
- [x] Create folder structure: `src/main`, `src/renderer`, `src/shared`, `docs`

## Core Architecture
- [x] Define explicit state machine: idle, recording, transcribing, ready, error
- [x] Log state transitions
- [x] Create IPC channels (renderer -> main, main -> renderer)
- [x] Implement tray with Show, Restart, Quit
- [x] Implement global hotkeys with config-based bindings

## Recording + Chunking
- [x] Implement renderer recording via getUserMedia + MediaRecorder
- [x] Implement segment buffer and rotation by size (<20MB) and time
- [x] Write segments to temp folder in order
- [x] Send ordered segment paths to main on stop

## Transcription
- [x] Add OpenAI SDK integration in main
- [x] Implement retries for transient errors (429/5xx)
- [x] Transcribe each segment in order and join
- [x] Cleanup transcript text (trim + collapse double spaces)
- [x] Handle errors (invalid key/oversize)

## Paste Automation
- [x] Clipboard set + optional restore
- [x] macOS paste via osascript Cmd+V
- [x] Windows paste via PowerShell WScript.Shell SendKeys
- [x] Error path keeps transcript in clipboard

## UI
- [x] Create always-on-top indicator window
- [x] Show status text + timer + spinner
- [x] Indicator visibility config (always or only active)

## Config
- [x] Load config from userData `config.json`
- [x] Validate and apply defaults
- [x] Support hotkeys/model/language/restoreClipboard/indicator settings

## Logging
- [x] Write logs to `logs/app.log`
- [x] Include state transitions and errors
- [x] Optional diagnostics mode toggle

## Testing
- [x] Unit tests: state machine transitions
- [x] Unit tests: chunking logic size rotation
- [x] Unit tests: transcript join/cleanup
- [x] Document manual test matrix in `docs/TEST_PLAN.md`

## Packaging
- [x] Build macOS package (DMG or ZIP)
- [x] Document Gatekeeper steps
- [x] Document Windows packaging and runtime instructions

## Final Audit
- [ ] Ensure app launches and hotkeys work
- [ ] Ensure checklist is fully updated
- [ ] Update `docs/PROGRESS.md` with final status
- [ ] List any remaining issues
