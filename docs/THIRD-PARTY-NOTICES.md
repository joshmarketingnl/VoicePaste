# Third-party notices

VoicePaste bundelt of downloadt de volgende externe componenten. De volledige
licentieteksten zijn te vinden via de vermelde bronnen.

## whisper.cpp (transcriptiemotor)
- Bron: https://github.com/ggml-org/whisper.cpp (v1.9.1)
- Licentie: MIT — © Georgi Gerganov e.a.
- Gebruik: `whisper-server` draait als los kindproces voor lokale transcriptie.

## Whisper-spraakmodel (large-v3-turbo, q5_0)
- Bron: https://huggingface.co/ggerganov/whisper.cpp (conversie van OpenAI Whisper)
- Licentie: MIT (OpenAI Whisper-modelgewichten)
- Gebruik: eenmalig gedownload naar de gebruikersdata-map.

## Silero VAD-model (v5.1.2)
- Bron: https://huggingface.co/ggml-org/whisper-vad
- Licentie: MIT — © Silero Team
- Gebruik: optionele spraakdetectie; eenmalig gedownload.

## FFmpeg (audio-conversie)
- Bron: https://ffmpeg.org — gebundelde/gedownloade builds:
  - Windows: BtbN FFmpeg-Builds (LGPL-variant) — https://github.com/BtbN/FFmpeg-Builds
  - macOS: statische builds van Martin Riedl — https://ffmpeg.martin-riedl.de
- Licentie: LGPL v2.1 of later (Windows-build); de macOS-build kan GPL-
  gelicenseerde onderdelen bevatten — zie de bijgeleverde licentie-informatie
  van de betreffende build.
- Gebruik: FFmpeg draait als los, ongewijzigd programma (apart proces) voor
  audio-conversie. De broncode is beschikbaar via https://ffmpeg.org en de
  bovengenoemde build-repositories.

## Electron & Chromium
- Licentie: MIT (Electron); Chromium-licenties zijn meegeleverd in
  `LICENSES.chromium.html` naast de applicatie.

## Overige npm-afhankelijkheden
- Zie `package.json`; alle runtime-afhankelijkheden zijn MIT/ISC/BSD-gelicenseerd.
