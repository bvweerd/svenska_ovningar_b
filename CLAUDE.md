# Werkafspraken voor agents

Oefensite Zweeds voor Nederlandstaligen in twee repo's naast elkaar: `svenska_ovningar` (A1–A2, H0–H12) en
`svenska_ovningar_b` (B1–B2, H13–H30). Statische PWA: vanilla JS + Vite, oefenstof in YAML
(`content/chapters/NN-*.yaml`), voortgang in localStorage. Hoe het werkt (vraagtypen, id's, statistieken,
publicatie): README. De eigenaar schrijft Nederlands; interface en uitleg Nederlands, commitberichten Engels.

## Plan en lijn

- **`../svenska_ovningar/PLAN.md`** (alleen in `svenska_ovningar`) is het enige plan, ook voor de B-site: spelregels,
  onderwijskundige lijn, moeilijkheidslijn, vaste volgorde, wat gedaan is en wat open staat. Lees het vóór
  inhoudelijk werk; toets elk voorstel aan de lijn en noem in de oplevering hoe het past. Houd het kort: afgerond
  werk wordt één regel onder „Gedaan”.
- Wat de lijn eist, controleert `npm test` (o.a. makkelijke teksten en „Wat zeg je?” per hoofdstuk, de vaste
  volgorde, geen grammatica uit een later hoofdstuk). `npm run difficulty-report` en `npm run content-report`
  (doel: 0 aandachtspunten) laten zien waar stof onder de lijn zit; `npm run vocab-report` telt woorden.

## Spelregels (met de eigenaar)

- **Geen AI en geen externe diensten**; alles offline. Uitzonderingen: GoatCounter (anoniem), „Fout gezien?” en
  opt-in synchroniseren via de eigen Cloudflare Worker (`worker/` in de B-repo).
- **De app kijkt na, niet de leerling**: geen zelfbeoordeling. **Geen spreken of opnemen.**
- **Eigen werk**: niets overnemen of minen uit een lesmethode (ook geen antwoordmodellen).
- **Taalreview** van elke nieuwe of gewijzigde Zweedse zin vóór publicatie, door een aparte subagent die het werk
  niet kent: spelling, en/ett, vormen, woordvolgorde, idiomatisch, eenduidige vertaling, alle goede antwoorden,
  foutregels terecht, alleen stof uit dit en eerdere hoofdstukken. Verwerk en laat de wijzigingen nog eens
  nakijken. Let vooral op: precies één goede keuzeoptie; een invulzin die niet (bijna) gelijk is aan een
  voorbeeldzin; bij `order` alle goede volgordes in `answers`.
- **Twijfel → eigenaar.** Kan de eigenaar het niet beoordelen, dan liever weglaten.

## Code en inhoud

- **Architectuur** (`../svenska_ovningar/ARCHITECTURE.md`): lagen `core` < `platform` < `app` < `ui` < `main.js`,
  vraagtypen als register; `tests/architecture.test.js` bewaakt het.
- **Gedeelde code** is in beide repo's gelijk: `src/` (behalve `src/config.js`), `tests/`, `scripts/`,
  `vite.config.js`, `package.json`. Wijzig in één repo, kopieer, draai `npm run check-sync`. Per site:
  `content/`, `README.md`, `CLAUDE.md`, `index.html`, `public/icons/`, `worker/`.
- **Voortgang hangt aan id's**: nooit een vraag-id, oefening-id of hoofdstuknummer veranderen. Nieuwe vragen
  zonder id → `npm run ids`. Verplaatsen mag.
- **Topics**: elke oefening of vraag heeft een `topic` (id van een grammaticakaart of `woordenschat`);
  kan-doen-uitspraken (`canDo`) tellen vragen per topic (`src/core/progress/cando.js`).
- **Woordenlijst** (`vocab:`): `src/core/content/build.js` maakt er oefeningen van. Van elke `ex` wordt een
  getypte invulzin: alleen het vetgedrukte deel telt goed. Past er een ander goed woord in, gebruik `{a|b}` of
  een andere zin. Een woord niet in twee hoofdstukken (`vocab-report` meldt dubbelingen).
- `npm test` controleert o.a. dat elk goed antwoord goed gerekend wordt, elke `feedback.match` fout, en de
  spelling (hunspell; een goed onbekend woord → `content/stavning.txt`).

## Controleren en opleveren

1. In **beide** repo's: `npm test`, `npm run build`, `npm run check-sync`.
2. Interface gewijzigd: bekijken op telefoonformaat (Playwright, `devices['Pixel 7']`), licht en donker.
3. Werk op een eigen branch; commit in beide repo's met hetzelfde bericht. **Controleer vóór elke commit met
   `git branch --show-current` in welke branch je zit.**
4. `main` publiceert naar GitHub Pages: alleen pushen als de eigenaar dat vraagt (`dev` op verzoek).
