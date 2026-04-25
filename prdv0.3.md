# VoicePaste v0.3 PRD (Execution Spec for CLI AI Coding Agent)

## 1. Document Status
- Version: `v0.3.0-prd`
- Date: `2026-02-11`
- Owner: `VoicePaste`
- Audience: CLI AI coding agent implementing changes in `VoicePaste-v0.3`
- Purpose: Provide a complete, low-ambiguity, step-by-step implementation spec for v0.3.

## 2. Context
VoicePaste v0.2 works and must remain untouched. v0.3 is a separate workspace and release line.

Confirmed by product direction:
- v0.2 must not be modified.
- v0.3 should prioritize implementation simplicity and low development risk over advanced UI complexity.
- Scope for new UX is macOS-first only.

## 3. Product Summary
VoicePaste v0.3 remains a hotkey-driven record -> transcribe -> paste utility, but the primary feedback shifts from a top-left status window to a tiny cursor-following visual indicator.

The control window still exists and is useful, but becomes secondary. It must be easily re-opened via menu bar and app startup behavior.

## 4. Hard Decisions (Locked)
These are fixed for v0.3 and should not be reinterpreted during implementation.

1. Cursor indicator must follow cursor live while active.
2. Indicator size/offset default: `14px` diameter, `8px` to the right of cursor.
3. Indicator states:
- Recording: recording icon/dot.
- Transcribing: mini spinner.
- Ready: checkmark.
- Error: red cross.
4. Ready checkmark visibility rule:
- Hide when VoicePaste paste hotkey is used.
- Else auto-hide after `15s`.
5. Error visibility duration: `5s` then hide.
6. Control window behavior:
- Show on every app start.
- Closing the window only hides it, never quits app.
- Re-open from menu bar tray click/menu item.
7. Quit behavior:
- App quits only through explicit `Quit` action in menu bar/tray menu (or force quit by OS/user).
8. App should run as menu bar style utility on macOS.
9. Auto-start at login should be enabled.
10. If paste action fails while in ready state: show error red cross for 5s.
11. If transcription fails: show error red cross for 5s.
12. Windows changes for this UX are out of scope for v0.3.

## 5. Goals
- Deliver a clear cursor-adjacent progress signal with minimal visual noise.
- Keep core reliability for hotkeys, recording, transcription, and paste.
- Keep operational controls available through a simple control window + menu bar.
- Minimize code risk by preserving existing state machine and extending behavior incrementally.

## 6. Non-Goals
- No full settings UI redesign.
- No transcript history.
- No Linux support work.
- No Windows parity work for cursor indicator in this milestone.
- No architecture rewrite away from Electron main/renderer split.

## 7. Target Platform
- Primary/only implementation target for new behavior: `macOS`.
- Existing Windows logic may remain in code, but no v0.3 cursor-indicator requirements depend on Windows.

## 8. UX Specification

### 8.1 Control Window (existing window, kept)
- Purpose: lightweight visibility into app state and utility controls.
- Must show on every app launch.
- If user closes window, app stays alive and window hides.
- Tray/menu bar click must show and focus this window again.
- Default position when shown from tray click: top-left usable area (`primaryDisplay.workArea + margin`).

### 8.2 Cursor Indicator (new/primary status signal)
- A tiny transparent overlay near cursor.
- Non-interactive, click-through, no taskbar/dock presence.
- Should only be visible for active workflow states (`recording`, `transcribing`, `ready`, `error`).
- Hidden in `idle` by default.

### 8.3 Visual Rules
- Circle container: `14px` width/height.
- Cursor offset: `+8px x`, `0px y` from cursor point.
- Keep cursor itself visible; do not overlap center of pointer.
- States:
- `recording`: solid accent dot or mic glyph.
- `transcribing`: mini spinner animation.
- `ready`: checkmark icon.
- `error`: red `x` icon.

### 8.4 Timed Behavior
- `ready` state indicator:
- hide on successful invocation of VoicePaste paste hotkey handler.
- if not pasted, auto-hide after `15000ms`.
- `error` state indicator:
- show for `5000ms`.
- then hide unless state changes again.

## 9. Functional Requirements

### 9.1 App Lifecycle and Shell
- FR-001: App must keep running when control window is closed.
- FR-002: App must expose tray/menu bar with at least:
- `Show VoicePaste`
- `Quit VoicePaste`
- FR-003: Tray icon click must show/focus control window.
- FR-004: App must show control window on each start.
- FR-005: App must register auto-start/login item on macOS.
- FR-006: In packaged macOS app, default to hidden Dock icon behavior (menu bar utility style).

### 9.2 State and Indicator Behavior
- FR-007: Existing app state machine remains canonical source of truth.
- FR-008: Cursor indicator view must map deterministically from app state.
- FR-009: `idle` hides cursor indicator.
- FR-010: `recording`, `transcribing`, `ready`, `error` show cursor indicator with correct icon.
- FR-011: `ready` auto-hide timer starts when entering `ready`.
- FR-012: `ready` timer canceled on paste hotkey use.
- FR-013: `error` indicator shows for 5s on paste/transcription errors.

### 9.3 Recording and Transcription
- FR-014: Existing chunking and transcription flow from v0.2 must continue unchanged functionally.
- FR-015: Cursor indicator must reflect transitions without adding latency to recording/transcription pipeline.

### 9.4 Paste Flow
- FR-016: On successful VoicePaste paste action, if cursor indicator is in `ready`, hide it immediately.
- FR-017: Manual system paste (`Cmd+V`) should not be observed or used for ready-dismiss logic.
- FR-018: On paste simulation failure, set app state to `error` and show red cross for 5s.

### 9.5 Error Handling
- FR-019: Transcription error must transition to `error` and show red cross for 5s.
- FR-020: Microphone permission failure must still surface via existing window and logs.
- FR-021: Any state error should be logged with reason.

## 10. Configuration Requirements

### 10.1 Keep Existing Config Compatible
`config.json` format must remain backward compatible.

### 10.2 v0.3 Additions (optional, with defaults)
Add optional fields only if needed for implementation clarity:
- `cursorIndicator.enabled` default `true` on macOS.
- `cursorIndicator.sizePx` default `14`.
- `cursorIndicator.offsetXPx` default `8`.
- `cursorIndicator.readyTimeoutMs` default `15000`.
- `cursorIndicator.errorTimeoutMs` default `5000`.

If this adds complexity, hardcode v0.3 constants and postpone config exposure.

### 10.3 Hotkey Default Clarification
Current macOS default in code is `Ctrl+Option+V`. Product direction references `Command+Option+V` wording.
Implementation rule for v0.3:
- Ready-dismiss trigger must be tied to the configured VoicePaste paste action handler, not hardcoded key text.
- Keep existing config compatibility and avoid breaking existing users.

## 11. Architecture Delta (v0.2 -> v0.3)

### 11.1 Windows
- Keep control window (`mainWindow`) for UI controls/status.
- Add separate cursor indicator window (`cursorIndicatorWindow`) with:
- transparent background
- frameless
- non-focusable
- always on top
- ignore mouse events

### 11.2 Renderer Surfaces
- Control window renderer can stay mostly unchanged.
- Add a minimal renderer surface for cursor indicator visuals and animation.

### 11.3 Main Process Responsibilities (new)
- Track cursor point with lightweight interval while indicator is visible.
- Move cursor indicator window near pointer.
- Manage ready/error timers.
- Route state updates to both windows.

### 11.4 Keep Existing Reliability Components
- State machine
- Transcription retry
- Segment chunking
- Paste mechanism

No rewrite unless required by failing tests.

## 12. Implementation Plan (Step-by-Step)

### Step 1. Create v0.3 PRD artifacts
- Create this file `prdv0.3.md`.
- Add progress log entry.

Done criteria:
- Document exists and is referenced for build work.

### Step 2. App lifecycle hardening
Target file: `src/main/main.ts`

Tasks:
- Intercept control window `close` event -> `event.preventDefault(); window.hide();`.
- Ensure window-all-closed does not quit app.
- Add explicit menu action for quit.
- Ensure tray click always shows control window.

Done criteria:
- Closing window never quits app.
- Quit only from tray menu quit command.

### Step 3. Menu bar and startup behavior
Target file: `src/main/main.ts`

Tasks:
- Ensure tray menu includes `Show VoicePaste` and `Quit VoicePaste`.
- Show control window at app start every launch.
- Enable `app.setLoginItemSettings({ openAtLogin: true })` for macOS.
- Hide Dock icon in packaged app mode for menu bar utility behavior.

Done criteria:
- App starts in menu bar, control window visible, tray control works.

### Step 4. Add cursor indicator renderer assets
New files:
- `src/renderer/cursor-indicator.html`
- `src/renderer/cursor-indicator.ts`
- `src/renderer/cursor-indicator.css`

Build pipeline updates:
- `scripts/build-renderer.js` add entry for cursor indicator bundle.
- `scripts/copy-static.js` copy extra html/css assets.

Done criteria:
- Dist contains cursor indicator assets and JS bundle.

### Step 5. Cursor indicator window creation
Target file: `src/main/main.ts`

Tasks:
- Create `cursorIndicatorWindow` with transparent frameless config.
- Set ignore mouse events to pass-through.
- Keep hidden in idle.

Done criteria:
- Window can be shown/hidden independently and never steals focus.

### Step 6. Cursor follow loop
Target file: `src/main/main.ts`

Tasks:
- Start interval when cursor indicator visible.
- Read cursor point with `screen.getCursorScreenPoint()`.
- Position window at `x + 8`, `y` with bounds checks.
- Stop interval when indicator hidden.

Done criteria:
- Indicator tracks cursor smoothly without high CPU.

### Step 7. State-to-visual mapping and timers
Target file: `src/main/main.ts`

Tasks:
- On state transitions, send visual state payload to cursor renderer.
- Implement ready timer (`15000ms`) and error timer (`5000ms`).
- Clear previous timers on each new state to avoid leaks/races.

Done criteria:
- Correct icon is shown per state and hides at expected times.

### Step 8. Paste/transcription error hooks
Target file: `src/main/main.ts`

Tasks:
- On paste success from VoicePaste handler, hide ready indicator.
- On paste failure, transition to error and show error indicator timer.
- On transcription failure, same error indicator timer behavior.

Done criteria:
- Failures consistently produce red cross for 5s.

### Step 9. IPC contract extension
Target files:
- `src/main/preload.ts`
- `src/renderer/global.d.ts`
- cursor indicator renderer files

Tasks:
- Add dedicated IPC event for cursor visual updates.
- Ensure type-safe payload structure.

Done criteria:
- Cursor renderer receives updates reliably with typed payload.

### Step 10. Tests and validation
Targets:
- Existing tests + new unit tests where feasible.

Tasks:
- Validate timers and state mapping logic in unit tests (extract helper functions if needed).
- Run full hygiene:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Manual smoke test on macOS.

Done criteria:
- All checks pass, manual behavior matches PRD.

## 13. Acceptance Criteria (Release Gate)
A v0.3 candidate is accepted only if all are true:

1. v0.2 workspace remains unchanged and usable.
2. v0.3 launches with control window visible.
3. Closing control window hides only; app keeps running.
4. Tray/menu bar can reopen and focus control window.
5. Cursor indicator appears in recording/transcribing/ready/error and follows cursor live.
6. Cursor indicator size/offset visually match ~14px and +8px right.
7. Ready checkmark hides on VoicePaste paste action or after 15s.
8. Paste failure shows red cross for 5s.
9. Transcription failure shows red cross for 5s.
10. App can quit via tray menu command.
11. Auto-start at login is configured on macOS.
12. `lint`, `typecheck`, `test` all pass.

## 14. Manual Test Matrix (Minimum)

1. Startup and window behavior:
- Launch app.
- Verify control window appears.
- Close window.
- Verify app still running in menu bar.
- Reopen from tray click.

2. Recording flow:
- Start recording hotkey.
- Verify cursor recording icon appears and follows cursor.
- Stop recording.
- Verify spinner during transcription.

3. Ready flow:
- On transcript ready, checkmark appears.
- Wait 15s with no paste action.
- Verify checkmark hides automatically.

4. Paste success flow:
- Trigger ready state again.
- Use VoicePaste paste hotkey.
- Verify ready indicator hides immediately.

5. Paste failure flow:
- Simulate denied accessibility or forced paste failure.
- Verify red cross appears for 5s.

6. Transcription error flow:
- Force bad API key/network failure.
- Verify red cross appears for 5s.

7. Quit flow:
- Use tray menu `Quit VoicePaste`.
- Verify app exits.

## 15. Logging Requirements
Log at info/debug level for:
- state transitions
- indicator show/hide reasons
- timer start/clear events
- tray show actions
- window hide-on-close events
- paste success/failure
- transcription success/failure

Errors must include concise machine-actionable reason text.

## 16. Risks and Mitigations

1. Risk: Cursor-follow loop causes CPU usage.
- Mitigation: low-frequency interval (start at 30-60ms), run only while visible.

2. Risk: Overlay steals focus/clicks.
- Mitigation: `focusable: false`, `setIgnoreMouseEvents(true)`.

3. Risk: Timer race conditions on rapid state changes.
- Mitigation: centralized timer clear/reset utility in main process.

4. Risk: Dock hide breaks dev workflow.
- Mitigation: only hide Dock when packaged; keep visible in dev.

## 17. Out of Scope for v0.3
- Windows cursor indicator parity.
- Advanced preferences UI for indicator customization.
- Detection of manual `Cmd+V` clipboard pastes.
- Transcript history and export.

## 18. Definition of Done
v0.3 is done when:
- All acceptance criteria in Section 13 pass.
- Manual matrix in Section 14 completed.
- `README.md` updated for menu bar/startup behavior if changed.
- `docs/PROGRESS.md` updated with implementation milestone.
- Build artifacts package successfully for macOS.

## 19. Suggested Execution Commands
From `VoicePaste-v0.3`:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run package:mac
```

## 20. Agent Operating Rules (for implementation pass)
- Do not modify `VoicePaste-v0.2`.
- Keep changes incremental and test after each phase.
- Prefer straightforward code over abstraction.
- Preserve current state machine contract unless a test-backed change is required.
- Keep behavior deterministic and strongly logged.
