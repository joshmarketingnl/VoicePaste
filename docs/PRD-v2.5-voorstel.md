# PRD v2.5 (voorstel, tak `voorstel/v2.5`) + HANDOFF

**Datum:** 2026-10-12 · **Opdracht:** orchestratie-agent namens Josh · **Status:** in uitvoering, NIETS uitbrengen.
Josh: "maak usage volledig op… echt alles op alles gebruikt" (sub tot 15-10). Werk door tot alles af is.

## Stand 2.4 (tak `voorstel/v2.4`, versie 2.4.0-beta.1, gepusht, NIET uitgebracht)
- Commits: e247b2a PRD · 7d4ef1a GPU+taalregel · 2c1acc9 vroeg transcriberen + plakhelper + updater-log · 2084d8e Mac-paneel + CI.
- Review-artifact met ja/nee per punt: https://claude.ai/artifact/22MTWfCmCngrEhX251ziRA
  Keuzes staan in db-collectie `keuzes` (doc-ids: lange-opnames, eerste-plak, gpu, korte-taal,
  mac-paneel, klein, apple-ondertekening, uitbrengen). Lezen: `ArtifactData list collection=keuzes`.
- CI op de tak groen: e2e-smoke (Win+Mac), mac-update-check, build-macos (run 38240650414).
- Bij Josh' "ga verder" voor 2.4: keuzes lezen → nee-punten terugdraaien → versie 2.4.0 → tag → CI →
  release met assets (Setup-x.exe, blockmap, latest.yml, win-zip, 2 mac-zips, latest-mac.yml,
  kopie VoicePaste-Setup.exe) → Josh' pc werkt zichzelf bij (auto-update).
- **Open Frank-vragen:** Windows of Mac? Eigen OpenAI-sleutel of lokale motor? (Alleen nodig voor
  het berichtje bij de release.)

## Nieuwe opdracht (12-10, op tak `voorstel/v2.5`, gebaseerd op v2.4)
1. Testdekking + robuustheid: crashrapportage lokaal, microfoonwissel, slaapstand, wegvallend netwerk, lege opnames.
2. Mac: onboarding gladstrijken; permissieproblemen automatisch herkennen en uitleggen.
3. Documentatie: korte handleiding NL/EN + FAQ.
4. Roadmap 2.5 op basis van praktijkdata.
Oplevering: één artifact met vóór/ná en ja/nee per punt (zoals 2.4). Antwoord via SendMessage aan "Orchestration agent".

## Praktijkdata (alle logs 25-04 t/m 12-10, `context/fielddata-v25/stats.json`, script mine.py)
- 2.348 opnames, 116 actieve dagen, mediaan 15/dag, max 81 (9-9). Afgebroken 66.
- Opnameduur mediaan 29 s, p90 120 s, max 12 min; 15,5% > 90 s (profiteert van vroeg transcriberen); 6% < 5 s.
- Transcriptie mediaan 1,16 s, p90 3,0 s.
- 94% (2201/2262) gestopt met de PLAK-sneltoets tijdens opname (stop+plak in één); kopieerknop 9×.
- Fouten 31 (1,3%): "Microphone access failed" 12× (19 jul 2×, 20 jul 2×, 20 aug 7× = RODE na RAM-wissel, 9 sep 1×) — echte
  oorzaak gaat verloren; "Nothing to paste yet" 9× (o.a. na lege transcriptie of meteen na opstarten);
  "Transcription failed" 7× (4× Connection error = juli oude beta, 2× 401 verkeerde API-sleutel, 1× 400
  audio 0,06 s te kort); "No audio captured" 3×.
- Motor: 4× start mislukt met 0xC0000142 — altijd direct na exit 0x40010004 (Windows stopt motor bij
  afsluiten) en meteen herstartpoging tijdens afsluiten. 17× exit 0x40010004 (afsluiten/taskkill). Geen dictaat verloren.
- Renderer-crashes: juli (oude beta's) + 2× "killed" 0xC000013A bij afsluiten. GPU false 2× (12-8).
- Stilte/ruis geven lege tekst (VAD werkt), geen verzonnen zinnen.

## Plan v2.5 (uit te voeren)
- `micErrors` (gedeeld, getest): DOMException-naam → toestemming / geen apparaat / bezet-of-kapot /
  onbekend; NL/EN-uitleg per OS + knop naar de juiste instelling (ms-settings:privacy-microphone,
  x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone). Eén herkansing bij NotReadable.
- Microfoon valt weg tijdens opname (track 'ended') → netjes stoppen en transcriberen wat er is + melding.
- Stilte: piekniveau meten in renderer (AnalyserNode); < −70 dB = geen signaal → niet transcriberen, uitleg.
- Lege transcriptie: vorige transcript behouden, melding "Niets verstaan" i.p.v. "Nothing to paste yet".
- Mislukte transcriptie: audio bewaren in userData/failed (max 5, 7 dagen) + "Opnieuw proberen" (tray/knop);
  specifieke melding (401 sleutel, geen verbinding, te kort).
- Afsluiten: `session-end`/powerMonitor `shutdown` → motor niet herstarten. `suspend` tijdens opname →
  netjes stoppen; `resume` → motor-check + plakhelper opwarmen.
- Lokaal crashrapport: crashReporter (uploadToServer:false), bij start "vorige sessie gecrasht" loggen;
  knop "Diagnose kopiëren" (versie, OS, motor, config zonder sleutel, laatste logregels, paden geanonimiseerd).
- Mac-toestemmingen: bij start getMediaAccessStatus + isTrustedAccessibilityClient; paneel met checklist +
  knoppen; ook na update (rechten weg bij niet-ondertekende app) en bij plakfout "not allowed".
- E2E-opnametest met nep-microfoon (Chromium `--use-file-for-fake-audio-capture`), env-gated testmodus
  (eigen userData, geen hotkeys/autostart/plakken/vensters): normaal, lang (rotatie+vroeg), leeg, stilte,
  microfoon weg, motor gecrasht, netwerk weg + opnieuw. Lokaal (geïsoleerd) + CI Win/Mac.
- Docs: docs/handleiding.md (NL), docs/manual.md (EN), FAQ erin; tray "Help".
- Roadmap 2.5 uit data: stop+plak = 94% → optie één toets; CPU-only pc's (meten!) → kleiner model/Vulkan;
  geschiedenis laatste dictaten; woordenlijst (namen); cloud→lokaal bij geen netwerk; ondertekening.

## Werkafspraken (blijven gelden)
- Josh' eigen app NOOIT omwisselen/killen zonder app.log-check (geen recording/transcribing).
- Installer/update-tests buiten de Claude-container via WMI (zie geheugen appdata-virtualisatie).
- Test-whisper-server: poort 18765 met Josh' model (`context/langtest-v24`), daarna stoppen.
- GitHub-token via `git credential fill`, na gebruik wissen. Geen kosten zonder Josh' ja.
- Sneltoetsen van Josh nooit aanpassen.
