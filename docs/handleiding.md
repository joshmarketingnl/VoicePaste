# VoicePaste: handleiding

VoicePaste zet wat je zegt om in tekst en plakt die waar je cursor staat: in je mail, in Word, in WhatsApp Web, overal. Het werkt op je eigen computer. Er gaat geen geluid naar internet.

*English version: [manual.md](manual.md)*

## Installeren

**Windows**

1. Download [VoicePaste-Setup.exe](https://github.com/joshmarketingnl/VoicePaste/releases/latest/download/VoicePaste-Setup.exe) en open het.
2. Zegt Windows "Windows heeft uw pc beschermd"? Klik op **Meer informatie** en dan **Toch uitvoeren**. De app is nog niet ondertekend bij Microsoft; dat is de reden van die melding.
3. VoicePaste start vanzelf en staat voortaan in het systeemvak rechtsonder, naast de klok.

**Mac**

1. Download op de [releasepagina](https://github.com/joshmarketingnl/VoicePaste/releases/latest) het zip-bestand voor jouw Mac: `arm64-mac.zip` voor een Mac met Apple-chip (M1 of nieuwer), `mac.zip` voor een oudere Intel-Mac.
2. Open het zip-bestand en sleep VoicePaste naar **Programma's**.
3. Open VoicePaste. Houdt macOS hem tegen? Ga naar **Systeeminstellingen › Privacy en beveiliging** en klik onderaan op **Open toch**.
4. VoicePaste vraagt om twee toestemmingen: **Microfoon** (om je te horen) en **Toegankelijkheid** (om te plakken). Het welkomstscherm laat zien welke nog uit staat en springt op groen zodra je hem aanzet.

De eerste keer haalt VoicePaste het spraakmodel op (ongeveer 550 MB). Dat duurt een paar minuten. Daarna werkt alles ook zonder internet.

## Dicteren

| Wat | Windows | Mac |
|---|---|---|
| Opnemen starten | Ctrl+Alt+Shift+R | Cmd+Option+R |
| **Stoppen en plakken** | Ctrl+Alt+Shift+V | Cmd+Option+V |
| Stoppen zonder plakken | Ctrl+Alt+Shift+C | Cmd+Option+C |
| Laatste tekst nog een keer plakken | Ctrl+Alt+Shift+V | Cmd+Option+V |
| Opname weggooien | Ctrl+Alt+Shift+S | Cmd+Option+S |
| Venster tonen | Ctrl+Alt+Shift+M | Cmd+Option+M |

Zo gaat het bijna altijd: zet je cursor waar de tekst moet komen, druk op **opnemen**, praat, en druk op **plakken**. VoicePaste stopt, zet het om en plakt het. Een bolletje bij je muis laat zien of hij opneemt, bezig is of klaar is.

Je kunt Nederlands en Engels door elkaar gebruiken. Lange stukken zijn geen probleem: ook een opname van tien minuten werkt.

## Instellingen

Klik op het VoicePaste-icoon (Windows: systeemvak; Mac: menubalk bovenin) en kies **Settings**. Daar stel je in:

- **Gesproken taal**: Nederlands + Engels (aanbevolen), alleen Nederlands, alleen Engels of alleen Spaans.
- **Taal van de app**: Nederlands of Engels.
- **Sneltoetsen**: klik op een toets, druk de nieuwe combinatie in en sla op.
- **Motor**: standaard lokaal op je computer. Heb je een eigen OpenAI-sleutel, dan kan het ook via OpenAI. Let op: dan gaat je geluid wel naar OpenAI en rekent OpenAI per minuut af op jouw account.

## Updates

- **Windows**: updates gaan vanzelf, op een rustig moment. Je hoeft niets te doen.
- **Mac**: je krijgt een melding als er een nieuwe versie is. Klik erop; de app legt de drie stappen uit. Daarna moet je vaak Toegankelijkheid opnieuw aanzetten. Het welkomstscherm herkent dat en wijst je de weg.

## Als er iets misgaat

- **Mislukt omzetten?** Je opname wordt bewaard. Klik op **Opnieuw proberen** in het venster, of op "Mislukte opname opnieuw proberen" in het menu van het icoon.
- **"Er kwam geen geluid binnen"**: de microfoon staat uit, op stil, of de verkeerde microfoon is gekozen. Op een Mac: kijk of VoicePaste aan staat onder Privacy en beveiliging › Microfoon.
- **Hulp nodig?** Open **Settings**, klik bij Hulp op **Diagnose kopiëren** en plak dat in een bericht aan Josh. Er staan geen sleutels of persoonlijke mappen in.

## Veelgestelde vragen

**Kost het iets?**
Nee. VoicePaste is gratis en werkt op je eigen computer. Alleen als je zelf kiest voor een OpenAI-sleutel betaal je OpenAI voor het gebruik.

**Gaat mijn stem naar internet?**
Nee, niet met de standaardinstelling. Het omzetten gebeurt op je computer. Internet is alleen nodig voor de eerste download en voor updates.

**Hij plakt niets.**
Mac: zet VoicePaste aan onder Systeeminstellingen › Privacy en beveiliging › Toegankelijkheid (na een update soms opnieuw). Windows: in programma's die als administrator draaien mag een gewone app niet plakken; open daar het VoicePaste-venster (Ctrl+Alt+Shift+M), klik op **Kopiëren** en plak zelf met Ctrl+V.

**De eerste keer na een pauze duurt het even.**
Klopt. Na een kwartier niets doen ruimt VoicePaste het spraakmodel op om geheugen vrij te maken. Bij de volgende opname wordt het wakker terwijl je praat; meestal merk je er dan niets van.

**Het omzetten is traag.**
Op een computer met een NVIDIA-videokaart of een Mac met Apple-chip duurt het meestal één tot drie seconden. Zonder zo'n videokaart rekent de processor alles uit en dat kan tot een halve minuut duren. Wil je het sneller, dan kan het via een eigen OpenAI-sleutel.

**Hoeveel ruimte en geheugen gebruikt het?**
Het spraakmodel is ongeveer 550 MB. Tijdens het werken gebruikt het ongeveer 2 GB geheugen, dat na een kwartier stilte weer vrijkomt.

**Hij verstaat een woord steeds verkeerd.**
Spreek in hele zinnen; losse woorden zijn lastiger. Namen en vaktermen gaan soms mis. Lees de tekst even na voordat je iets verstuurt.

**Hoe verwijder ik het?**
Windows: Instellingen › Apps › VoicePaste › Verwijderen. Mac: sleep VoicePaste uit Programma's naar de prullenmand.

**Vragen of ideeën?**
VoicePaste is gemaakt door Josh. Stuur een berichtje via [WhatsApp](https://wa.me/+31647569554).
