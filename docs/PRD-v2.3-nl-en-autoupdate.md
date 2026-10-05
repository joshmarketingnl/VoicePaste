# PRD v2.3.0 — alleen Nederlands + Engels, en auto-update

**Datum:** 2026-10-05 · **Aanvrager:** Josh (via orchestratie-agent) · **Uitvoering:** Claude
**Waarom:** Whisper gokt in de stand `auto` soms een derde taal. Josh en Frank dicteren alleen
Nederlands en Engels (vaak door elkaar). Frank moet de update krijgen zonder zijn sleutel of
instellingen te verliezen, en liefst nooit meer handmatig hoeven te installeren.

## Feiten vooraf (gemeten 05-10)
- `languageMode` bestaat al (`auto|en|nl|es`, standaard `auto`) maar heeft **geen UI**. Iedereen
  staat dus feitelijk op `auto`. Eén `language` per request, niets bij auto.
- Lokale motor (whisper.cpp v1.9.1) geeft bij `response_format=verbose_json` de gebruikte taal
  (`language: "dutch"`) én een kansverdeling per taal (`language_probabilities.nl/.en`).
  Kost **~110 ms extra** per dictaat (0,33→0,43 s EN, 0,55→0,66 s NL, GPU). Op alle testclips
  (NL echt, EN TTS, NL 1,5 s) was de detectie juist.
- OpenAI: `whisper-1` geeft `language` + `segments[].avg_logprob` in verbose_json, geen kansen.
  Het standaardmodel `gpt-4o-mini-transcribe` kent géén verbose_json en geeft geen taal terug;
  wel `include: ["logprobs"]` (SDK 4.77 ondersteunt het).
- Geen autoUpdater. Config staat in userData `voicepaste-developer-beta-v1.1/config.json`
  (afgeleid van package-`name`, die verandert niet). NSIS verwijdert userData niet bij
  her-installatie → sleutel en instellingen blijven, mits we `name` en `appId` niet wijzigen.
- Open bug uit augustus: `Setup.exe /S` (stil installeren) gaf exit-code 2. electron-updater
  installeert juist stil → **eerst oplossen**.

## 1. Taalmodus "Nederlands + Engels"
- Nieuwe waarde `nl-en`, **standaard**. UI-keuze in Instellingen: *Nederlands + Engels
  (aanbevolen)* · *Alleen Nederlands* · *Alleen Engels*. `es` blijft werken voor wie het al had.
- `auto` verdwijnt als modus: oude/missende/ongeldige waarde → `nl-en`. `nl`/`en`/`es` blijven.
- Algoritme per segment:
  1. Transcribeer zonder taal (zoals nu), maar vraag de taalinformatie mee.
  2. Taal bepalen: `language` uit het antwoord, of (gpt-4o-*) een tekstcheck
     (stopwoorden NL/EN + niet-Latijns schrift). Te kort om te zeggen → accepteren.
  3. NL of EN → klaar. **Geen extra call bij normaal gebruik.**
  4. Anders opnieuw, geforceerd:
     - kansverdeling aanwezig (lokaal) → `argmax(nl, en)`, één extra call;
     - anders beide geforceerd en de zekerste kiezen (`avg_logprob`/`logprobs`);
       geen zekerheidsmaat → voorkeur = UI-taal (nl voor Josh/Frank).
- Custom endpoint: verbose_json proberen, bij een 4xx terugvallen op json + tekstcheck.

## 2. Migratie zonder verlies
`mergeConfig` doet alleen `languageMode`: `auto`/leeg/ongeldig → `nl-en`. Sleutel, model,
provider, sneltoetsen, engine, slaaptijd: onaangeroerd. **Test:** een v2.2.x-config met sleutel
gaat door de migratie en komt er byte-gelijk uit op `languageMode` na.

## 3. Auto-update
- `electron-updater` met GitHub Releases (repo is publiek, geen token nodig).
- `nsis.artifactName` zonder spaties (`VoicePaste-Setup-${version}.exe`), zodat de bestandsnaam
  in `latest.yml` gelijk is aan de asset op GitHub (GitHub maakt van spaties punten).
- **Windows:** download op de achtergrond; installeren op een rustmoment: als de motor na
  15 min stilte gaat slapen, of bij afsluiten. Nooit tijdens opnemen/transcriberen. Tray-item
  "Bijwerken naar vX (herstart)" voor wie niet wil wachten.
- **macOS:** zonder Apple-ondertekening ($99/jr, eerder bewust afgewezen) kan een app zichzelf
  niet vervangen. Daar: melding + tray-item "Nieuwe versie beschikbaar" dat de downloadpagina
  opent. Eerlijk benoemen naar Frank/Josh.
- Release-upload moet voortaan `latest.yml` (+ blockmap) meenemen.

## 4. Release v2.3.0
- CI bouwt; assets: `VoicePaste-Setup-2.3.0.exe`, `latest.yml`, blockmap, win-zip, 2× mac-zip.
- **Bewijs vóór release:** installeren over v2.2.x heen → `config.json` (met sleutel) identiek.
- **Bewijs auto-update:** geïsoleerde testbuild (eigen appId/naam/userData, lokale feed)
  9.9.1 → 9.9.2 automatisch bijgewerkt, config blijft staan. Raakt Josh' eigen installatie niet.

## 5. Frank
OS, sleutel-of-lokaal en versie gevraagd via de orchestrator. Berichtje: kort, zonder AI-taal,
downloadlink + "gewoon installeren, je instellingen blijven staan". Josh stuurt het zelf.

## Kosten
€0. Geen OpenAI-calls: er is geen sleutel op deze pc, en de cloudlogica wordt met unit-tests
op nep-antwoorden gedekt. Een echte cloudtest (< €0,01) alleen met Josh' ja en een sleutel.

## Testplan
- Unit: migratie (5 gevallen), taalbesluit (lokaal/whisper-1/gpt-4o/custom, mis- en goed-detectie),
  tekstcheck (NL, EN, NL met Engelse vaktermen, Duits, Spaans, Cyrillisch, kort).
- Echt: lokale motor met NL/EN/mixed-opnames; geforceerde mismatch-route.
- E2E-rooktest in CI blijft groen (gebruikt de echte motor).
- Installatie-over-de-oude-heen + auto-update-test zoals hierboven.
