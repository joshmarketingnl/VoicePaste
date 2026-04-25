# VoicePaste v0.2 Test Plan

## Setup Prerequisites
- `OPENAI_API_KEY` set or `apiKey` in config.
- Microphone permission granted.
- macOS Accessibility + Automation permissions for paste.
- Fresh config in userData with v0.2 defaults.

## Manual Test Matrix

### macOS
- Safari/Chrome input
  - Steps: record short phrase, stop, focus URL/search bar, paste hotkey
  - Expected: transcript inserted; if paste fails, clipboard contains transcript
- ChatGPT web input
  - Steps: record, stop, focus ChatGPT input, paste hotkey
  - Expected: transcript inserted
- Terminal
  - Steps: record, stop, focus Terminal prompt, paste hotkey
  - Expected: transcript inserted
- VS Code/Codex
  - Steps: record, stop, focus editor, paste hotkey
  - Expected: transcript inserted
- Notes
  - Steps: record, stop, focus Notes, paste hotkey
  - Expected: transcript inserted

### Windows
- Chrome input
  - Steps: record, stop, focus search field, paste hotkey
  - Expected: transcript inserted
- PowerShell terminal
  - Steps: record, stop, focus prompt, paste hotkey
  - Expected: transcript inserted
- VS Code
  - Steps: record, stop, focus editor, paste hotkey
  - Expected: transcript inserted
- Notepad
  - Steps: record, stop, paste hotkey
  - Expected: transcript inserted

## Feature Tests
- Indicator visibility on launch
  - Expected: indicator appears top-left on app start
- Hide/show
  - Steps: click hide button, then click tray icon
  - Expected: indicator hides and reappears
- Restart button
  - Steps: click restart button
  - Expected: app relaunches within a few seconds
- Cancel recording hotkey
  - Steps: start recording, press cancel hotkey
  - Expected: recording stops, no transcription, returns to idle
- Long recording
  - Steps: record >2 minutes
  - Expected: multiple segments, no 25MB errors

## Common Failure Modes
- Paste fails due to permissions
  - Expected: UI shows fallback message and clipboard contains transcript
- OpenAI API errors
  - Expected: indicator shows error, logs capture status
