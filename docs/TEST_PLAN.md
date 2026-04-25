# VoicePaste Test Plan

## Manual Test Matrix

### macOS
- Paste into Notes
  - Steps: record short phrase, stop to transcribe, use paste hotkey in Notes
  - Expected: transcript inserted at cursor
- Paste into Terminal
  - Steps: record short phrase, stop, paste in Terminal prompt
  - Expected: transcript inserted without extra characters
- Paste into Safari search
  - Steps: focus Safari search bar, paste hotkey
  - Expected: transcript inserted in search field
- Paste into ChatGPT input (browser)
  - Steps: focus chat input, paste hotkey
  - Expected: transcript inserted
- Paste into VS Code editor
  - Steps: focus file editor, paste hotkey
  - Expected: transcript inserted

### Windows
- Paste into Notepad
  - Steps: record short phrase, stop, paste hotkey
  - Expected: transcript inserted
- Paste into Windows Terminal
  - Steps: focus prompt, paste hotkey
  - Expected: transcript inserted
- Paste into Edge search
  - Steps: focus search field, paste hotkey
  - Expected: transcript inserted
- Paste into ChatGPT input (browser)
  - Steps: focus chat input, paste hotkey
  - Expected: transcript inserted
- Paste into VS Code editor
  - Steps: focus file editor, paste hotkey
  - Expected: transcript inserted

## Recording / Chunking
- Long recording (simulate 3-5 minutes)
  - Expected: multiple segments created, no segment > 25MB
- Stop recording while segment active
  - Expected: last segment finalized and included in transcription

## Error Handling
- Missing API key
  - Expected: indicator shows error and guidance
- Invalid API key
  - Expected: error state, no crash, logs include response
- Simulate 429/5xx
  - Expected: retries with backoff, then error if still failing

## Config
- Custom hotkeys
  - Expected: hotkeys rebind and work system-wide
- restoreClipboard false
  - Expected: clipboard remains transcript
- languageMode override
  - Expected: API uses explicit language code

## Expected Results Summary
- Indicator reflects correct state transitions
- Transcription joins segments in order
- Paste works across target apps
