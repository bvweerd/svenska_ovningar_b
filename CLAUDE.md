# Werkafspraken voor agents

Interactieve oefensite Zweeds voor Nederlandstaligen, in twee repo's die naast elkaar staan:

| Repo | Niveau | Hoofdstukken |
|---|---|---|
| `svenska_ovningar` | A1–A2 | 0–12 |
| `svenska_ovningar_b` | B1–B2 | 13–30 |

Statische site (PWA): vanilla JS + Vite, oefenstof in YAML (`content/chapters/NN-*.yaml`), voortgang in
localStorage. De README legt vraagtypen, id's, statistieken en publicatie uit. De eigenaar schrijft
Nederlands; de interface en de uitleg zijn Nederlands, commitberichten Engels.

## Waar het werk staat

**`PLAN.md`, onderdeel „Verbeterplan didactiek”** is de bron van waarheid. Dat onderdeel is in beide
repo's gelijk: pas het in één repo aan en kopieer het hele onderdeel naar de andere.

- Fase 1 is klaar (kan-doen-uitspraken, eindtoetsen herschreven, melding computerstem).
- **Volgende stap: fase 1b** (opbouw, volgorde en moeilijkheid), daarna fase 2 (keuzeoefeningen) en
  fase 3 (geleid schrijven, langere leesteksten, taken en betogen).
- Vink af in `PLAN.md` en zet onder een afgeronde fase een regel „Gedaan (maand jaar): …”.
- Er is ook een gedeeld document (claude.ai) met dezelfde inhoud; `PLAN.md` gaat voor.

## Spelregels (afgesproken met de eigenaar)

- **Geen AI en geen externe diensten.** Alles werkt offline in de browser. Alleen de bestaande anonieme
  tellingen via GoatCounter blijven.
- **De app kijkt na, niet de leerling.** Geen zelfbeoordeling, geen rubrics om zelf af te vinken.
  Wat de app niet kan nakijken, is oefenen zonder oordeel.
- **Geen spreken, opnemen of spraakherkenning**, en geen echte opnames (er is geen moedertaalspreker).
- **Taalreview** voor elke nieuwe of gewijzigde Zweedse zin, vóór publicatie: door een aparte sessie of
  subagent die het werk van de schrijver niet kent (spelling, en/ett, vormen, woordvolgorde, eenduidige
  vertaling, niveau, idiomatisch, alle goede antwoorden en foutregels). Ook: alleen grammatica en woorden
  uit dit en eerdere hoofdstukken, en passend in de moeilijkheidslijn van fase 1b. Twijfel → eigenaar.
- Alle oefenstof is zelf geschreven; niets overnemen uit een lesmethode (zie PLAN.md, auteursrecht).

## Code en inhoud

- **Gedeelde code** is in beide repo's gelijk: `src/` (behalve `src/config.js`), `tests/`, `scripts/`,
  `vite.config.js`, `package.json`. Wijzig in één repo, kopieer naar de andere, draai `npm run check-sync`.
  `content/`, `README.md`, `PLAN.md`, `CLAUDE.md`, `index.html`, `public/icons/` en `worker/` zijn per site.
- **Voortgang hangt aan id's**: verander nooit een vraag-id, oefening-id of hoofdstuknummer. Nieuwe vragen
  zonder id → `npm run ids`. Oefeningen verplaatsen of herordenen is veilig.
- **Onderwerpen**: elke oefening (of vraag) heeft een `topic` = id van een grammaticakaart (of
  `woordenschat`). Kan-doen-uitspraken (`canDo` bovenaan elk hoofdstuk) tellen vragen per topic: een
  nieuwe oefening met het goede topic telt mee voor het vinkje. Validatie: 2–4 uitspraken, bekende
  topics, minstens 5 vragen per uitspraak. Logica: `canDoStatus`/`newCanDo` in `src/progress.js`
  (`CANDO_BOX = 3`, `CANDO_SHARE = 0.8`).
- **Woordenschatoefeningen** worden gemaakt uit `vocab:` in `src/build.js` en nu achteraan gezet in een
  onderdeel `woordenschat` (fase 1b verandert dat).
- `npm test` controleert o.a. dat elk goed antwoord goed gerekend wordt en elke `feedback.match` fout.

## Hoe de analyse van fase 1b is gemeten

Zodat `npm run difficulty-report` (fase 1b) dezelfde getallen geeft:

- Vragen per hoofdstuk: alle items, stappen van `steps` apart geteld, zonder de onderdelen `herhaling` en
  `eindtoets` en zonder de gegenereerde woordenschat.
- Antwoordzin: aantal woorden in het eerste goede antwoord van `translate`, `transform`, `order` en
  `findError` (patronen `[..]` weg, `{a|b}` → a), en in de zin van `gap` (`___` telt als één woord).
- Leestekst: `text` van oefeningen zonder `listen: true`; woorden per tekst en gemiddelde woorden per zin.
- Aandeel zelf maken: `translate`, `transform`, `order`, `findError`, `gap` en `free` t.o.v. alle vragen.
- Vooruitverwijzing: een vraag met een topic waarvan de grammaticakaart in een later hoofdstuk staat.

## Controleren en opleveren

1. In **beide** repo's: `npm test`, `npm run build`, `npm run check-sync`.
2. Wijzigingen in de interface ook bekijken in een browser op telefoonformaat (Playwright met
   `devices['Pixel 7']` of `devices['iPhone 13']`), licht en donker.
3. Werk op een eigen branch en commit in beide repo's met hetzelfde bericht. **Controleer vóór elke commit
   met `git branch --show-current` in welke branch je zit, in beide repo's**: eerder ging een commit op de
   verkeerde branch bijna verloren.
4. `main` publiceert via GitHub Actions naar GitHub Pages. Push naar `main` alleen als de eigenaar daarom
   vraagt.
