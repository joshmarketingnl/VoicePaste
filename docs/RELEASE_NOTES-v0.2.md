# VoicePaste v0.2 Release Notes

## Completed Checklist
- Docs: PRD-v0.2-FULL, CHECKLIST-v0.2, TEST_PLAN-v0.2, ARCHITECTURE-v0.2
- UI: indicator top-left on launch, hide button, restart button
- Hotkeys: cancel recording without transcription
- Paste: fallback message and permission guidance
- Packaging: macOS ZIP build via electron-builder
- Tests: lint/typecheck/tests/build

## Changes from v0.1
- Indicator shows on launch (top-left), with hide/restart controls.
- New cancel-recording hotkey (no transcription).
- Paste failure guidance with clipboard fallback message.
- MediaRecorder restarts per segment for long recordings.

## Known Issues / Not Shipped
- macOS DMG build disabled (ZIP only).
- Windows packaging not produced on macOS; must build on Windows host.
- Manual end-to-end app tests not fully executed (see TEST_PLAN-v0.2).

## Quick Test
1) `npm run dev`
2) Press record hotkey, speak, stop, wait for Ready.
3) Paste into Notes/Terminal with paste hotkey.
4) Try cancel hotkey while recording to ensure no transcription occurs.

## Notes
- If paste fails, transcript remains in clipboard; press Cmd+V/Ctrl+V manually.
