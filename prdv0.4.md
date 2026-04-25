# VoicePaste v0.4 PRD (Execution Spec)

## 1. Document Status
- Version: `v0.4.0-prd`
- Date: `2026-02-13`
- Owner: `VoicePaste`
- Audience: CLI AI coding agent implementing v0.4 in `VoicePaste-v0.3`
- Purpose: Define exact implementation for new fail-safes and auto-restart behavior.

## 2. Scope and Context
VoicePaste v0.3 is stable and remains the base.  
v0.4 adds reliability fail-safes for accidental hotkey use during recording and automatic app restart on errors.

This PRD assumes:
- Existing default hotkeys on macOS are:
  - `Command+Option+R` = toggle recording / stop+transcribe
  - `Command+Option+V` = paste transcript
  - `Command+Option+S` = cancel recording (no transcription)

## 3. Product Changes (v0.4)
1. Fail-safe: if user presses `Command+Option+V` while state is `recording`, app must **not** try paste and must **stop recording + start transcription**.
2. Add a second explicit stop+transcribe hotkey: `Command+Option+C` (macOS default).
3. Automatic restart fail-safe: when app enters an error condition, app relaunches automatically.

## 4. Locked Decisions
1. `Command+Option+R` remains the main toggle hotkey (start + stop/transcribe).
2. New `Command+Option+C` is stop+transcribe only:
- Works only when state is `recording`.
- In other states, it is ignored with debug log.
3. `Command+Option+V` behavior becomes state-aware:
- If `recording`: treat as stop+transcribe fail-safe.
- Else: keep existing paste behavior.
4. No error toast/message for the `V`-during-recording fail-safe path; UX should feel seamless.
5. Auto-restart is enabled by default for v0.4, with loop protection.

## 5. Functional Requirements

### 5.1 Hotkey Fail-safe Logic
- FR-401: While `recording`, paste hotkey handler must call stop/transcribe flow and return early.
- FR-402: While `recording`, paste handler must never call `handlePaste`.
- FR-403: App must log `Paste hotkey rerouted to stop+transcribe (failsafe)` with state context.
- FR-404: App adds registration of a new hotkey `stopAndTranscribe`.
- FR-405: `stopAndTranscribe` in `recording` sends `commandStop` to renderer.
- FR-406: `stopAndTranscribe` outside `recording` is ignored.

### 5.2 Auto-Restart on Error
- FR-407: Add centralized `scheduleAutoRestart(reason: string)` in main process.
- FR-408: Restart trigger sources:
  - Any transition to app state `error`
  - `ipcMain.on('recordingError', ...)`
  - Transcription failure path
  - Paste failure path
  - Failed global hotkey registration
  - `process.on('uncaughtException')`
  - `process.on('unhandledRejection')`
  - Renderer process gone/crashed events on both windows (if available)
- FR-409: Restart delay default `1200ms` (enough for logging + UI update).
- FR-410: Loop guard: max `3` restarts in `60s`; if exceeded, skip auto-restart and log `Auto-restart suppressed (loop guard)`.
- FR-411: Restart flow must be `app.relaunch()` then `app.exit(0)`.

### 5.3 Backward Compatibility
- FR-412: Existing config keys remain valid.
- FR-413: Existing defaults for `toggleRecord`, `pasteTranscript`, `cancelRecording` remain unchanged.
- FR-414: New key `stopAndTranscribe` is optional; if absent, use platform default.

## 6. Config Delta
Update shared types and merge/default logic.

`src/shared/types.ts`
- Extend `HotkeysConfig`:
  - `stopAndTranscribe: string`

`src/shared/config.ts`
- Add defaults:
  - macOS: `Command+Option+C`
  - Windows/Linux: `Ctrl+Alt+C`
- Merge behavior:
  - `stopAndTranscribe: input.hotkeys?.stopAndTranscribe ?? defaults.hotkeys.stopAndTranscribe`

No breaking schema changes outside this new optional key.

## 7. Architecture Delta

### 7.1 Main Process (`src/main/main.ts`)
1. Add helper `handleStopAndTranscribe(source: 'toggle' | 'secondaryHotkey' | 'pasteFailsafe')`.
2. Refactor toggle stop path to use this helper.
3. Register new global shortcut for `stopAndTranscribe`.
4. Change paste hotkey callback:
- If `recording`: call `handleStopAndTranscribe('pasteFailsafe')`.
- Else: `void handlePaste()`.
5. Add auto-restart controller:
- restart counters/timestamps
- delay timer guard (single pending restart)
- centralized logging

### 7.2 Renderer Process
No structural change required. Existing `commandStop` behavior remains source of truth for stop->transcribe.

## 8. Implementation Plan (Execution Order)
1. Add PRD + progress entry.
2. Update shared config/types with `stopAndTranscribe`.
3. Update hotkey registration + paste hotkey routing in `main.ts`.
4. Add `handleStopAndTranscribe` and wire all stop paths.
5. Add auto-restart scheduler + loop guard.
6. Hook process-level fatal error handlers.
7. Add tests for config defaults/merge and hotkey reroute logic.
8. Run full validation (`lint`, `typecheck`, `test`, optional `build`).
9. Update README hotkey section + error behavior notes.

## 9. Test Plan Additions

### 9.1 Manual
1. Start recording -> press `Cmd+Opt+V`.
- Expected: recording stops, transcription starts, no paste error.
2. Start recording -> press `Cmd+Opt+C`.
- Expected: recording stops, transcription starts.
3. Idle state -> press `Cmd+Opt+C`.
- Expected: no state change, no crash.
4. Ready state -> press `Cmd+Opt+V`.
- Expected: normal paste flow, ready indicator hide logic unchanged.
5. Force transcription error (invalid API key).
- Expected: error state visible briefly, app auto-restarts (unless loop guard exceeded).

### 9.2 Automated
1. Config unit tests:
- Includes default/merge for `stopAndTranscribe`.
2. Main process logic tests (new or extracted pure helpers):
- Paste hotkey in recording reroutes to stop/transcribe.
- Paste hotkey in ready/idle calls paste.
- Auto-restart loop guard suppresses excessive relaunch.

## 10. Acceptance Criteria
- AC-401: `Cmd+Opt+V` during recording no longer causes paste-related error path.
- AC-402: `Cmd+Opt+V` during recording always behaves as stop+transcribe.
- AC-403: `Cmd+Opt+C` works as second stop+transcribe shortcut.
- AC-404: App auto-restarts after error conditions with no manual restart needed.
- AC-405: Restart loop protection prevents infinite restart thrashing.
- AC-406: Existing v0.3 flows (record, transcribe, paste, cancel) remain operational.

## 11. Risks and Mitigations
- Risk: aggressive auto-restart can hide useful error details.
- Mitigation: keep logs explicit before restart and apply restart delay.

- Risk: restart loops on persistent config/environment errors.
- Mitigation: loop guard with suppression log and fallback to manual restart button.

- Risk: hotkey conflicts with OS/app shortcuts.
- Mitigation: keep `stopAndTranscribe` configurable in `config.json`.

## 12. Out of Scope (v0.4)
- No transcript history.
- No UI redesign.
- No cloud sync/settings UI.
- No additional platform-specific UX work beyond existing architecture.
