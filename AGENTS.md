# VoicePaste Agent Instructions

## How to work in this repo
- Read `docs/PRD.md` and `docs/ARCHITECTURE.md` before making changes.
- Keep `docs/CHECKLIST.md` accurate and check off completed items.
- Update `docs/PROGRESS.md` with timestamped entries after meaningful milestones.
- Prefer simple, reliable solutions over clever abstractions.
- Preserve the explicit state machine (idle/recording/transcribing/ready/error).
- Keep UI minimal and functional; avoid heavy UI frameworks unless required.
- Ensure macOS remains the primary target; Windows must compile/run with minimal extra work.
- Avoid breaking global hotkeys, paste automation, or recording chunking.

## Required hygiene
- Run `npm run lint`, `npm run typecheck`, and `npm test` after major milestones.
- Keep logs informative: state transitions, errors, last action.
- Document any new permissions or OS-specific steps in `README.md`.
- If a blocker occurs, choose the simplest robust workaround and document it.

## Where to look first
- `src/main` for system integration (hotkeys, tray, OpenAI, paste)
- `src/renderer` for UI + MediaRecorder chunking
- `src/shared` for config/types/state machine

## Config expectations
- Config lives in the app `userData` folder as `config.json`.
- Defaults should exist and be validated on load.
