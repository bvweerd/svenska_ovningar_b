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

**`PLAN.md` in de repo `svenska_ovningar`** (vanuit de B-repo: `../svenska_ovningar/PLAN.md`) is het enige
planbestand en de bron van waarheid, ook voor werk aan de B-site. De B-repo heeft geen eigen plan.

- Alle fasen van het verbeterplan didactiek (1, 1b, 2, 3), de woordenuitbreiding en de twijfelronde zijn klaar.
- **Volgende stap: meten** na publicatie (`npm run stats -- --min 5`): fout/bekeken per oefening, doos 4+,
  kan-doen-doelen, geleide stappen. Er is geen testgroep. Houd nieuwe stof op de moeilijkheidslijn:
  `difficulty-report` markeert met `!` waar een hoofdstuk eronder zit.
- Nieuwe oefeningen komen op de plek die de vaste volgorde voorschrijft (README, „Volgorde in een
  hoofdstuk”); `npm test` faalt anders.
- Houd `PLAN.md` kort: een afgerond stuk werk wordt één regel onder „Gedaan”; details horen in README of code.

## Spelregels (afgesproken met de eigenaar)

- **Geen AI en geen externe diensten.** Alles werkt offline in de browser. Uitzonderingen: de anonieme
  tellingen via GoatCounter, „Fout gezien?” en het synchroniseren van voortgang (opt-in, met een synccode),
  beide via de eigen Cloudflare Worker (`worker/` in de B-repo). Samenvoegen gebeurt in de browser.
- **De app kijkt na, niet de leerling.** Geen zelfbeoordeling, geen rubrics om zelf af te vinken.
  Wat de app niet kan nakijken, is oefenen zonder oordeel.
- **Geen spreken, opnemen of spraakherkenning**, en geen echte opnames (er is geen moedertaalspreker).
- **Taalreview** voor elke nieuwe of gewijzigde Zweedse zin, vóór publicatie: door een aparte sessie of
  subagent die het werk van de schrijver niet kent (spelling, en/ett, vormen, woordvolgorde, eenduidige
  vertaling, niveau, idiomatisch, alle goede antwoorden en foutregels). Ook: alleen grammatica en woorden
  uit dit en eerdere hoofdstukken, en passend in de moeilijkheidslijn (`PLAN.md`). Twijfel → eigenaar.
- Alle oefenstof is zelf geschreven; niets overnemen uit een lesmethode (zie `PLAN.md`, auteursrecht).

## Code en inhoud

- **Architectuur**: lagen `core`, `platform`, `app`, `ui`, `main.js` (alleen naar lagere lagen importeren), vraagtypen en
  als register; de stappen ernaartoe staan in `../svenska_ovningar/ARCHITECTURE.md` (alleen in `svenska_ovningar`). Nieuwe code volgt die
  doelstructuur, ook als de overgang nog niet klaar is.
- **Gedeelde code** is in beide repo's gelijk: `src/` (behalve `src/config.js`), `tests/`, `scripts/`,
  `vite.config.js`, `package.json`. Wijzig in één repo, kopieer naar de andere, draai `npm run check-sync`.
  `content/`, `README.md`, `CLAUDE.md`, `index.html`, `public/icons/` en `worker/` zijn per site;
  `PLAN.md` staat alleen in `svenska_ovningar`.
- **Voortgang hangt aan id's**: verander nooit een vraag-id, oefening-id of hoofdstuknummer. Nieuwe vragen
  zonder id → `npm run ids`. Oefeningen verplaatsen of herordenen is veilig.
- **Onderwerpen**: elke oefening (of vraag) heeft een `topic` = id van een grammaticakaart (of
  `woordenschat`). Kan-doen-uitspraken (`canDo` bovenaan elk hoofdstuk) tellen vragen per topic: een
  nieuwe oefening met het goede topic telt mee voor het vinkje. Validatie: 2–4 uitspraken, bekende
  topics, minstens 5 vragen per uitspraak. Logica: `canDoStatus`/`newCanDo` in `src/progress.js`
  (`CANDO_BOX = 3`, `CANDO_SHARE = 0.8`).
- **Woordenschatoefeningen** worden gemaakt uit `vocab:` in `src/build.js`: de eerste („Wat betekent
  het?”) vooraan (onderdeel `woorden`, of bovenaan `ord` op de B-site), de rest onderaan in `woordenschat`.
  De meervoudsoefening verschijnt pas vanaf het hoofdstuk met de grammaticakaart `plural`.
- `npm test` controleert o.a. dat elk goed antwoord goed gerekend wordt en elke `feedback.match` fout.

## Hoe de moeilijkheid wordt gemeten

`npm run difficulty-report` (`scripts/difficulty-report.mjs`) meet zo:

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
