# VoicePaste Architecture

## Overview
VoicePaste is an Electron app with a small always-on-top indicator UI. The main process owns system integration (global hotkeys, tray, clipboard, paste automation, OpenAI calls, logging). The renderer owns microphone capture and chunking (MediaRecorder), then sends audio segments to main for disk writes and transcription.

## Processes and Responsibilities
- Main process:
  - Global hotkeys (start/stop, paste)
  - Tray/menu
  - State machine + logging
  - OpenAI transcription (SDK)
  - Clipboard + paste automation (macOS/Windows)
  - Config loading and validation
- Renderer process:
  - getUserMedia + MediaRecorder recording
  - Segment buffering and rotation
  - Indicator UI (state, timer, spinner)
  - Uses preload IPC bridge for file writes + state updates

## IPC
- Renderer -> main:
  - `startRecording`
  - `stopRecording` (segment paths)
  - `audioSegmentReady` (path)
  - `recordingError`
- Main -> renderer:
  - `stateUpdate`
  - `error`
  - `transcriptReady`

## State Machine
States: `idle` -> `recording` -> `transcribing` -> `ready` or `error`. Errors can transition to `error` and return to `idle` when dismissed.

## Audio Chunking
- MediaRecorder emits small chunks.
- Renderer accumulates chunks into a segment buffer.
- Segment rotates when size approaches 20MB or time threshold (e.g., 90s).
- Renderer requests main to write each segment to a temp folder; ordered paths are sent back for transcription.

## Transcription
- Main reads segments and calls OpenAI Audio Transcriptions API.
- Retries for transient errors (429/5xx) with backoff.
- Segment transcripts are joined with whitespace normalization.

## Paste Automation
- Clipboard is set to transcript, then OS-specific paste is triggered:
  - macOS: `osascript` System Events Cmd+V
  - Windows: PowerShell + WScript.Shell SendKeys `^v`
- Optional clipboard restore after delay.

## Config
- JSON config in app `userData` folder
- Keys: hotkeys, model, languageMode, restoreClipboard, indicator

## Logging
- File log at `logs/app.log` with state transitions and errors.
- Optional diagnostics mode for verbose logs.
