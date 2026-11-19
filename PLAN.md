# Plan: Svenska övningar B1–B2

Vervolg op de A1–A2-site ([svenska_ovningar](https://github.com/bvweerd/svenska_ovningar), hoofdstuk 0–12).
Deze repo bevat hoofdstuk 13–30. De A1–A2-site blijft ongewijzigd.

## 0. Uitgangspunt: auteursrecht

We volgen het **stramien** van een gangbare B1+B2-cursus: 12 hoofdstukken op B1 en 6 op B2,
elk met een thema, een praktisch doel en een schrijfdoel. Teksten, dialogen, oefeningen,
woordenlijsten, hoofdstuktitels en uitleg schrijven we **zelf**. Er wordt niets uit een
lesmethode overgenomen.

## 1. Opbouw per hoofdstuk

| Onderdeel | Inhoud | Vraagtypen |
|---|---|---|
| Läsa | tekst van 300–600 woorden met vragen over inhoud en bedoeling | mc, truefalse + verbetering, multi |
| Ord och fraser | woorden, uitdrukkingen, partikelwerkwoorden; flitskaarten worden gegenereerd | match, gap met keuzelijst |
| Grammatik | 2–3 kaarten met uitleg, daarna oefeningen | gap, transform, order, sort |
| Lyssna | luistertekst (tekst eerst verborgen), „welke vorm hoor je?”, dictee | listen, truefalse |
| Praktiskt | situatie of dialoog bij het praktische doel | dialogue, mc |
| Skriva | register, bouwstenen, schrijfopdracht met checklist en voorbeeld | sort, gap, free |
| Zoek de fout | fouten uit het hoofdstuk | findError |
| Herhaling | gemengd, vanaf hoofdstuk 14 | alle |

## 2. Hoofdstukken (eigen indeling)

Zie `content/index.yaml` voor thema, doel en schrijfdoel per hoofdstuk.

| Nr | Niveau | Thema | Grammatica |
|---|---|---|---|
| 13 | B1 | Werk en solliciteren | lijdende vorm met -s, som-zinnen, formele mail |
| 14 | B1 | Opleiding | lijdende vorm met bli, deelwoorden |
| 15 | B1 | Wonen en buurt | partikelwerkwoorden (1), där/dit/vars |
| 16 | B1 | Instanties en regels | werkwoorden op -s, formeel taalgebruik |
| 17 | B1 | Gezondheid en zorg | ska / kommer att / tänker, voorzetsels bij werkwoorden |
| 18 | B1 | Relaties | skulle, voorwaarde en wens |
| 19 | B1 | Media en nieuws | indirecte rede, vem som |
| 20 | B1 | Natuur en milieu | någon/ingen, man/en/ens |
| 21 | B1 | Cultuur en tradities | bepaalde vorm zonder lidwoord, samenstellingen |
| 22 | B1 | Reizen en verkeer | partikelwerkwoorden (2), verbindingswoorden |
| 23 | B1 | Eten en consumeren | woordvorming, vergelijken |
| 24 | B1 | Samenleving | mening geven, trots att / även om / medan; B1-eindtoets |
| 25 | B2 | Werk en economie | nominalisatie |
| 26 | B2 | Wetenschap | deelwoordconstructies, lange naamwoordgroepen |
| 27 | B2 | Politiek en debat | betoog, det är … som |
| 28 | B2 | Taal en identiteit | register, uitdrukkingen |
| 29 | B2 | Geschiedenis | lange bijzinnen, keuze van het eerste zinsdeel |
| 30 | B2 | Toekomst | herhaling; B2-eindtoets |

## 3. Techniek

Zelfde basis als de A1–A2-site (Vite, vanilla JS, YAML-inhoud, automatisch nakijken).
Nieuw in deze repo:

- **Niveaus** in `index.yaml` (`levels`, `level` per hoofdstuk): startpagina en menu gegroepeerd.
- **Doel en schrijfdoel** per hoofdstuk op de hoofdstukpagina.
- **Luisteren** met de spraakfunctie van de browser (`src/speech.js`):
  - knop „Lees voor” bij teksten, „Beluister de zin” na elke vraag, luisteren bij flitskaarten;
  - vraagtype `listen` (dictee of „wat hoor je?”), luisterteksten met verborgen tekst (`listen: true`);
  - pagina **Luisteren instellen** (`#/luisteren`): status, stemkeuze, snelheid, testzin,
    oordeel (goed/matig/slecht, anoniem gemeten) en uitleg per browser en systeem;
  - **Dictee** (`#/oefenen/luisteren`) met zinnen en woorden uit alle hoofdstukken;
  - zonder Zweedse stem of zonder spraak: waarschuwing en „Toon de tekst”.
- **Vraagtype `sort`**: regels indelen in categorieën.
- **Vraagtype `transform`**: een Zweedse zin herschrijven (actief → passief, twee zinnen → één).
- Voortgang onder een **eigen sleutel** (`svensk-ovningar-b:`), los van de A1–A2-site
  (beide staan op hetzelfde domein).
- Statistieken met voorvoegsel **/b** in GoatCounter.

## 4. Fasen

- [x] **Fase 0** – niveaus, luisteren, sort, transform, nieuwe repo
- [x] **Fase 1** – proefhoofdstuk 13 (werk en solliciteren)
- [ ] Testen of de browserstemmen goed genoeg zijn (oordelen in GoatCounter: `/b/luisteren/oordeel/…`)
- [x] **Fase 2** – hoofdstuk 14–24, één voor één (met eindtoets B1 in hoofdstuk 24)
- [x] **Fase 3** – hoofdstuk 25–30 (met herhaling en eindtoets B2 in hoofdstuk 30)
- [x] Werkwoordtrainer uitbreiden met B1-werkwoorden en partikelwerkwoorden
      (45 partikelwerkwoorden als eigen soort in de trainer, na **taalreview**)

## 5. Kanttekeningen

- Op B1/B2 zijn er vaak meer goede formuleringen. We kiezen vooral opdrachten met een
  vast antwoord; vrij schrijven krijgt een checklist en een voorbeeld.
- Nuances (partikels, register, ska/kommer att) vragen eigenlijk controle door een moedertaalspreker.
- De kwaliteit van het voorlezen hangt af van het apparaat. Edge (online stemmen) en
  macOS/iOS met „Verbeterd”-stemmen klinken het best; espeak op Linux het slechtst.

## Uitbreiding: meer woorden en oefeningen (plan van november 2026)

Uitgangspunt (gemeten): de woordenlijsten zijn klein (A1–A2: 284 woorden, B1–B2: 348) en
oefeningen hebben 4–5 vragen, waardoor herhalen steeds dezelfde zinnen oplevert.
Dit plan geldt voor beide sites; de code is gedeeld (zie README, „Twee sites, één code”).

**Taalreview.** Elke stap met nieuwe of gewijzigde Zweedse stof krijgt een aparte reviewronde
op Zweedse taal en grammatica, vóórdat de stof wordt gepubliceerd. De reviewer is iemand (of
een aparte AI-sessie) die de stof leest zonder het werk van de schrijver te kennen. Die
controleert:
- spelling, woordgeslacht (en/ett), bepaalde vorm, meervoud en werkwoordsvormen;
- grammatica en woordvolgorde van voorbeeldzinnen en antwoorden;
- of de Nederlandse vertaling klopt en eenduidig is (geen tweede lezing die ook goed is);
- of woorden en zinnen passen bij het niveau (A1–A2 of B1–B2) en idiomatisch Zweeds zijn;
- of alle goede antwoorden worden goedgekeurd en de foutregels (`feedback`) terecht zijn.
Bevindingen worden verwerkt of met reden afgewezen; twijfelgevallen gaan naar de eigenaar.
Daarna leest de eigenaar steekproefsgewijs mee. Pas dan wordt er gepubliceerd.

- [x] **Fase 1 – techniek**: rondes van 15 woorden bij lange woordenlijsten (eerst nieuwe en
      foute woorden; voortgang blijft bewaard); per woord optioneel meervoud (`pl`) en een
      voorbeeldzin (`ex`, `exNl`) met automatisch gemaakte oefeningen; controle op dubbele
      woorden; `npm run vocab-report`.
- [x] **Proef**: hoofdstuk 2 naar 63 woorden → **taalreview** (twee rondes) → goedgekeurd door de eigenaar.
- [x] **Fase 2**: hoofdstuk 1–12 naar ±60 woorden per hoofdstuk, per hoofdstuk een **taalreview**.
      Hoofdstuk 1 en 3–12 naar 55–64 woorden (715 in totaal) → **taalreview** (twee rondes) →
      goedgekeurd door de eigenaar.
- [x] **Fase 3**: hoofdstuk 13–30 naar ±60 woorden (meer uitdrukkingen en partikelwerkwoorden),
      per hoofdstuk een **taalreview**.
      Hoofdstuk 13–30 naar 58–62 woorden (1083 in totaal) → **taalreview** (twee rondes) →
      goedgekeurd door de eigenaar.
- [x] **Fase 4**: kernoefeningen naar 8–10 vragen, luistervragen in de A1–A2-site,
      ±80 werkwoorden erbij in de werkwoordtrainer; per hoofdstuk of per lijst een **taalreview**.
      Gedaan en na **taalreview** verwerkt: 82 werkwoorden erbij (146 in totaal); alle kernoefeningen
      (grammatica, zonder lezen/luisteren/schrijven/herhaling) hebben nu minstens 8 vragen
      (±420 vragen erbij); in hoofdstuk 0–12 een onderdeel Luisteren met een meerkeuze-
      luisteroefening en een dictee (130 vragen).
- [ ] **Fase 5**: aan de hand van GoatCounter kijken welke oefeningen gebruikt worden en vaak
      fout gaan, en daar verder uitbreiden (met **taalreview** voor nieuwe stof).
      `npm run stats` maakt het overzicht (README, „Statistieken”). Eerste meting (19 november):
      nog maar ±200 antwoorden, vooral uit tests. Wat er is, wijst op de sje-/tje-klank en de
      zachte klinkers (hoofdstuk 0: tips verduidelijkt, vragen erbij) en op de correctievraag in
      lasa-annons (meer goede antwoorden). Op de B1–B2-site meldt Chrome vaak geen Zweedse stem.
      Over een paar weken opnieuw meten, met `--min 5`.

## Verbeterplan didactiek (plan van november 2026)

Uitgangspunt: een didactische review van beide sites. Sterk zijn de directe, gerichte feedback,
de herhaling met intervallen en de uitleg die Nederlands en Zweeds vergelijkt. Zwak: bijna 90% van
de vragen gaat over vorm, vertalen of herkennen, vrij schrijven is ±1% en spreken ontbreekt. Op B2
toetst de site vooral grammatica, en de eindtoetsen beloven meer dan ze meten.
Dit plan geldt voor beide sites. Elke stap met nieuwe of gewijzigde Zweedse stof krijgt een
**taalreview** (zie hierboven); gedeelde code gaat naar beide repo's (`npm run check-sync`).
Elke fase eindigt met een meetmoment; pas daarna begint de volgende fase.
**Geen AI en geen externe diensten**: alles werkt in de browser en offline, er gaan geen teksten of
opnames naar een server (alleen de bestaande anonieme tellingen via GoatCounter blijven).
**De app kijkt na, niet de leerling**: geen zelfbeoordeling; wat de app niet kan nakijken, is
oefenen zonder oordeel.
**Buiten het plan: spreken en uitspraak.** Spraakherkenning is niet goed genoeg om uitspraak na te
kijken en werkt in de browser alleen via een externe dienst, zelf terugluisteren vraagt
zelfbeoordeling, en er is geen moedertaalspreker voor echte opnames. Spreken en de computerstem
blijven daarom open punten; fase 1 meldt de computerstem, en de handleiding kan voor spreken een
docent of taalpartner aanraden.

- [x] **Fase 1 – snelle verbeteringen**
  - [x] Eindtoetsen H24 en H30 herformuleren: „Herhaling B1-/B2-grammatica”, met wat 16/20
        betekent en dat B1/B2 ook lezen, luisteren, spreken en schrijven omvat. Id's blijven gelijk.
  - [x] Per hoofdstuk 2–3 kan-doen-uitspraken (ERK) in een veld `canDo`, elk met de onderwerpen
        (`topics`) waar hij op rust, met validatietest.
  - [x] Automatisch afvinken: ✓ als de vragen van die onderwerpen grotendeels (±80%) in doos 3 of
        hoger staan; berekend in `progress.js` uit de bestaande voortgang. Telling
        `kandoen/<hoofdstuk>/<nr>/behaald` bij de eerste ✓.
  - [x] Bij luisteroefeningen melden dat het een computerstem is.
      Gedaan in november 2026: 2–4 uitspraken per hoofdstuk (31 hoofdstukken), afgevinkt bij 80% in
      doos 3 of hoger (`canDoStatus` in `src/progress.js`), getoond op de hoofdstukpagina en bij een
      nieuw behaald doel op het eindscherm.
- [x] **Fase 1b – opbouw, volgorde en moeilijkheid** (vóór fase 2). Analyse van november 2026:
      geen grammatica uit latere hoofdstukken (goed), nieuwe woorden gelijkmatig (55–64), zinnen in
      leesteksten worden langer (goed). Maar: antwoordzinnen blijven 4–8 woorden van H1 tot H30,
      leesteksten groeien nauwelijks (A 61–94, B 117–170 woorden; B-plan noemt 300–600), het aantal
      vragen daalt juist (A 150 → 67, B 91 → 50), Zoek de fout staat in H14–H30 ná de herhaling,
      herkennen komt in 15 oefeningen na zelf maken, en de woordenschat staat steeds onderaan.
  - [x] Vaste volgorde. A-site: woorden (eerste ronde) → per onderwerp herkennen → vorm → kiezen →
        gemengd (vertalen, zoek de fout) → gebruiken (lezen, dialoog/taak, geleid schrijven) →
        luisteren → herhaling → overige woordenoefeningen. B-site: Läsa → Ord (met eerste
        woordenronde) → Grammatik (herkennen → maken → kiezen) → Zoek de fout → Lyssna → Praktiskt →
        Skriva → Herhaling → overige woordenoefeningen.
  - [x] Verplaatsen: Zoek de fout vóór Lyssna (H13–H30); herkennen vóór maken in modaal-vorm (H2),
        var-vart (H5), seizoenen (H6), biff-kiezen (H10), ligt-of-staat (H11), mer-mest (H12),
        passiv-of-niet en som-weglaten (H13), vara-of-bli (H14), villkor-sorteren en rad-kiezen
        (H18), nagon-goed-fout (H20), samband-sorteren (H22), hade-weg en bekend-nieuw (H29), per
        geval nagekeken; lezen/dialoog/zoek de fout op vaste plek in H1, H4, H6, H9; in H10
        „För att of eftersom?” direct na „Welk voegwoord?”.
  - [x] Eerste woordenoefening vooraan (`build.js`); „Begin/Verder” slaat een oefening in rondes over
        zodra één ronde gedaan is.
  - [x] Test: onderdelen in de vaste volgorde, geen topic uit een later hoofdstuk.
  - [x] Moeilijkheidslijn (zaagtand: binnen een hoofdstuk oplopend, oudere stof in de herhaling op
        het niveau van toen; getallen zijn een eigen richtlijn, A1/A2-grens bij H6/H7 een aanname):
        H1–H6 (A1) tekst 70–120 woorden, antwoordzin 4–6, ≥ 80 vragen; H7–H12 (A2) 120–200, 6–9,
        ≥ 80; H13–H24 (B1) 200–350, 8–12, ≥ 70; H25–H30 (B2) 350–500, 10–15, ≥ 70.
  - [x] `npm run difficulty-report` (zoals vocab-report) om de lijn te bewaken; aanvullen waar een
        hoofdstuk eronder zit (vooral H9–H12 en H16–H30); B-herhalingssets naar 10 vragen; taalreview
        controleert ook „alleen stof uit dit en eerdere hoofdstukken” en de lijn.
      Gedaan in november 2026: alle hoofdstukken in de vaste volgorde (test in `tests/content.test.js`);
      17 oefeningen verplaatst (herkennen vóór maken, onderwerpen bij elkaar); „Mag som weg?” (H13) en
      „Mag hade weg?” (H29) bleven staan: dat zijn keuzes die op de vorm volgen; „Wat betekent het?” vooraan, „Verder” slaat een woordenoefening
      over na één ronde; de test vond dat H1 al het meervoud vroeg (uitleg pas in H2): de meervoudsoefening
      verschijnt nu pas vanaf het hoofdstuk met die uitleg; B-herhalingssets van 6 naar 10 vragen
      (60 nieuwe vragen, na taalreview). Aanvullen tot de lijn (meer vragen, langere zinnen en teksten)
      loopt mee in fase 2 en 3; `npm run difficulty-report` laat zien waar.
- [ ] **Fase 2 – keuzeoefeningen**: per grammaticaonderwerp één oefening waarin de leerling eerst
      kiest welke vorm past en die dan maakt (8–10 vragen, `shuffle`, tips die de keuze uitleggen,
      één `steps`-vraag met „Waarom?”). Onderwerpen: inversie (H1), subjekt/objekt/possessief (H4),
      preteritum/perfekt en hemma/hem (H5), om/för … sedan/i (H6), tycka/tro/tänka (H8),
      sin/hans (H10), ligger/står/sitter (H11), adjectiefvormen (H12), där/dit/vars (H15),
      ska/kommer att/tänker (H17), någon/ingen (H20).
- [ ] **Fase 3 – schrijven, lezen en taken**
  - [ ] Geleid schrijven: elke schrijfopdracht voorafgaan door 3–5 stappen die de app nakijkt
        (openingszin kiezen, bijzin afmaken, tegenargument ordenen, signaalwoord kiezen). De vrije
        tekst blijft als laatste, optionele stap met voorbeeldantwoord, zonder vinkjes of oordeel;
        de `require`-controle heet voortaan „Hulp”. Stappen voor alle 30 schrijfopdrachten.
  - [ ] Langere leesteksten volgens de moeilijkheidslijn: A-site de bestaande tekst per hoofdstuk
        (nu 61–94 woorden, 6 vragen) met 8–10 vragen; B-site naar 200–350 (B1) en 350–500 (B2).
        Vaste personages, alleen stof uit dit en eerdere hoofdstukken. Eerst H1–H4 en H13–H16, dan meten.
  - [ ] Taken met een doel (situatie + dialoog met keuzes), te beginnen met H2, H6, H11, H17, H22.
  - [ ] H25–H30: een betoog in stappen bouwen (standpunt, argumenten, tegenargument, conclusie),
        elke stap nagekeken; de vrije versie is optioneel.
- [ ] **Meten na elke fase** (`npm run stats -- --min 5`): behaalde kan-doen-doelen (fase 1);
      `difficulty-report` en fout/bekeken per hoofdstuk (fase 1b);
      fout/bekeken bij keuzeoefeningen en aandeel vragen in doos 4+ (fase 2); afgemaakte geleide
      stappen, vrije teksten en leesteksten (fase 3).
      Na fase 2 ook een gebruikerstest: 3–5 leerlingen doen hardop denkend een hoofdstuk.

Open vraag: is er een vaste groep leerlingen voor de gebruikerstest?
