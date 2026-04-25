# VoicePaste v0.5 - Stap 1 PRD (Menu Bar Gedrag)

## 1. Doel
Tray/menu-bar gedrag versimpelen zodat:
- Klik op menu bar icoon **niet** direct het venster opent.
- Gebruiker expliciet `Show VoicePaste` kiest om het venster te tonen.
- Menu alleen de gewenste acties bevat.

## 2. Scope
Alleen menu bar/tray gedrag aanpassen.
Geen settings UI, geen nieuwe window controls, geen transcriptie-flow wijzigingen.

## 3. Functionele Requirements
- S1-FR-001: Klik op tray/menu-bar icoon opent het contextmenu, niet direct het control window.
- S1-FR-002: `Show VoicePaste` blijft in menu en opent/focust control window.
- S1-FR-003: `Restart VoicePaste` blijft in menu.
- S1-FR-004: `Quit VoicePaste` blijft onderaan in menu.
- S1-FR-005: Verwijder deze menu-items:
  - `Stop Recording`
  - `Cancel Recording (No Transcription)`
  - `Paste Last Transcript`
  - `Open Logs Folder`
- S1-FR-006: Tray/menu bar moet stabiel blijven (geen regressie in zichtbaarheid/recovery fallback).

## 4. UX Verwachting
- Eén klik op menu bar icoon: alleen menu tonen.
- Window verschijnt pas na klik op `Show VoicePaste`.
- Menu is minimalistisch: Show, Restart, Quit.

## 5. Technische Uitvoering
- Bestandsimpact: `src/main/main.ts`.
- `setupTray()`:
  - verwijder directe `showIndicator(...)` op tray click.
- `updateTrayMenu()`:
  - menu template reduceren naar:
    - `Show VoicePaste`
    - `Restart VoicePaste`
    - separator
    - `Quit VoicePaste`

## 6. Acceptatiecriteria
- S1-AC-001: Klikken op menu bar icoon opent niet automatisch het control window.
- S1-AC-002: `Show VoicePaste` opent/focust het control window.
- S1-AC-003: Alleen `Show`, `Restart`, `Quit` zichtbaar in tray menu.
- S1-AC-004: App blijft correct quitten via `Quit VoicePaste`.

## 7. Testplan
1. Start app; klik menu bar icoon.
- Verwacht: menu verschijnt, window blijft zoals het was.
2. Klik `Show VoicePaste`.
- Verwacht: control window verschijnt/focust.
3. Controleer menu-items.
- Verwacht: alleen Show, Restart, Quit.
4. Klik `Restart VoicePaste`.
- Verwacht: app relaunch.
5. Klik `Quit VoicePaste`.
- Verwacht: app sluit.
