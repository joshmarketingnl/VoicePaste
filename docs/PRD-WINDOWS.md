# VoicePaste Windows Port PRD

## 1. Summary
This PRD defines the plan to turn the current `Developer beta V1.1` desktop app into a downloadable Windows build that feels native on Windows while preserving the current VoicePaste product model:

- background utility
- global hotkeys
- quick floating control UI
- fast speech-to-text transcription
- reliable paste into the currently focused app

The Windows release should behave like a real Windows tray app, not like a direct macOS menu bar transplant.

## 2. Validated Baseline
Validated locally on 2026-04-04 against `VoicePaste-developer-beta-v1.1`:

- `npm test`: 20/20 tests passed
- `npm run build`: passed
- `npm run package:win`: passed on Apple Silicon macOS and generated:
  - `release/Developer beta V1.1 Setup 1.1.0-beta.1.exe`
  - `release/Developer beta V1.1-1.1.0-beta.1-arm64-win.zip`

Important finding:

- The repo can already package a Windows build.
- The current packaging path defaults to the current host architecture and produced `win-arm64`, not the primary `win-x64` build most Windows users will need.
- Runtime behavior is still macOS-first in several important places.

## 3. Problem Statement
The app is now functionally "done" on macOS, but there is no Windows release that can be trusted as a one-shot downloadable build for real users.

The current codebase already contains partial Windows support, but the overall experience is not yet productized for Windows:

- tray behavior is generic, not Windows-native
- the floating window is hard-positioned top-left
- cursor-follow status is disabled on non-macOS
- startup/login behavior is only enabled on macOS
- the tray icon asset pipeline is macOS-oriented
- the Windows packaging output is not yet targeted at the mainstream architecture by default

## 4. Product Goal
Ship a Windows build that a user can install, run, find in the hidden-icons tray area, show/hide confidently, control entirely by hotkeys, and use for everyday dictation into arbitrary apps.

Primary success criteria:

- downloadable Windows installer
- real Windows system tray behavior
- reliable global hotkeys
- working microphone capture, transcription, and paste flow
- sane Windows-specific defaults and copy

## 5. Non-Goals
Out of scope for this Windows port:

- Linux support
- transcript history or cloud sync
- auto-update
- Microsoft Store packaging
- code signing and SmartScreen reputation work
- major UI redesign beyond what is needed for Windows-native behavior

## 6. Target Users
Primary user:

- a Windows user who wants the same "hold almost no context, press shortcut, talk, paste" flow that the macOS app already delivers

Typical workflows:

- dictation into ChatGPT, Claude, Gmail, Slack, Notepad, Word, VS Code, browser text inputs, and Windows Terminal
- background usage with the app mostly hidden
- quick recovery when the window is hidden or the tray icon is collapsed under the notification-area arrow

## 7. Product Principles
1. Windows should feel intentionally supported, not merely tolerated.
2. The tray is the home base of the app on Windows.
3. Recovery paths must be obvious: tray, hotkey, restart, logs.
4. "Reliable enough to trust daily" is more important than perfect visual parity with macOS.
5. Packaging is part of the product. A build that only works for Windows ARM is not sufficient as the default public artifact.

## 8. Current-State Gaps In The Codebase

### 8.1 Packaging and release targeting
- `package.json` already defines `package:win` and Windows targets (`nsis`, `zip`), but no explicit Windows arch list is set.
- On an Apple Silicon host, the current path packaged `arm64` Windows artifacts by default.

### 8.2 Windows shell integration
- The app currently creates a tray icon, but tray interaction is the same on both platforms.
- The main control window is always positioned in the top-left corner.
- Login/startup behavior is only enabled on macOS.

### 8.3 Visual status parity
- Cursor-follow status is explicitly disabled outside macOS.
- The existing tray icon asset uses a macOS template image approach.

### 8.4 Windows settings quality
- The settings UI only exposes `toggleRecord` and `pasteTranscript`, while the config also includes:
  - `cancelRecording`
  - `stopAndTranscribe`
  - `showControlWindow`
- The renderer formats `Alt` as `Option`, which is wrong for Windows UI copy.

### 8.5 Windows runtime validation
- Paste on Windows currently relies on PowerShell + `WScript.Shell SendKeys`.
- This is implemented, but not validated on a real Windows machine in this repo.
- Microphone capture uses `MediaRecorder` MIME fallback logic, but this still needs real Windows smoke testing.

## 9. Proposed Windows UX

### 9.1 Install and launch
- Deliver a per-user NSIS installer as the primary public artifact.
- Also emit a ZIP/portable artifact for debugging and fallback distribution.
- On first launch, the app should appear in the Windows notification area (system tray).
- The app should remain running when the control window is closed.

### 9.2 Tray as the primary shell surface
Windows equivalent of the macOS menu bar presence:

- app lives in the notification area
- if hidden by Windows, it is accessible via the up-arrow hidden-icons panel
- tray tooltip reads `VoicePaste`
- left click toggles show/hide of the control window
- right click opens the context menu
- double click may mirror left-click toggle if needed for consistency

Recommended tray menu for Windows v1:

- `Show VoicePaste` or `Hide VoicePaste` (state-aware)
- `Start Recording` or `Stop And Transcribe` (state-aware)
- `Paste Last Transcript` (disabled when unavailable)
- `Settings`
- `Open Logs`
- `Restart VoicePaste`
- `Quit VoicePaste`

### 9.3 Control window behavior
- Keep the floating, compact control window.
- On Windows, the window should not default to the top-left corner.
- When shown from the tray, position it above or near the tray icon using `tray.getBounds()` and Windows screen bounds.
- When shown from hotkey, use the same anchored position.
- Closing the window hides it and keeps the app alive.
- The window should stay out of the taskbar unless we find a concrete Windows discoverability problem during QA.

### 9.4 Status feedback
Must-have for Windows v1:

- state visible in the control window
- state reflected in tray menu labels
- reliable error and ready feedback when the window is hidden

Recommended fallback behavior:

- if the control window is hidden, use a Windows notification or tray balloon for:
  - transcription ready
  - paste failed
  - microphone access failure

Stretch parity:

- add a Windows cursor-follow status indicator similar to macOS only if it proves stable with real Windows z-order, focus, and DPI behavior

This stretch item must not block the first Windows release.

## 10. Functional Requirements

### 10.1 Distribution
- Produce a downloadable Windows x64 installer as the primary release artifact.
- Optionally produce Windows arm64 in the same release, but x64 is the required baseline.
- Keep ZIP output for manual extraction and smoke testing.
- Define artifact naming intentionally rather than inheriting host architecture by accident.

### 10.2 Tray and lifecycle
- App appears in the Windows notification area after launch.
- App stays running after the window is closed.
- App can always be restored from tray and from hotkey.
- App quit path is explicit and only available from tray/menu actions.

### 10.3 Startup behavior
- Packaged Windows builds should support open-at-login behavior equivalent to current macOS behavior.
- Startup behavior should be validated only for packaged builds, not dev mode.

### 10.4 Global hotkeys
- Default Windows shortcuts remain:
  - `Ctrl+Alt+R` toggle record
  - `Ctrl+Alt+V` paste transcript
  - `Ctrl+Alt+S` cancel recording
  - `Ctrl+Alt+C` stop and transcribe
  - `Ctrl+Alt+M` show/focus control window
- Windows UI must display Windows terminology (`Ctrl`, `Alt`), not macOS terminology (`Option`).
- At minimum, Windows settings must expose `showControlWindow`.
- Preferred: expose all five hotkeys in Settings for full Windows self-recovery without config editing.

### 10.5 Recording and transcription
- Use the same recording/transcription pipeline already in the app.
- Validate real Windows microphone capture using the existing MIME fallback order:
  - `audio/webm;codecs=opus`
  - `audio/webm`
  - `audio/mp4`
- Preserve current chunking, transcript joining, and retry behavior.

### 10.6 Paste behavior
- Keep the current clipboard + simulated paste approach.
- On Windows, continue using the PowerShell `SendKeys("^v")` path unless Windows testing proves it insufficient.
- If paste fails:
  - keep transcript in clipboard
  - show a Windows-specific error hint
  - preserve manual `Ctrl+V` recovery

### 10.7 Settings and recovery
- Settings, logs, and restart must be reachable even when the main window is hidden.
- Logs path opening must work on Windows.
- Any Windows-specific permission guidance must be reflected in README and release notes.

## 11. Technical Approach

### 11.1 Platform shell adapter
Introduce a small platform-aware shell layer instead of sprinkling `process.platform` checks throughout the app:

- tray icon asset selection
- tray click semantics
- control-window positioning
- startup/login behavior
- status feedback strategy

### 11.2 Tray modernization
Update tray implementation so Windows gets its own behavior:

- use a Windows-specific `.ico` tray icon
- avoid relying on `setTemplateImage(true)` for Windows behavior
- add state-aware menu labels
- support left-click toggle
- keep right-click context menu

Recommended implementation note:

- use `tray.getBounds()` to anchor the control window near the tray on Windows
- keep macOS behavior unchanged unless a shared refactor is cleaner

### 11.3 Window positioning strategy
Current behavior:

- `mainWindow` is always positioned at the primary display's top-left margin

Windows v1 behavior:

- anchored near tray when shown from tray or hotkey
- clamped to the active display work area
- fallback to bottom-right work-area positioning if tray bounds are unavailable

### 11.4 Startup behavior
Extend login item registration to packaged Windows builds.

Implementation requirement:

- only enable on packaged builds
- validate that startup behavior works after NSIS install
- avoid dev-mode startup registration

### 11.5 Settings parity cleanup
Update Settings so Windows users can recover and operate without hand-editing config:

- expose `showControlWindow`
- preferably expose `cancelRecording` and `stopAndTranscribe`
- fix platform-specific hotkey labels
- ensure capture and display of Windows accelerators remain valid

### 11.6 Release configuration
Update `electron-builder` configuration so the Windows release is intentional:

- explicit x64 target for the default release lane
- optional arm64 secondary target
- Windows icon asset
- intentional artifact names

Recommended release lane:

- build public Windows artifacts on a Windows CI runner
- allow local Mac packaging for exploratory artifacts only

## 12. Must-Have vs Stretch Scope

### Must-have for first Windows release
- Windows x64 installer and ZIP
- Windows tray icon in notification area
- tray show/hide + hotkey recovery
- control window positioned for Windows use
- packaged startup behavior on Windows
- validated recording, transcription, paste, restart, and logs on Windows
- settings copy fixed for Windows terminology
- at least one real Windows smoke pass before release

### Stretch, do if cheap and stable
- cursor-follow overlay on Windows
- richer tray menu actions
- Windows balloon/toast notifications
- arm64 public artifact in the same release
- code signing

## 13. QA Plan

### 13.1 Required test environments
- Windows 11 x64, primary
- optional Windows 11 ARM or ARM emulation, secondary

### 13.2 Manual smoke checklist
- Install via NSIS installer
- Launch app and confirm tray presence
- Find app under the hidden-icons arrow
- Left click tray icon to show/hide
- Right click tray icon to open menu
- Use `Ctrl+Alt+M` to restore the window when hidden
- Record, transcribe, and paste into:
  - Notepad
  - Word or similar rich-text editor
  - Edge/Chrome text input
  - ChatGPT web input
  - VS Code editor
  - Windows Terminal
- Deny microphone permission and confirm failure messaging
- Trigger paste with no transcript and confirm recovery behavior
- Restart app from tray
- Open logs from tray or settings
- Reboot or relogin and verify startup behavior

### 13.3 Edge-case checks
- Multi-monitor setup
- 100%, 125%, and 150% display scaling
- tray icon collapsed vs pinned
- app hidden while transcription completes
- elevated target app where paste may fail

## 14. Acceptance Criteria
The Windows port is acceptable when all of the following are true:

1. A Windows x64 installer can be downloaded and installed successfully.
2. After install, VoicePaste appears in the Windows notification area and remains accessible through the hidden-icons arrow if collapsed.
3. Closing the control window hides it without quitting the app.
4. The app can always be restored via tray and via `Ctrl+Alt+M`.
5. Recording, transcription, and paste work end-to-end in at least Notepad, browser text input, VS Code, and Windows Terminal.
6. If paste automation fails, the transcript remains in the clipboard and the app gives the user a clear recovery hint.
7. Windows terminology and hotkey labels are correct in the UI.
8. Startup-at-login works in the packaged build, or is explicitly turned off in product scope before release.
9. At least one real Windows manual smoke pass is completed before public distribution.

## 15. Recommended Product Decisions To Approve Now
These are the defaults I recommend approving with this PRD:

1. Primary release target: Windows x64.
2. Secondary release target: Windows arm64 only if it does not slow down the first release materially.
3. Windows shell model: tray-first app in the notification area, not a taskbar-first app.
4. Window behavior: compact floating control window anchored near the tray, not fixed top-left.
5. Windows v1 status parity: strong tray/window feedback is required; cursor-follow overlay is a stretch goal, not a ship blocker.
6. Release pipeline: public Windows artifacts should be built on a Windows runner or a real Windows machine, even though exploratory Mac cross-packaging already works.

## 16. Implementation Phases

### Phase 1: Windows shell hardening
- explicit release targeting
- Windows tray assets and click behavior
- anchored control-window positioning
- startup/login behavior

### Phase 2: Settings and recovery parity
- Windows hotkey terminology
- expose missing recovery hotkeys
- tray actions for logs, settings, restart

### Phase 3: Real Windows validation
- smoke-test matrix
- fix paste, focus, DPI, and tray-edge cases
- finalize release artifact naming and docs

## 17. External Notes
Official Electron and electron-builder docs support the key implementation choices in this plan:

- Electron Tray docs: Windows tray icons should use `.ico`, Windows tray APIs support `getBounds()`, click handling, and Windows-specific tray behavior.
- Electron `app` docs: `setLoginItemSettings` supports Windows packaged apps.
- electron-builder CLI docs: Windows target architecture should be configured explicitly when default host-architecture output is not desired.

References:

- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray/)
- [Electron app API](https://www.electronjs.org/docs/latest/api/app)
- [electron-builder CLI targets and arch configuration](https://www.electron.build/cli)
