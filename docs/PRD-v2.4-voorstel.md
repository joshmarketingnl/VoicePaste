# PRD v2.4 (voorstel, tak `voorstel/v2.4`) — Mac, NL+EN-proef, kleine verbeteringen

**Datum:** 2026-10-12 · **Aanvrager:** Josh via orchestratie-agent · **Status:** op een tak, géén release.
Josh beoordeelt per punt ja/nee in één review-pagina (voor/na). €0.

## Praktijkdata eerste week v2.3.0 (05–12 okt, Josh' pc)
94 transcripties · 0× derde taal · 0 fouten · GPU 18/18 starts · plakken 73× zonder wachten,
3× gewacht op losgelaten toetsen (255–420 ms, de v2.2.4-fix werkt). Uitschieters:
- eerste plakactie na opstarten 4,5 s (hulpproces start koud, time-out 1,5 s → terugval);
- 10-minuten-opname: 16 s wachten na stoppen (7 segmenten pas ná stoppen getranscribeerd).

## 1. Mac zonder betaalde ondertekening
- Bij een nieuwe versie: paneel in de app met 3 stappen + knop die direct de juiste zip
  downloadt (Apple-chip of Intel, automatisch), i.p.v. de GitHub-pagina met 7 bestanden.
- Installatie-instructie voor een niet-ondertekende app, actueel voor macOS 15 (Sequoia):
  rechtsklik → Open werkt daar niet meer; Systeeminstellingen → Privacy en beveiliging → Open toch.
- CI-test op macOS: testbuild 9.9.1 ziet 9.9.2 op een lokale feed en meldt het.
- Vraag aan Josh: Apple Developer Program ($99/jr). Wat het oplost (waarschuwing weg,
  echte auto-update, microfoon-/toegankelijkheidsrechten blijven na updates) en wat niet.

## 2. NL+EN-modus beproeven
Lokale motor (gratis). Testset: Josh' echte opnames (70 min NL-gesprek, in 90-s-segmenten
zoals de app; Engelstalige muziekopname), lokale TTS (Piper, NL/BE/EN-stemmen): NL, EN,
NL met Engelse vaktermen, Engels met Nederlands accent, Vlaams, lange opname, stilte/kort.
Vergelijk oude `auto` vs `nl-en` vs geforceerd `nl`: aandeel derde taal, foutwoorden (WER
waar de brontekst bekend is), behoud Engelse termen, extra requests. Tekstcheck (cloudroute)
op alle uitkomsten: valse alarmen = onnodige extra kosten.

## 3. Kleine verbeteringen zonder keuze
- GPU-detectie: meerdere pogingen met ruimere time-out; een CPU-uitkomst wordt bij het
  wakker worden opnieuw beoordeeld (oktober-bug: 49 s i.p.v. 1 s per dictaat).
- Plak-hulpproces opwarmen bij opstarten + ruimere opstarttijd (4,5 s → normaal).
- Lange opnames: segmenten al tijdens het opnemen transcriberen (alleen lokale motor,
  dus geen kosten bij afbreken). 16 s → ~2 s na stoppen.
- Updater logt "geen update" ook (nu onzichtbaar of hij checkt).

## Oplevering
Review-artifact: per punt voor/na, bewijs, ja/nee. Tak + CI-builds als testbestand.
