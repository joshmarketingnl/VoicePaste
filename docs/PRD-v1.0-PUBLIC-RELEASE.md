# PRD — VoicePaste v1.0: klaar voor publieke release

**Status:** actief · **Datum:** 2026-07-07 · **Eigenaar:** Josh · **Uitvoering:** Josh + Claude
**Doel:** VoicePaste veilig, legaal en betrouwbaar publiceren (website-download voor Windows + macOS), zodanig dat bugs bij gebruikers (a) zeldzaam zijn, (b) direct zichtbaar worden en (c) binnen een uur bij iedereen gefixt zijn.

---

## 1. Definitie van "klaar"

De app is klaar voor publicatie als aan **alle** onderstaande exit-criteria is voldaan:

- [ ] Builds zijn ondertekend (Windows-cert + Apple notarization) — geen SmartScreen/Gatekeeper-blokkade.
- [ ] Auto-update werkt: een nieuwe release bereikt bestaande installaties automatisch.
- [ ] E2E-rooktest draait groen op Windows + macOS bij elke wijziging op `main`.
- [ ] Fouten bij gebruikers zijn zichtbaar: crash-/diagnoserapportage of één-klik "stuur logs".
- [ ] 0 openstaande dependency-kwetsbaarheden; Electron-versie vastgepind.
- [ ] Juridische basis aanwezig: third-party-licenties, privacyverklaring, EULA.
- [ ] Beta-periode afgerond: ≥7 aaneengesloten dagen dagelijks gebruik (Josh + ≥2 vrienden, beide platforms) zonder nieuwe bug.

## 2. Waar we staan (2026-07-07)

**Functioneel af en gehard:** ingebouwde lokale transcriptiemotor met GPU-autodetectie (beta.5), DPI-groeibug gefixt (beta.6), transparante indicator + 144Hz volgen (beta.7), single-instance-lock (beta.8), download-stall-detectie + retries + zichtbare voortgang (beta.9). Stem-test op Windows geslaagd; mac-builds draaien via CI.

**Vandaag toegevoegd:** dependencies opgeschoond (8 kwetsbaarheden → 0), e2e-rooktest in CI (Windows + macOS).

## 3. Waarom er bugs bleven komen — en het beleid daartegen

Analyse van de bugs van deze week: **geen enkele was een herhaling** en vrijwel alle kwamen uit de categorie *integratie/omgeving* (Electron-upgrade × DPI-scaling; achtergebleven oude installatie; gestalde download; platform-verschillen). Unit-tests kunnen die per definitie niet vangen.

**Beleid vanaf nu — elke gefixte bug krijgt een blijvende bewaker:**

| Bug (gefixt) | Bewaker |
|---|---|
| Venster groeit bij fractionele DPI | `setBounds` met vaste maat, zelfherstellend (beta.6) |
| Oude versie kaapt autostart/hotkeys | Single-instance-lock; tweede instantie sluit direct (beta.8) |
| Gestalde download = bevroren app | 30s-stall-abort + 3 retries + voortgang in UI (beta.9) |
| Omgevings-/integratieregressies algemeen | **E2E-rooktest op schone Win+mac-machines bij elke push** |
| Kwetsbare dependencies | Dependabot-meldingen wekelijks naar 0; Electron bewust upgraden (nooit "gratis" bij een andere fix) |

Regel: een bugfix is pas af als er iets is dat dezelfde klasse bug in de toekomst tegenhoudt of zichtbaar maakt.

## 4. Werkpakketten

### P0 — blockers voor publicatie

| # | Wat | Eigenaar | Inschatting |
|---|---|---|---|
| P0.1 | **Apple Developer Program** aanmaken ($99/jr) | **Josh** | 30 min + wachttijd |
| P0.2 | **Windows code-signing** regelen (Azure Trusted Signing ~€9/mnd, of OV-cert) | **Josh** | 1-2 uur + verificatie-wachttijd |
| P0.3 | Signing + **notarization** integreren in CI (mac) en build (win) | Claude | dagdeel, na P0.1/P0.2 |
| P0.4 | **Auto-update** via electron-updater + GitHub Releases. Windows eerst; mac vereist P0.3 (Squirrel weigert unsigned) | Claude | dagdeel |
| P0.5 | **Diagnose-rapportage**: minimaal "kopieer/verstuur log"-knop in Settings; daarna Sentry (gratis tier) voor crashes | Claude | half dagdeel / dagdeel |
| P0.6 | ~~E2E-rooktest CI~~ ✅ + ~~dependencies naar 0~~ ✅ | Claude | klaar |

### P1 — vóór de publieke download-pagina

| # | Wat | Eigenaar |
|---|---|---|
| P1.1 | **Installer als standaard-download** (Setup.exe / notarized dmg-of-zip); portable zip alleen als alternatief. Voorkomt "oude map in Downloads"-klasse problemen bij gebruikers | Claude |
| P1.2 | **THIRD-PARTY-NOTICES.md** bundelen: whisper.cpp (MIT), ffmpeg (LGPL, incl. bronverwijzing), Electron/Chromium, model-licentie | Claude |
| P1.3 | **Privacyverklaring**: transcriptie is lokaal, audio verlaat het apparaat niet; OpenAI-modus expliciet benoemen (AVG) | Claude concept → Josh akkoord |
| P1.4 | **EULA/licentie** voor de app zelf kiezen (gratis beta: simpele proprietary EULA volstaat) | Josh beslist, Claude schrijft |
| P1.5 | **Downloadpagina** (per platform juiste file, versienummer, changelog, systeemeisen) | Josh (site) + Claude (inhoud) |
| P1.6 | **First-run zonder NVIDIA** één keer end-to-end testen (CPU-pad; de rooktest dekt dit deels al af) | Claude |

### P2 — kwaliteit van leven (na launch oké)

- Auto-update op macOS (na signing), delta-updates.
- Sentry-alerts → automatische issue-aanmaak.
- Oude releases (≤ beta.5) markeren als "verouderd".
- Engine-download hervatten i.p.v. opnieuw beginnen.
- Meertalige UI-check (nl/en consistentie).

## 5. Beta-fase (de "nooit meer rotzooien"-poort)

1. **Feature freeze** zodra P0 af is: alleen nog bugfixes, geen nieuwe features tot v1.0.
2. Josh + ≥2 vrienden (minimaal één mac, één Windows) installeren via de échte downloadflow (signed installer, auto-update aan).
3. Elke bug die opduikt: fixen → bewaker toevoegen (§3) → auto-update pusht de fix.
4. **Exit-criterium:** 7 aaneengesloten dagen dagelijks gebruik zonder nieuwe bug én zonder crash-rapport → v1.0 taggen en publiceren.

## 6. Kosten (jaarlijks terugkerend)

| Post | Bedrag |
|---|---|
| Apple Developer Program | $99/jr |
| Windows signing (Azure Trusted Signing) | ~€110/jr |
| Sentry / crash-rapportage | €0 (gratis tier) |
| GitHub (CI + releases) | €0 (publieke repo) |
| **Totaal** | **~€210/jr** |

## 7. Volgorde van uitvoering

```
Week 1  ├─ Josh: P0.1 + P0.2 aanvragen (wachttijden lopen dan alvast)
        ├─ Claude: P0.4 auto-update (Windows), P0.5 log-knop, P1.2/P1.3 teksten
Week 2  ├─ Claude: P0.3 signing-integratie zodra certs binnen zijn, dan mac auto-update
        ├─ P1.1 installer-flow, P1.5 downloadpagina-inhoud
        └─ Feature freeze → beta-fase start
Week 3+ └─ 7 schone dagen → v1.0
```

**Eerstvolgende concrete acties:**
1. **Josh**: Apple Developer-account aanmaken (developer.apple.com) en Azure Trusted Signing starten — dit zijn de enige twee dingen die alleen jij kunt doen, en de wachttijd bepaalt de planning.
2. **Claude**: auto-update (Windows) + "stuur logs"-knop in de volgende beta.
