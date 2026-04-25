# VoicePaste v0.2 Checklist

## Docs
- [x] Create `docs/PRD-v0.2-FULL.md`
- [x] Create `docs/CHECKLIST-v0.2.md`
- [x] Create `docs/TEST_PLAN-v0.2.md`
- [x] Create `docs/ARCHITECTURE-v0.2.md`
- [x] Update `README.md` with v0.2 defaults and controls
- [x] Update `docs/PROGRESS.md` after each milestone

## Code changes
- [x] Add cancel-recording hotkey to config/types/defaults
- [x] Register cancel-recording hotkey in main process
- [x] Implement renderer cancel recording flow (no transcription)
- [x] Add IPC for cancel recording + cleanup session in main
- [x] Allow recording -> idle transition in state machine
- [x] Make indicator visible at app start
- [x] Position indicator top-left on launch
- [x] Add indicator hide button in UI
- [x] Add indicator restart button in UI
- [x] Add IPC handlers for hide/show/restart
- [x] Show indicator when tray icon is clicked
- [x] Log hide/show/restart actions
- [x] Improve paste failure handling with fallback message
- [x] Detect macOS accessibility/automation denial and show guidance

## OS permissions
- [x] Document macOS Accessibility/Automation requirements for paste
- [x] Document Windows privilege caveats for paste

## Tests
- [x] Update/add unit tests for state machine transitions
- [x] Update/add unit tests for config defaults (cancel hotkey)
- [x] Update/add tests if new helpers are introduced

## Packaging
- [x] Ensure `npm run build` succeeds
- [x] Ensure `npm run package:mac` works
- [x] Document Windows build steps

## Release readiness
- [x] Run `npm run lint`
- [x] Run `npm run typecheck`
- [x] Run `npm test`
- [x] Run `npm run build`
- [x] Update `docs/RELEASE_NOTES-v0.2.md`
- [x] Ensure checklist is fully checked or note unshipped items
