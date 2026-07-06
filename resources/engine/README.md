# Embedded transcription engine

This directory holds the small **CPU** `whisper-server` binary that the app
launches as a child process for on-device transcription. Binaries are **not**
committed — they're fetched per platform or built by CI.

Layout expected by `src/main/engineAssets.ts`:

```
resources/engine/
  win32-x64/whisper-server.exe   (+ whisper.dll, ggml*.dll)
  darwin-arm64/whisper-server    (Metal-accelerated)
  darwin-x64/whisper-server
```

## Getting the binary

- **Development:** `npm run fetch-engine` (downloads the CPU build for your platform)
- **CI/Release:** the macOS workflow builds `whisper-server` from source into
  `resources/engine/darwin-*` before packaging.

The speech model (large-v3-turbo, 574 MB), the Silero VAD model and — on NVIDIA
machines — the CUDA build are **not** bundled. They're downloaded once on first
run into the user data dir, or reused from an existing install on disk.
