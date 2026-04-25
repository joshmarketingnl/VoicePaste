# VoicePaste Windows Cursor Overlay PRD

## 1. Summary
This PRD defines the repair plan for the Windows cursor-follow status indicator in `Developer beta V1.1`.

The goal is simple:

- while VoicePaste is `recording`, `transcribing`, `ready`, or `error`
- a small visual indicator must stay next to the mouse cursor
- across normal app switching, browser tab switching, and multi-monitor movement
- without stealing focus from the app the user is working in

This is now a required Windows release behavior, not a stretch goal.

## 2. Why This PRD Exists
The previous Windows PRD treated the cursor-follow overlay as optional stretch work.
That is no longer acceptable.

User requirement:

- the recording state must always be visible next to the cursor
- if the user switches tabs or changes apps, the indicator must not disappear
- the overlay is part of trust and usability, not decoration

## 3. Current-State Diagnosis

### 3.1 The immediate root cause
The cursor indicator is hard-disabled on Windows:

- [main.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/main/main.ts#L140) returns `process.platform === 'darwin'`

That means all Windows cursor-indicator logic is currently dead code.

### 3.2 The existing overlay implementation is macOS-only by policy
The current indicator pipeline already exists:

- cursor target calculation and clamping in [main.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/main/main.ts#L540)
- follow loop in [main.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/main/main.ts#L577)
- state-driven show/hide logic in [main.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/main/main.ts#L672)
- overlay window creation in [main.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/main/main.ts#L959)

The renderer side is already complete enough to render the four states:

- [cursor-indicator.ts](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/renderer/cursor-indicator.ts#L1)
- [cursor-indicator.css](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/src/renderer/cursor-indicator.css#L24)

So the problem is not “no overlay exists”.
The problem is “Windows support was intentionally not turned on, and the current window strategy is not hardened for Windows z-order behavior”.

### 3.3 The previous Windows PRD underscoped this
The earlier Windows plan explicitly placed cursor parity under stretch work:

- [PRD-WINDOWS.md](/Users/joshuavandenouden/Documents/Codex/Vibe%20code%20projects/VoicePaste/VoicePaste-developer-beta-v1.1/docs/PRD-WINDOWS.md#L143)

This new PRD supersedes that part.

## 4. Product Goal
Ship a Windows cursor overlay that feels as reliable as a recording light:

- always visible while recording
- visible while transcribing
- visible briefly on success
- visible briefly on error
- remains attached to the mouse through tab switches and normal app switches
- never steals keyboard focus

## 5. Non-Goals
Out of scope for this repair:

- redesigning the indicator visuals
- adding transcript history
- changing the main control window UX
- using native Windows toast notifications as the primary status surface

Notifications can remain fallback UX, but they are not the fix for this problem.

## 6. User Stories
1. While recording in a browser tab, I can always see a recording marker next to my cursor.
2. If I switch to another tab or another app mid-recording, the marker remains visible.
3. When recording stops and transcription starts, the marker changes to a loading state without disappearing.
4. If transcription succeeds, I briefly see success near the cursor.
5. If transcription or paste fails, I briefly see error near the cursor.
6. The overlay never steals focus from the text field or app I am using.

## 7. Platform Constraints We Must Design Around
From official Electron docs:

- `BrowserWindow.setVisibleOnAllWorkspaces()` does nothing on Windows.
- `BrowserWindow.setAlwaysOnTop(true, level)` supports Windows levels, and from `pop-up-menu` upward the window is above the taskbar.
- `BrowserWindow.moveTop()` can move a window to the top of z-order without focusing it.
- `BrowserWindow.showInactive()` shows a window without focusing it.
- `screen.getCursorScreenPoint()` returns DIP coordinates, not physical pixels.

Implication:

- the current call to `setVisibleOnAllWorkspaces()` is not solving anything on Windows
- Windows reliability must come from z-order management, not workspace APIs
- we must be disciplined about DPI coordinate spaces when positioning across monitors

## 8. Product Requirements

### 8.1 Required behavior
- On Windows, the cursor overlay must exist and be enabled.
- During `recording`, the overlay must remain visible next to the cursor until recording stops or is cancelled.
- During `transcribing`, the overlay must remain visible next to the cursor until transcript-ready or error.
- During `ready`, the checkmark state must display for the existing timeout unless the user pastes sooner.
- During `error`, the error state must display for the existing timeout.
- The overlay must follow the cursor across monitors.
- The overlay must stay visible when the user switches browser tabs or changes focus to another normal desktop app.

### 8.2 Focus behavior
- The overlay must never take keyboard focus.
- It must not intercept mouse events.
- It must not appear in the taskbar.

### 8.3 Visual continuity
- State transitions must update in place; no flicker-heavy destroy/recreate behavior on every tick.
- The indicator should remain offset slightly to the right of the cursor, consistent with the current design.

## 9. Technical Strategy

### 9.1 Enable Windows support deliberately
Replace the current “macOS only” gate with a real platform capability decision.

Current:

- `isCursorIndicatorSupported()` returns `darwin` only

Required:

- support `win32`
- keep Linux out of scope
- keep one capability function so the decision remains centralized

### 9.2 Keep the dedicated overlay window model
Do not replace the overlay with tray balloons or the main window.

Use the existing dedicated `cursorIndicatorWindow` because it already has the right conceptual shape:

- transparent
- focusless
- skip taskbar
- ignore mouse events
- background throttling disabled

This is the correct architecture. It just needs Windows hardening.

### 9.3 Harden z-order for Windows
The likely reason the overlay disappears during tab/app switching is not cursor math.
It is z-order persistence.

Plan:

1. Keep `setAlwaysOnTop(true, 'screen-saver')` on Windows.
2. On Windows, explicitly call `moveTop()` when:
   - the overlay is first shown
   - the overlay state changes
   - the main app state transitions into `recording`, `transcribing`, `ready`, or `error`
   - the follow loop detects the overlay became hidden unexpectedly
3. Add a lightweight z-order watchdog while the overlay is active:
   - interval-based, low frequency, separate from the 16ms position loop
   - on Windows only
   - reassert `moveTop()` and `showInactive()` if the overlay should be visible but is not visible or not topmost enough

This avoids trying to brute-force `moveTop()` every frame, which would be wasteful and more fragile.

### 9.4 Decouple “follow position” from “visibility health”
Right now the same loop conceptually handles presence and movement.
That is too coarse for Windows.

Split responsibilities:

- position loop:
  - runs at current cursor-follow frequency
  - computes cursor-relative bounds
  - only moves when position changed materially

- visibility watchdog:
  - runs at lower cadence, for example every 250-500ms
  - only active while overlay should be visible
  - reasserts show/topmost guarantees

### 9.5 Add Windows-aware overlay window setup
Keep current options and add Windows-specific hardening where useful:

- keep `focusable: false`
- keep `skipTaskbar: true`
- keep `setIgnoreMouseEvents(true, { forward: true })`
- keep `setAlwaysOnTop(true, 'screen-saver')`
- add a Windows-only post-show `moveTop()`
- add a Windows-only hook to reassert topmost status after display changes or visibility loss

Do not rely on:

- `setVisibleOnAllWorkspaces()` for Windows

It can remain for macOS, but it should no longer be presented as part of the Windows strategy.

### 9.6 Handle display and DPI changes explicitly
The current cursor code already clamps to the nearest display’s work area.
That is a good base.

Windows-specific hardening:

- listen to `screen` display events such as `display-metrics-changed`, `display-added`, and `display-removed`
- when these fire while the overlay is active:
  - recompute clamped position immediately
  - reassert visibility/topmost state

Coordinate rule:

- stay in DIP space end-to-end for cursor-based positioning
- only add `screen.dipToScreenPoint` or related conversions if a native Windows API is introduced later

### 9.7 Treat overlay failure separately from app failure
Current behavior restarts the app if the cursor-indicator renderer process dies.
That is too blunt for a Windows repair where this feature is still stabilizing.

Recommended change:

- if the overlay renderer dies, attempt one local recreation of the overlay window first
- only escalate to full app restart if recreation also fails

This makes the overlay more resilient without resetting an active recording session unnecessarily.

### 9.8 Preserve current visuals and state semantics
Do not redesign the overlay visuals in this repair.

Keep:

- amber recording pulse
- blue transcribing spinner
- checkmark for ready
- error cross
- current success/error timeout semantics

The fix is reliability, not styling.

## 10. Implementation Plan

### Phase 1: Turn Windows support on safely
- update `isCursorIndicatorSupported()` to include `win32`
- create Windows-specific capability branches where needed
- keep macOS behavior unchanged

### Phase 2: Overlay z-order hardening
- add Windows-only `moveTop()` reassertion
- add visibility watchdog
- ensure show path uses `showInactive()` plus z-order refresh

### Phase 3: Event-driven resilience
- listen for display metric changes
- re-clamp and re-show when monitor/DPI setup changes
- add self-healing overlay recreation if the overlay window dies

### Phase 4: QA and instrumentation
- add debug logging around:
  - overlay show/hide
  - z-order reassertions
  - watchdog recoveries
  - display changes
- add tests for support gating and position/clamp helpers
- run manual Windows QA matrix

## 11. Testing Requirements

### 11.1 Automated
Add or extend tests for:

- support predicate includes Windows
- overlay state machine mapping remains correct
- position/clamping still works across display geometries
- watchdog enable/disable conditions

### 11.2 Manual Windows QA
Required matrix:

1. Recording in Chrome/Edge text field
2. Recording in ChatGPT web input
3. Recording in VS Code editor
4. Recording in Windows Terminal
5. Alt-tab to another app while recording
6. Switch browser tabs while recording
7. Move cursor across two monitors while recording
8. Test at 100%, 125%, and 150% display scaling
9. Test start hidden in tray, then begin recording
10. Validate ready and error timeouts near cursor

### 11.3 Explicit failure tests
- force-hide the main window and confirm overlay still follows cursor during active recording
- trigger microphone permission failure
- trigger transcription failure
- trigger paste failure
- disconnect/reconnect a display while recording

## 12. Acceptance Criteria
The fix is complete when all of the following are true on a real Windows machine:

1. The cursor indicator appears during recording every time.
2. The recording indicator stays visible through browser tab switches.
3. The recording indicator stays visible through normal desktop app switches.
4. The indicator follows the cursor on the correct monitor.
5. The transcribing spinner stays visible until success or failure.
6. The ready and error icons display for their expected timeout.
7. The overlay never steals focus from the active app.
8. The overlay does not appear in the taskbar.
9. The overlay survives at least one multi-monitor or DPI configuration change without disappearing permanently.

## 13. Recommended Engineering Decisions
Approve these decisions with the repair:

1. Windows cursor overlay is a ship blocker, not stretch.
2. Keep the dedicated overlay window architecture.
3. Fix Windows reliability with z-order management, not notifications.
4. Add a low-frequency watchdog instead of abusing the 16ms cursor loop for everything.
5. Prefer self-healing overlay recreation before restarting the whole app.

## 14. Risks

### Risk 1: z-order still degrades in some app combinations
Mitigation:

- use `screen-saver` topmost level
- add `moveTop()` watchdog
- validate against browsers, editors, terminal, and common desktop apps

### Risk 2: overlay jitters or flickers
Mitigation:

- keep state transitions in the existing renderer
- avoid recreate-on-every-update
- separate movement from visibility repair

### Risk 3: DPI issues on mixed-scale monitors
Mitigation:

- keep all cursor math in DIP
- test mixed scaling explicitly
- only introduce physical-point conversion if truly needed

## 15. References
Official Electron sources used for this PRD:

- Electron BrowserWindow API: [https://www.electronjs.org/docs/latest/api/browser-window](https://www.electronjs.org/docs/latest/api/browser-window)
- Electron screen API: [https://www.electronjs.org/docs/latest/api/screen](https://www.electronjs.org/docs/latest/api/screen)

Key implementation notes derived from those docs:

- `setVisibleOnAllWorkspaces()` does nothing on Windows
- `showInactive()` shows without focusing
- `moveTop()` can raise z-order without focus
- `setAlwaysOnTop()` levels from `pop-up-menu` and above sit above the Windows taskbar
- `screen.getCursorScreenPoint()` returns DIP coordinates
