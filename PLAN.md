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
- [ ] Werkwoordtrainer uitbreiden met B1-werkwoorden en partikelwerkwoorden

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
- [ ] **Fase 2**: hoofdstuk 1–12 naar ±60 woorden per hoofdstuk, per hoofdstuk een **taalreview**.
      Stand: hoofdstuk 1 en 3–12 uitgebreid tot 55–64 woorden (715 in totaal) → **taalreview**
      (twee rondes) gedaan; wacht op de steekproef van de eigenaar.
- [ ] **Fase 3**: hoofdstuk 13–30 naar ±60 woorden (meer uitdrukkingen en partikelwerkwoorden),
      per hoofdstuk een **taalreview**.
- [ ] **Fase 4**: kernoefeningen naar 8–10 vragen, luistervragen in de A1–A2-site,
      ±80 werkwoorden erbij in de werkwoordtrainer; per hoofdstuk of per lijst een **taalreview**.
- [ ] **Fase 5**: aan de hand van GoatCounter kijken welke oefeningen gebruikt worden en vaak
      fout gaan, en daar verder uitbreiden (met **taalreview** voor nieuwe stof).
