# VoicePaste v0.2 PRD (Delta)

## 1. Scope
Deze PRD beschrijft aanvullende eisen bovenop `docs/PRD.md` voor v0.2.

## 2. Doelen
- Snelle zichtbaarheid van de indicator via tray/menu-bar.
- Een expliciete hide-knop voor de indicator.
- Een snelle app-herstartknop vanuit de UI.
- Indicator zichtbaar bij app start, en linksboven gepositioneerd.
- Een hotkey om opname te stoppen zonder transcription.

## 3. Niet-doelen
- Geen nieuwe transcriptie-functionaliteit of history.
- Geen grote UI herontwerp; minimaal en functioneel.

## 4. UX / UI
### 4.1 Indicator controls
- Voeg een kleine hide-knop toe in de indicator UI om het venster te verbergen.
  - Verbergen mag alleen de UI verbergen; de app blijft actief.
- Voeg een kleine herstart-knop toe in de indicator UI.
  - Vorm: klein vierkant knopje met een cirkelpijl.
  - Actie: app sluit af en start direct opnieuw op.
- Indicator verschijnt standaard bij app start (niet pas bij recording).
- Indicator opent linksboven in beeld (niet gecentreerd).

### 4.2 Tray/Menu-bar gedrag
- Klik op het tray/menu-bar icoon maakt de indicator weer zichtbaar (show).
- Dit gedrag geldt voor macOS en Windows.

### 4.3 Extra hotkey (stop zonder transcription)
- Voeg een hotkey toe om een lopende opname te stoppen en de audio weg te gooien (geen transcription).
  - macOS default: `Command+Option+S`
  - Windows default: `Ctrl+Alt+S`
  - Hotkey is configureerbaar via `config.json`.

## 5. Technische eisen
- Herstart actie moet betrouwbaar zijn zonder data te verliezen in config/logs.
- Als herstart wordt getriggerd tijdens opnemen/transcriberen, mag de huidige operatie afgebroken worden.
- Logging: noteer hide/show en restart acties in `logs/app.log`.
- Stop-zonder-transcription hotkey moet segmenten verwijderen en terugkeren naar `idle`.

## 6. Acceptatiecriteria
- Hide-knop verbergt de indicator zonder de app te stoppen.
- Tray/menu-bar klik maakt de indicator zichtbaar.
- Restart-knop herstart de app binnen enkele seconden en de app is weer bruikbaar.
- Indicator is zichtbaar bij app start en staat linksboven.
- Stop-zonder-transcription hotkey stopt de opname en maakt geen transcript.
