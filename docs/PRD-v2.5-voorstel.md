# PRD v2.5 (voorstel, tak `voorstel/v2.5`) + HANDOFF

**Datum:** 2026-10-12 · **Opdracht:** orchestratie-agent namens Josh · **Status:** gebouwd en getest, review-artifact klaar; NIETS uitgebracht.
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
- Renderer-crashes (17 regels): 10× "killed" 0xC000013A = Windows sluit af; 8× "crashed" in de beta-week
  3-6 juli. Sinds 2 september niets. Geen open probleem. GPU false 2× (12-8).
- ~~Stilte/ruis geven lege tekst~~ FOUT: dat gold alleen voor plain json. De app vraagt verbose_json, en dan
  crasht whisper-server (0xC0000005) zodra VAD 0 spraakstukken vindt (stilte, ruis -45 dB, gedempte mic).
  Reproduceerbaar 10/10 op 1.9.1 én b5454 (6 okt), CPU en GPU. ggml-org/whisper.cpp#3595 (gesloten, niet
  opgelost). In Josh' logs 0× (echte microfoon geeft altijd wat spraak/ruis die VAD als spraak ziet).

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

## GO van Josh (12-10, via orchestratie-agent) → release "VoicePaste 2.0"
Letterlijk: "je mag alles van VoicePaste wel toevoegen, maar ik zou het dan wel VoicePaste 2.0 noemen…
talen alleen Nederlands en Engels… alles doorvoeren naar GitHub. Frank gebruikt Windows en heeft een eigen OpenAI key."
Plan (status bijhouden met [x]):
- [ ] Talen: alleen NL+EN (LanguageMode 'es' weg uit types/config/UI/docs; oude 'es' → 'nl-en').
- [ ] R1 lokaal model: `localModel: 'auto'|'accurate'|'fast'`; auto = groot op Mac of NVIDIA, klein (ggml-small-q5_1) op pc zonder NVIDIA. Instelling.
- [ ] R2 optie: opnemen-toets stopt+plakt tijdens opname (`recordKeyPastes`, standaard uit).
- [ ] R3 woordenlijst (`vocabulary`) als whisper `prompt`; eerst meten (nltech-clip + stilte).
- [ ] R4 geschiedenis laatste 10 (`keepHistory`, standaard aan, userData/history.json, tray-submenu kopieert).
- [ ] R6 offline-reserve (`offlineFallback`, standaard aan): openai/custom + geen verbinding → lokaal omzetten als het model er is; model op de achtergrond klaarzetten.
- [ ] Docs bijwerken (handleiding/manual/README-kop).
- [ ] Versie 2.5.0 (technisch; updater werkt alleen naar hoger dan 2.3.0), releasetitel "VoicePaste 2.0".
- [ ] Merge naar main, tag v2.5.0, CI (build-macos levert assets; e2e-smoke), release met alle assets + VoicePaste-Setup.exe-kopie.
- [ ] Releasebericht voor Frank (Windows, eigen OpenAI-sleutel), zonder AI-taal.
- [ ] Reviewpagina bijwerken (uitgebracht, vóór/ná) + melden aan orchestratie-agent.
Niet: R5 (openbare reactie whisper.cpp, geen expliciete ja) en Apple-ondertekening ($99/jr, Josh moet zelf
aanmelden + expliciet ja op kosten) → open punten.

## Review-artifact 2.5
https://claude.ai/artifact/6rN5q3YjXHSG9kxAfc1f9b · db-collectie `keuzes`, doc-ids: stilte-crash, dubbele-motor,
hangen, microfoon, opnieuw-proberen, welkom, mac-toestemming, handleiding, diagnose, klein, r-klein-model,
r-een-toets, r-woordenlijst, r-geschiedenis, r-upstream, r-cloud-lokaal, uitbrengen ("ja" = 2.4+2.5 samen als 2.5.0).
Bron: `output/voicepaste-2.5-voorstel.html` (bouw: `context/screenshot-v25/build.py`, screenshots `shoot.cjs`).

## Resultaat (12-10 avond)
Commits op `voorstel/v2.5`: b864c25 PRD · c653d3d robuustheid · 70a8eb3 onboarding · 2debe9e E2E + fixes ·
cc19adb handleiding/CI · (laatste) foutmelding volledig + hidden-fix. 93 unit-tests, E2E 13/13 lokaal.

Gevonden door de E2E-test en opgelost:
1. whisper-server crasht op verbose_json zonder spraak → app meldde "Geen verbinding". Nu: `recover()` wacht
   op de herstarte motor (nieuwe poort!) en vraagt dat stuk opnieuw als plain json → "" → "Niets verstaan".
2. Herstart-timer riep `start()` direct aan; een opname tegelijk startte er nog één → 2-3 whisper-servers,
   één wees met ~2 GB (Windows ruimt die pas op bij afsluiten van de app, Mac nooit). Nu via `ensureReady()`.
3. OpenAI SDK 4.104 herhaalt een weggevallen upload met de al verstuurde multipart-body → hangt tot de
   SDK-time-out van 10 min. Nu `maxRetries: 0`, eigen retries met verse upload, cloud-time-out 2 min.
4. Motor niet klaar → opname werd weggegooid. Nu bewaard + "Opnieuw proberen".
5. "Object has been destroyed" bij afsluiten (send naar vernietigd venster). `sendToMainWindow()`.
6. Foutmelding afgekapt na één regel; venster 250 px bij fout met knop/lange tekst, tekst mag 4 regels.
7. `[hidden]` verloor van de flex-CSS: Windows toonde een Mac-blok "Microfoon: Uit".

Testmodus: `VOICEPASTE_E2E=1` (+ `VOICEPASTE_USER_DATA_DIR`, `VOICEPASTE_FAKE_MIC`, `VOICEPASTE_E2E_PORT`),
`src/main/e2e.ts`, script `scripts/e2e-recording.mjs --engine-source <dir> [--long] [--only a,b]`.
Lokaal: `--work context/e2e-v25/work`, engine-bron = `%APPDATA%\voicepaste-developer-beta-v1.1\engine`
(hardlinks, bron wordt nooit beschreven). Draait naast Josh' eigen app zonder die te raken.

Whisper vouwt identieke herhalingen samen (20 lussen van één zin → 4 in de tekst): de lange test gebruikt
daarom 163 s verschillende zinnen; 98% van de woorden kwam terug, 2 segmenten.

## Roadmap 2.5 (voorstel, keuzes in het review-artifact)
| # | Wat | Data | Werk | Advies |
|---|---|---|---|---|
| R1 | Pc zonder NVIDIA: automatisch klein model | i7-12700 CPU: 10 s-clip 27,9 s → 7,4 s; 30 s 35,6 → 10,4 s. WER NL 6,9% → 2,8%, NL-vaktermen 9,2% → 21,1%. BLAS maar 10-15% sneller; `-ac 768` onbruikbaar (WER 93%). | M | Ja, met instelling "Nauwkeurig (langzamer)" |
| R2 | Eén toets: opnemen-toets stopt+plakt tijdens opname (optie, standaard uit) | 94% stopt met de plaktoets | S | Ja, als optie |
| R3 | Woordenlijst (namen, vaktermen) via whisper `prompt` | vaktermen 9,2% WER tegen 6,9% gewoon | S | Ja, eerst meten |
| R4 | Geschiedenis laatste 10 dictaten (lokaal, uit te zetten) | kopieerknop 9×, "Nothing to paste" 9× | S-M | Ja |
| R5 | Stilte-crash melden bij whisper.cpp (#3595, publiek) | 10/10 reproduceerbaar | S | Ja, Josh beslist (publiek) |
| R6 | Cloud → lokaal bij geen netwerk | 4× Connection error (juli) | M | Nee/later; "Opnieuw proberen" dekt het |
| R7 | Ondertekening Apple/Windows | zie 2.4-keuze | — | Zie 2.4 |
| R8 | Crashrapporten insturen (opt-in) | lokaal crashReporter staat | M | Nee (privacybelofte) |

## Werkafspraken (blijven gelden)
- Josh' eigen app NOOIT omwisselen/killen zonder app.log-check (geen recording/transcribing).
- Installer/update-tests buiten de Claude-container via WMI (zie geheugen appdata-virtualisatie).
- Test-whisper-server: poort 18765 met Josh' model (`context/langtest-v24`), daarna stoppen.
- GitHub-token via `git credential fill`, na gebruik wissen. Geen kosten zonder Josh' ja.
- Sneltoetsen van Josh nooit aanpassen.
