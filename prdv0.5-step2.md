# VoicePaste v0.5 - Stap 2 PRD (Settings UI + Keybind Config)

## 1. Doel
Settings toevoegen in het control window met alleen de noodzakelijke opties:
- API key beheren (masked input).
- 2 keybinds configureren: recording toggle en paste.
- Open Logs knop in settings.

## 2. Scope
Alleen settings-gerelateerde UI/IPC/config.
Geen layout-uitbreiding voor nieuwe action buttons (dat is stap 3).

## 3. Functionele Requirements
- S2-FR-001: Voeg `Settings` knop toe naast `Hide` en `Restart` in control window.
- S2-FR-002: Klik op `Settings` opent klein settings-paneel/modal in dezelfde window.
- S2-FR-003: API key veld:
  - masked/weergave verborgen (password style),
  - wel selecteerbaar, plakbaar en kopieerbaar,
  - opslaan naar `config.json` (zelfde key: `apiKey`).
- S2-FR-004: Keybind instelling voor:
  - `toggleRecord`
  - `pasteTranscript`
- S2-FR-005: Keybind capture modus:
  - gebruiker klikt “Set keybind”,
  - toetsencombinatie wordt opgebouwd terwijl toetsen ingedrukt zijn,
  - pas opslaan zodra **alle** ingedrukte toetsen weer losgelaten zijn.
- S2-FR-006: Validatie:
  - combinatie moet minimaal 1 niet-modifier key bevatten.
  - bij conflict/fout melding tonen en niet opslaan.
- S2-FR-007: Na save wordt hotkey registratie herladen zonder app restart (indien haalbaar), anders gecontroleerde restart met bevestiging.
- S2-FR-008: Voeg `Open Logs Folder` knop toe in settings paneel.

## 4. UX Verwachting
- Settings compact, functioneel en snel.
- Geen uitgebreide preferences app; alleen noodzakelijke velden.
- Duidelijke states: idle, listening-for-shortcut, saved, error.

## 5. Technische Uitvoering
- Verwachte bestandsimpact:
  - `src/renderer/index.html`
  - `src/renderer/renderer.ts`
  - `src/renderer/styles.css`
  - `src/renderer/global.d.ts`
  - `src/main/preload.ts`
  - `src/main/main.ts`
  - `src/main/config.ts`
  - eventueel nieuwe IPC handlers (`getConfig`, `saveConfig`, `openLogsFolder`, `rebindHotkeys`).
- Config update:
  - wijzig alleen `apiKey`, `hotkeys.toggleRecord`, `hotkeys.pasteTranscript`.
  - overige keys intact laten.

## 6. Acceptatiecriteria
- S2-AC-001: Settings knop zichtbaar en werkt.
- S2-AC-002: API key kan veilig aangepast en opgeslagen worden.
- S2-AC-003: Recording/paste keybinds kunnen via capture-flow gezet worden (save bij release-all).
- S2-AC-004: Nieuwe keybinds werken daadwerkelijk daarna.
- S2-AC-005: Open Logs knop opent logs-map.

## 7. Testplan
1. Open settings en wijzig API key.
- Verwacht: opgeslagen in config, masked in UI.
2. Stel recording keybind in via capture.
- Verwacht: pas save na key release; hotkey werkt.
3. Stel paste keybind in via capture.
- Verwacht: idem.
4. Probeer ongeldige combo (alleen modifiers).
- Verwacht: foutmelding, niet opslaan.
5. Klik Open Logs.
- Verwacht: logs map opent.
