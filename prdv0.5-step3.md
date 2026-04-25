# VoicePaste v0.5 - Stap 3 PRD (Window Resize + Action Buttons)

## 1. Doel
Control window functioneler maken met 2 directe acties:
- Recording button (play/stop gedrag).
- Copy to Clipboard button.
En kleine grootte-aanpassing van het window.

## 2. Scope
- Window iets breder en hoger.
- Nieuwe knoppen in control window.
- Transcribe-cancel/start-new-recording flow vanaf knop.

## 3. Functionele Requirements
- S3-FR-001: Vergroot control window licht:
  - iets breder
  - iets hoger
  - zonder bestaande UX te breken.
- S3-FR-002: Voeg recording button toe.
- S3-FR-003: Recording button states:
  - Idle/Ready/Error: play-icoon (start recording)
  - Recording: square-icoon (stop recording -> transcribe)
- S3-FR-004: Tijdens transcribing:
  - binnen ~0.5-0.6s switcht knop terug naar play-icoon
  - in die eerste 0.5-0.6s visueel disabled (geen highlight)
- S3-FR-005: Als user daarna op recording button klikt tijdens transcribing:
  - huidige transcriptie wordt afgebroken/geannuleerd
  - direct nieuwe recording start
  - geen error state door deze user actie.
- S3-FR-006: Voeg `Copy to Clipboard` knop toe.
- S3-FR-007: Copy button werkt alleen als transcript beschikbaar is.
  - tijdens recording/transcribing: disabled (geen highlight), geen actie.
  - bij ready: kopieert transcript naar clipboard, zonder paste-simulatie.

## 4. UX Verwachting
- Knoppen visueel consistent met bestaande stijl.
- Disabled knoppen duidelijk minder prominent.
- Geen onverwachte error popups bij user-click flow.

## 5. Technische Uitvoering
- Verwachte bestandsimpact:
  - `src/main/main.ts`
  - `src/main/preload.ts`
  - `src/renderer/index.html`
  - `src/renderer/renderer.ts`
  - `src/renderer/styles.css`
  - `src/renderer/global.d.ts`
- Nodig: cancelbare transcriptie-call in main (AbortController of equivalent).
- Nodig: nieuwe IPC voor:
  - `commandAbortTranscriptionAndStart` (of vergelijkbaar)
  - `copyTranscriptToClipboard`.

## 6. Acceptatiecriteria
- S3-AC-001: Window is merkbaar iets groter maar behoudt huidige look/feel.
- S3-AC-002: Recording button werkt als play/stop volgens state.
- S3-AC-003: Tijdens transcribing kan user (na cooldown) op play klikken om transcriptie te annuleren en opnieuw op te nemen.
- S3-AC-004: Copy button kopieert alleen wanneer transcript beschikbaar is.
- S3-AC-005: Disabled states hebben geen actieve highlight.

## 7. Testplan
1. Idle -> klik play.
- Verwacht: recording start.
2. Recording -> klik square.
- Verwacht: recording stopt, transcribing start.
3. Tijdens transcribing:
- check 0.5-0.6s disabled state.
- daarna klik play.
- Verwacht: transcribing geannuleerd, nieuwe recording start.
4. Copy knop in recording/transcribing.
- Verwacht: disabled/no-op.
5. Copy knop in ready.
- Verwacht: transcript in clipboard.
