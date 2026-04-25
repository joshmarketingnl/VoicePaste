# VoicePaste v0.5 PRD (Execution Spec)

## 1. Document Status
- Version: `v0.5.0-prd`
- Date: `2026-02-13`
- Owner: `VoicePaste`
- Audience: CLI AI coding agent implementing v0.5 in current workspace
- Purpose: Fix menu bar discoverability/reopen reliability and migrate user config from v0.4.

## 2. Context
Current user pain:
1. Menu bar icon is not reliably visible/usable.
2. After hiding the control window, user cannot reliably reopen it.
3. User wants menu bar behavior (not Dock/taskbar dependence).
4. Existing v0.4 config (including API key/hotkeys) must carry over automatically to v0.5.

v0.5 is focused on reliability and access, not visual redesign.

## 3. Product Summary
VoicePaste v0.5 guarantees a recoverable control surface:
- Primary: reliable macOS menu bar icon.
- Secondary fallback: global hotkey to reopen control window even if tray/menu bar fails.
- Automatic one-time config migration from `voicepaste-v0.4` to `voicepaste-v0.5` on first run.

## 4. Locked Decisions
1. Menu bar is the primary access point on macOS.
2. Dock/taskbar presence remains hidden for packaged macOS builds.
3. Add explicit fallback hotkey to show/focus control window:
- Default macOS: `Command+Option+M`
- Works in all states.
4. Config migration precedence on first v0.5 launch:
- If v0.5 config exists: use it, do not overwrite.
- Else if v0.4 config exists: copy v0.4 config to v0.5 path.
- Else create default v0.5 config.
5. Existing v0.4 behavior (record/transcribe/paste fail-safes) must remain unchanged.

## 5. Goals
- Guarantee users can always reopen the control window after hiding it.
- Make menu bar presence reliable and visible.
- Preserve user settings/API key across v0.4 -> v0.5 upgrade.
- Keep implementation low-risk and compatible with existing architecture.

## 6. Non-Goals
- No full settings UI.
- No transcript history.
- No provider/model redesign.
- No new major UX animations or theme changes.

## 7. Functional Requirements

### 7.1 Menu Bar Reliability
- FR-501: On macOS, app must create tray/menu bar item during startup.
- FR-502: Tray icon must use packaged static template asset(s), not inline-only SVG.
- FR-503: Tray menu must include:
  - `Show VoicePaste`
  - `Restart VoicePaste`
  - `Quit VoicePaste`
- FR-504: Tray click must always call show/focus handler for control window.
- FR-505: If tray creation fails, log error and trigger retry strategy (at least one timed retry).

### 7.2 Reopen Control Window
- FR-506: New global hotkey `showControlWindow` reopens/focuses control window.
- FR-507: `showControlWindow` must work regardless of `idle/recording/transcribing/ready/error`.
- FR-508: Hide action from UI remains unchanged, but reopen must be guaranteed by tray and hotkey fallback.

### 7.3 Config Migration v0.4 -> v0.5
- FR-509: Add migration logic in config loader.
- FR-510: Source path:
  - macOS: `~/Library/Application Support/voicepaste-v0.4/config.json`
  - equivalent platform-specific v0.4 userData path when applicable
- FR-511: Destination path:
  - v0.5 userData `config.json`
- FR-512: Migration must preserve all known keys and unknown extra keys (copy file, then merge/validate at load).
- FR-513: Log whether migration happened, was skipped, or failed.

### 7.4 Versioning and Packaging
- FR-514: Bump metadata to v0.5:
  - package name `voicepaste-v0.5`
  - version `0.5.0`
  - appId `com.voicepaste.v05`
  - productName `VoicePaste v0.5`
- FR-515: Build/package artifacts must produce v0.5-named output files.

## 8. Technical Design

### 8.1 Tray Icon Assets
- Add `src/main/assets/trayTemplate.png` (and optional `trayTemplate@2x.png`).
- `createTrayIcon()` loads file-based nativeImage and sets template mode.
- Keep fallback path:
  - if asset load fails, fallback to generated icon and log warning.

### 8.2 Main Process Changes (`src/main/main.ts`)
- Harden `setupTray()`:
  - create tray once
  - catch failures
  - retry once after delay (e.g., 1500ms)
- Add handler `handleShowControlWindow()` and reuse from:
  - tray click
  - tray menu “Show VoicePaste”
  - new `showControlWindow` hotkey
- Register hotkey in `registerHotkeys()` and include in registration error checks.

### 8.3 Shared Config/Types
- Extend `HotkeysConfig` with:
  - `showControlWindow: string`
- Defaults:
  - macOS: `Command+Option+M`
  - Windows/Linux: `Ctrl+Alt+M`
- Preserve backward compatibility: missing key falls back to default.

### 8.4 Config Loader (`src/main/config.ts`)
- Before existing parse/default flow:
  - ensure destination dir exists
  - if destination config missing and v0.4 config exists -> copy v0.4 config
- Then run existing merge validation.

## 9. Implementation Plan
1. Add `prdv0.5.md` and progress log entry.
2. Add tray template asset(s) and update `src/main/trayIcon.ts`.
3. Add `showControlWindow` hotkey to shared types/config defaults/merge.
4. Add show-window handler and wire tray click/menu + hotkey.
5. Harden tray initialization with retry + logging.
6. Add config migration in `src/main/config.ts`.
7. Bump package metadata to v0.5.
8. Update README with:
  - new hotkey
  - migration note
  - menu bar recovery behavior
9. Add/update tests:
  - config defaults include `showControlWindow`
  - merge compatibility when key missing
  - migration behavior (unit tests for config loader with temp dirs/mocks)
10. Validate: `lint`, `typecheck`, `test`, `build`, `package:mac`.

## 10. Acceptance Criteria
- AC-501: Menu bar icon appears on app launch (macOS packaged app).
- AC-502: After hiding the control window, user can reopen via menu bar click.
- AC-503: If menu bar interaction fails, `Command+Option+M` reopens control window.
- AC-504: v0.5 first launch reuses v0.4 config automatically when v0.5 config does not exist.
- AC-505: Existing v0.4 recording/transcription/paste flows remain intact.
- AC-506: v0.5 package artifact is generated and launchable.

## 11. Manual Test Matrix (v0.5)
1. Fresh v0.5 launch with existing v0.4 config.
- Expected: API key/hotkeys preserved.
2. Hide control window via UI button.
- Expected: click menu bar icon restores window.
3. Hide window again; use `Cmd+Opt+M`.
- Expected: window restores.
4. Start recording; ensure tray menu still responsive.
- Expected: no crashes, normal behavior.
5. Restart app from tray menu.
- Expected: relaunches cleanly.
6. Quit app from tray menu.
- Expected: exits cleanly.

## 12. Risks and Mitigations
- Risk: tray asset missing in package.
- Mitigation: include asset in build files and add runtime fallback icon.

- Risk: migration copies invalid JSON from old config.
- Mitigation: copy first, then validate with existing merge logic; if parse fails, log and recover with defaults.

- Risk: hotkey conflicts for `Cmd+Opt+M`.
- Mitigation: make configurable in config.
