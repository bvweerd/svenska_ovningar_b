# Svenska övningar B1–B2

Interactieve oefensite voor Zweeds op B1- en B2-niveau, voor Nederlandstaligen.
Vervolg op [svenska_ovningar](https://github.com/bvweerd/svenska_ovningar) (A1–A2, hoofdstuk 0–12):
hoofdstuk 13–24 (B1) en 25–30 (B2), elk met een thema, een praktisch doel en een schrijfdoel.
Alle vragen worden automatisch nagekeken, met gerichte tips bij fouten.
Zweeds wordt voorgelezen met de spraakfunctie van de browser.

Alle oefenstof is zelf geschreven; de site is niet verbonden aan een uitgever of lesmethode.

## Lokaal draaien

```bash
npm install
npm run dev      # ontwikkelserver
npm test         # nakijklogica + controle van alle oefenstof
npm run build    # statische site in dist/
```

## Publiceren

Elke push naar `main` wordt via GitHub Actions getest, gebouwd en op GitHub Pages gezet
(`.github/workflows/pages.yml`). Zet in de repository-instellingen onder
**Settings → Pages → Build and deployment** de bron op **GitHub Actions**.

## Oefenvormen

Naast de oefeningen per hoofdstuk zijn er onder **Oefenen**: dagelijkse herhaling met
intervallen (Leitner-dozen), een werkwoordtrainer (`content/verbs.yaml`), toetsen per
hoofdstuk, flitskaarten en snelle rondes van 60 seconden. Alle voortgang staat in de browser.

## Statistieken (GoatCounter)

De site kan anoniem meten via [GoatCounter](https://www.goatcounter.com): zonder cookies en
zonder persoonsgegevens. Zet de code in `src/config.js` (`GOATCOUNTER_CODE`); leeg = niets meten.
Bezoekers kunnen het uitzetten op de pagina "Over".

Wat er geteld wordt:

| Pad | Betekenis |
|---|---|
| `/k/1/o/presens-invullen` enz. | paginabezoek |
| `vraag/<hoofdstuk>/<oefening>/<nr>/goed\|fout\|bekeken` | per vraag: in één keer goed, goed na fouten, of antwoord bekeken |
| `oefening/<hoofdstuk>/<oefening>/klaar/<score>` | oefening afgerond, score in groepen (0-39, 40-59, 60-79, 80-100) |
| `werkwoord/<tijd>/<werkwoord>/goed\|fout\|bekeken` | werkwoordtrainer |
| `toets/<hoofdstuk>/klaar/<score>` en `spel/<naam>/klaar` | toetsen en snelle rondes |

Alle paden krijgen het voorvoegsel `/b`, zodat ze los staan van de A1–A2-site. Extra voor luisteren:

| Pad | Betekenis |
|---|---|
| `/b/luisteren/status/ok\|no-voice\|unsupported/<browser>` | of voorlezen werkt (één keer per bezoek) |
| `/b/luisteren/oordeel/goed\|matig\|slecht/<status>/<stem>` | oordeel op de pagina „Luisteren instellen” |
| `/b/luisteren/dictee/<zin\|woord>/<goed>-van-<totaal>` | dicteeronde afgerond |

Moeilijke vragen vind je in het dashboard door te zoeken op `/fout` of `/bekeken` en dat te
vergelijken met hetzelfde pad op `/goed`.

## Oefeningen toevoegen

De oefenstof staat in `content/chapters/NN-onderwerp.yaml`, één bestand per hoofdstuk.
Een hoofdstuk verschijnt automatisch zodra het bestand bestaat (het nummer moet in
`content/index.yaml` staan, met `level`). Zie `PLAN.md` voor de opzet en `content/chapters/13-werk.yaml`
voor een volledig hoofdstuk.

### Vraag-id's en voortgang

Elke vraag heeft een vaste `id` (bijvoorbeeld `id: k7q2`). De voortgang van gebruikers hangt aan
hoofdstuk + oefening-`id` + vraag-`id`, niet aan de plek van de vraag.

- Nieuwe vragen: schrijf ze zonder id en draai `npm run ids`. `npm test` faalt zolang er een vraag zonder id is.
- Vragen invoegen, verwijderen of van volgorde veranderen: de voortgang blijft staan.
- Een vraagtekst, tip of uitleg verbeteren: de voortgang blijft staan.
- De **goede antwoorden** veranderen: die vraag telt voor gebruikers weer als nieuw.
- **Verander nooit een id**, en hernoem geen oefening-`id` of hoofdstuknummer: dan is de voortgang daarvan weg.
- Woordenschatvragen worden gegenereerd; hun id is het Zweedse woord. Een woord toevoegen raakt de rest niet.

| Type | Wat |
|---|---|
| `mc` | meerkeuze (één goed) |
| `multi` | meerkeuze (meerdere goed) |
| `gap` | invullen, met `___`; per gat open veld of keuzelijst (`options`) |
| `translate` | vrije zin (vertalen, omzetten) |
| `order` | woorden in de goede volgorde klikken (optioneel vast begin `start`) |
| `match` | paren koppelen |
| `table` | tabel invullen |
| `truefalse` | rätt/fel, met optionele `correction` (open verbetering) |
| `clock` | klok aflezen (`time: "07:30"`), antwoorden worden gegenereerd |
| `dialogue` | dialoog ordenen (regels in de goede volgorde opgeven) |
| `free` | schrijfopdracht met lichte controles en voorbeeldantwoord |
| `findError` | zoek de fout: `sentence`, `wrong` (woordnummers, vanaf 0) en `answers` |
| `transform` | Zweedse zin herschrijven: `prompt` (bronzin), optioneel `task`, `answers` |
| `listen` | luisteren: `say` (voor te lezen tekst); dictee, of met `options` + `answer` een keuzevraag |
| `sort` | indelen: `categories` en `items: [{ text, cat, tip? }]` |
| `steps` | samengestelde vraag: meerdere van bovenstaande na elkaar |

Antwoordpatronen: `[optioneel]` en `{keuze|andere keuze}`, bijvoorbeeld
`"[Nej, ]vi {talar|pratar} inte finska."`. Bekende fouten met eigen tip:
`feedback: [{ match: "läsar", tip: "…" }]` of `{ contains: "…", tip: "…" }`.

Een oefening met `listen: true` en `text` is een luistertekst: de tekst wordt voorgelezen en is
eerst verborgen.

Met `vocab:` in een hoofdstuk worden drie woordenschatoefeningen automatisch gemaakt.
`npm test` controleert dat elk goed antwoord ook echt goed gerekend wordt en elke
vastgelegde fout als fout.

## Licentie

- **Code**: [MIT](LICENSE).
- **Oefenstof** (`content/`): [CC BY-NC-SA 4.0](content/LICENSE.md): vrij te gebruiken en te bewerken
  met naamsvermelding, niet commercieel, en bewerkingen onder dezelfde licentie.
