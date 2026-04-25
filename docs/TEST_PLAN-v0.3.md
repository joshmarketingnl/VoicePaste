# VoicePaste v0.5 Test Plan

## Scope
Covers v0.5 macOS-first behavior:
- Menu bar lifecycle (hide-not-quit)
- Control window recovery via menu bar and recovery hotkey
- Cursor indicator state visuals
- Ready/error timers
- Paste and transcription error paths
- Hotkey fail-safes (`paste` during recording and secondary stop+transcribe hotkey)
- Auto-restart-on-error with restart loop guard

## Automated Checks (Executed)
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS
- `npm run build`: PASS
- `npm run package:mac`: PASS
- Packaged app launch by command + process presence check: PASS
- Packaged app quit by Apple Event (`tell app to quit`) + process absence check: PASS

## Manual Smoke Matrix

1. Startup window visibility
- Steps:
  - Launch app.
  - Verify control window appears top-left.
- Expected: visible on every launch.
- Status: PENDING (visual manual)

2. Close means hide, not quit
- Steps:
  - Click close on control window.
  - Verify process still running in menu bar.
- Expected: app remains running; window hidden.
- Status: BLOCKED (automation requires macOS Accessibility approval for keystroke/click scripting)

3. Reopen from menu bar
- Steps:
  - Click tray/menu bar icon or `Show VoicePaste`.
  - Verify window reappears and focused.
- Expected: window shown at top-left.
- Status: PENDING (manual)

3b. Reopen with recovery hotkey
- Steps:
  - Hide control window.
  - Press `Cmd+Opt+M`.
- Expected: control window is shown and focused.
- Status: PENDING (manual)

4. Recording indicator
- Steps:
  - Start recording hotkey.
  - Move cursor.
- Expected: red dot appears near cursor and follows live.
- Status: PENDING (manual)

5. Transcribing indicator
- Steps:
  - Stop recording and wait for transcription.
- Expected: spinner near cursor while transcribing.
- Status: PENDING (manual)

6. Ready indicator timeout
- Steps:
  - Reach ready state.
  - Do not paste.
- Expected: checkmark hides after ~15s.
- Status: PENDING (manual)

7. Ready indicator on paste hotkey
- Steps:
  - Reach ready state.
  - Use VoicePaste paste hotkey.
- Expected: checkmark hides immediately.
- Status: PENDING (manual)

8. Paste failure behavior
- Steps:
  - Trigger paste failure (permission denied or automation blocked).
- Expected: red cross appears for ~5s.
- Status: PENDING (manual)

9. Transcription failure behavior
- Steps:
  - Force transcription failure (invalid API key/network).
- Expected: red cross appears for ~5s.
- Status: PENDING (manual)

10. Paste hotkey fail-safe while recording
- Steps:
  - Start recording.
  - Press VoicePaste paste hotkey (`Cmd+Opt+V` on macOS).
- Expected: recording stops and transcription starts; after transcript is ready, paste is triggered automatically; no paste error is shown.
- Status: PENDING (manual)

11. Secondary stop+transcribe hotkey
- Steps:
  - Start recording.
  - Press `Cmd+Opt+C`.
- Expected: recording stops and transcription starts.
- Status: PENDING (manual)

12. Auto-restart on error
- Steps:
  - Force an error path (for example invalid API key and stop recording).
- Expected: app schedules relaunch automatically after error indication.
- Status: PENDING (manual)

13. Auto-restart loop guard
- Steps:
  - Force repeated startup/runtime errors 4+ times inside 60 seconds.
- Expected: restart attempts are suppressed after threshold and suppression is logged.
- Status: PENDING (manual)

14. Paste hotkey spam while transcribing
- Steps:
  - Start recording, then stop (or press paste once to force stop+transcribe queue).
  - While transcribing, press paste hotkey repeatedly.
- Expected: only one paste is queued; duplicates are ignored without errors; one paste happens after transcript ready.
- Status: PENDING (manual)

## Notes
- Full UI automation for close/reopen and cursor-state visuals is blocked until macOS Accessibility permission is granted for automation tools used by CLI scripts.
