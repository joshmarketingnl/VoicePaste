# VoicePaste v0.2 Architecture

## Overview
Electron app with a small always-on-top indicator UI. Main process handles system integration (hotkeys, tray, OpenAI, clipboard, paste automation, logging). Renderer handles microphone capture and MediaRecorder chunking.

## Main process responsibilities
- Global hotkeys: toggle, paste, cancel recording
- Tray/menu-bar: menu + click-to-show indicator
- State machine and logging
- OpenAI transcription pipeline
- Clipboard + paste automation
- App restart and indicator visibility control

## Renderer responsibilities
- getUserMedia + MediaRecorder capture
- Segment buffering and rotation
- UI rendering and button handling (hide/restart)

## IPC Messages
Renderer -> main:
- `startRecording`
- `stopRecording` (segment paths)
- `recordingCancelled` (segment paths)
- `audioSegmentReady`
- `recordingError`
- `hideIndicator`
- `restartApp`

Main -> renderer:
- `commandStart`
- `commandStop`
- `commandCancel`
- `stateUpdate`
- `transcriptReady`
- `error`

## Temp files / segment handling
- Segments written to temp dir (`os.tmpdir()/voicepaste/session-*`).
- Rotations restart the MediaRecorder to ensure each segment is valid.
- On stop, all segment paths are sent for transcription.
- On cancel, segments are deleted without transcription.

## Paste injection
- Clipboard set to transcript.
- macOS: `osascript` System Events (Cmd+V).
- Windows: PowerShell WScript.Shell SendKeys (Ctrl+V).
- If paste fails, show fallback message and keep clipboard.

## Why these choices
- Electron provides reliable cross-platform hotkeys and tray support.
- MediaRecorder restart per segment avoids corrupted WebM chunks on long recordings.
- Clipboard + paste keystroke works across most apps without native deps.
