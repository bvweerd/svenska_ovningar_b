# Svenska övningar B1–B2

Interactieve oefensite voor Zweeds op B1- en B2-niveau, voor Nederlandstaligen.
Vervolg op [svenska_ovningar](https://github.com/bvweerd/svenska_ovningar) (A1–A2, hoofdstuk 0–12):
hoofdstuk 13–24 (B1) en 25–30 (B2), elk met een thema, een praktisch doel en een schrijfdoel.
Alle vragen worden automatisch nagekeken, met gerichte tips bij fouten.
Zweeds wordt voorgelezen met de spraakfunctie van de browser.

De spellingscontrole heeft hunspell met het Zweedse woordenboek nodig (`apt-get install hunspell hunspell-sv`);
zonder hunspell slaat die test zich lokaal over, in CI niet. Een nieuw woord dat het woordenboek niet kent (een naam,
spreektaal, een samenstelling) zet je na controle in `content/stavning.txt` (`npm run spelling -- --write`).

Alle oefenstof is zelf geschreven; de site is niet verbonden aan een uitgever of lesmethode.

## Lokaal draaien

```bash
npm install
npm run dev      # ontwikkelserver
npm test         # nakijklogica, alle oefenstof, spelling en de interface (happy-dom)
npm run coverage # hetzelfde met codedekking van src/ (CI; minimum in vite.config.js)
npm run spelling # Zweedse woorden die hunspell (sv_SE) niet kent; goed woord → content/stavning.txt
npm run smoke    # na build: elke pagina in Chromium, en per vraagvorm een vraag fout en goed beantwoorden
npm run build    # statische site in dist/
npm run difficulty-report   # moeilijkheid per hoofdstuk naast de moeilijkheidslijn (PLAN.md in svenska_ovningar)
npm run content-report      # rapport taalinhoud en didactiek (ook in CI, als samenvatting van de testrun)
                            # dezelfde metingen staan leesbaar op de pagina #/verantwoording (scripts/verantwoording.mjs)
```

## Publiceren

Elke push naar `main` wordt via GitHub Actions getest, gebouwd en op GitHub Pages gezet
(`.github/workflows/pages.yml`). Zet in de repository-instellingen onder
**Settings → Pages → Build and deployment** de bron op **GitHub Actions**.

## Oefenvormen

Naast de oefeningen per hoofdstuk zijn er onder **Oefenen**: dagelijkse herhaling met
intervallen (Leitner-dozen), een werkwoordtrainer (`content/verbs.yaml`), toetsen per
hoofdstuk, flitskaarten en snelle rondes van 60 seconden. Alle voortgang staat in de browser.

**Dagelijkse herhaling**: een dagdoel van 20 vragen (`DAILY_GOAL`), om en om uit verschillende onderwerpen
(`pickReview`); wie meer wil, gaat door met „extra herhaling”. Een vraag die de eerste keer in één keer goed
is, start in doos 2 (over twee dagen terug). **Jouw statistieken** (`#/statistieken`) laten de dozen, de
voortgang per hoofdstuk en de lastigste onderwerpen zien.

**Prestaties** (`#/prestaties`, `src/core/rewards/badges.js`): badges die de app zelf uitreikt op basis van
wat hij nakijkt: afgeronde oefeningen en hoofdstukken, kan-doen-doelen, vragen in doos 4+, toetsen ≥ 80%,
oefendagen (in totaal, niet op rij), dictee en snelle rondes. Flitskaarten tellen niet mee (zelfbeoordeling).
Een behaalde badge blijft staan en synchroniseert mee. De badge-id's zijn vast: niet veranderen.
Elke groep heeft een Zweeds plaatje (`src/ui/components/badge-icon.js`, inline SVG): dalahäst, midsommarstång,
rood huisje, eland, studentmössa, Tre Kronor, fika, nyckelharpa en Vasaloppet-ski's. De rand toont het niveau
(brons, zilver, goud; blauw-geel bij een losse badge en een vlagrand bij het vierde niveau).

**Hint**: bij vragen waar je iets typt geeft de knop Hint het begin van het antwoord (of een eigen `help`
in de vraag). Met hint telt een vraag als goed na hulp, niet als in één keer goed.

**Hand-outs** (`#/k/<hoofdstuk>/g/<kaart>/print`, of `#/k/<hoofdstuk>/print` voor alle kaarten): elke
grammaticakaart als A4 om op te hangen, met de kernregel groot in een kader en de uitleg in twee kolommen.
Lange uitleg krijgt automatisch een kleinere letter tot hij op één vel past (`src/ui/views/print.js`).

## Als app (PWA)

De site is te installeren als app op telefoon, tablet en computer (iPhone/iPad: Safari → Delen →
„Zet op beginscherm”; Android: Chrome → ⋮ → „App installeren”) en werkt daarna ook offline.
Bij `npm run build` maakt `scripts/pwa.mjs` het manifest (naam uit `APP` in `src/config.js`, iconen uit
`public/icons/`) en de service worker `sw.js`, die alle bestanden in de cache zet. Na een nieuwe
build ziet de gebruiker onderin „Er is een nieuwe versie” met een knop om bij te werken.
De voortgang blijft gewoon in localStorage; in de app vraagt de site om blijvende opslag.
Op iPhone/iPad heeft de app een eigen opslag, los van Safari: overzetten gaat via exporteren en importeren.

## Voortgang op meer apparaten

Op de pagina Voortgang (`#/voortgang`) kan de gebruiker de voortgang exporteren, importeren en synchroniseren;
de statistieken en prestaties staan daar ook. Instellingen (stem, thema, invoer, å/ä/ö, vanzelf doorgaan,
anoniem meetellen) staan op `#/instellingen`. **Importeren voegt samen**
(`mergeStates` in `src/core/progress/merge.js`): per vraag telt de laatste poging (met de Leitner-doos die daarbij
hoort), per oefening, toets en spel de nieuwste ronde met de hoogste beste score, bij flitskaarten en dictee
het nieuwste oordeel (tijdstippen in `t`), oefendagen van allebei; instellingen van het apparaat blijven staan.

**Synchroniseren** (`src/platform/sync.js`, opt-in) gebruikt dezelfde samenvoeging. Een synccode van 16 tekens
(geen account) koppelt apparaten, ook via een koppellink `#/koppel/<code>`. De code staat onder een
sleutel die beide sites delen, dus één keer koppelen geldt voor A1–A2 en B1–B2; de voortgang blijft per site
apart. De site synchroniseert zuinig: bij openen, bij weggaan (alleen als er iets veranderd is), bij weer online
komen en bij terugkomen hooguit eens per 10 minuten; niet bij elke paginawissel. Het dagdoel van de herhaling
wordt afgeleid uit de antwoorden (geen aparte teller). De opslag is de Worker met een D1-database; zie `worker/README.md`,
„Synchronisatie”. Zonder `SYNC_URL` (repository-variabele) is synchroniseren verborgen.

## Statistieken (GoatCounter)

De site kan anoniem meten via [GoatCounter](https://www.goatcounter.com): zonder cookies en
zonder persoonsgegevens. Zet de code in `src/config.js` (`GOATCOUNTER_CODE`); leeg = niets meten.
Bezoekers kunnen het uitzetten op de pagina "Instellingen".

Wat er geteld wordt:

| Pad | Betekenis |
|---|---|
| `/k/1/o/presens-invullen` enz. | paginabezoek |
| `vraag/<hoofdstuk>/<oefening>/<vraag-id>/goed\|fout\|bekeken` | per vraag (vaste id uit de YAML; bij woordenschat het Zweedse woord met - in plaats van spaties): in één keer goed, goed na fouten, of antwoord bekeken |
| `oefening/<hoofdstuk>/<oefening>/klaar/<score>` | oefening afgerond, score in groepen (0-39, 40-59, 60-79, 80-100) |
| `werkwoord/<tijd>/<werkwoord>/goed\|fout\|bekeken` | werkwoordtrainer |
| `toets/<hoofdstuk>/klaar/<score>` en `spel/<naam>/klaar` | toetsen en snelle rondes |
| `kandoen/<hoofdstuk>/<nummer>/behaald` | een kan-doen-uitspraak is voor het eerst afgevinkt |

Alle paden krijgen het voorvoegsel `/b`, zodat ze los staan van de A1–A2-site. Extra voor luisteren:

| Pad | Betekenis |
|---|---|
| `/b/luisteren/status/ok\|no-voice\|unsupported/<browser>` | of voorlezen werkt (één keer per bezoek) |
| `/b/luisteren/oordeel/goed\|matig\|slecht/<status>/<stem>` | oordeel op de pagina „Luisteren instellen” |
| `/b/luisteren/dictee/<zin\|woord>/<goed>-van-<totaal>` | dicteeronde afgerond |

Moeilijke vragen vind je in het dashboard door te zoeken op `/fout` of `/bekeken` en dat te
vergelijken met hetzelfde pad op `/goed`.

Sneller gaat het met `npm run stats`. Dat zet per oefening en per vraag goed, fout en bekeken
naast elkaar, met de tekst van de vraag erbij, en sorteert op hoe vaak het misgaat. Je hebt een
API-token met leesrechten nodig (GoatCounter → Settings → API):

```bash
GOATCOUNTER_TOKEN=… npm run stats -- --min 5 --top 30
```

Achter een proxy heeft Node ook `NODE_USE_ENV_PROXY=1` nodig.

## Oefeningen toevoegen

De oefenstof staat in `content/chapters/NN-onderwerp.yaml`, één bestand per hoofdstuk.
Een hoofdstuk verschijnt automatisch zodra het bestand bestaat (het nummer moet in
`content/index.yaml` staan, met `level`). Zie [PLAN.md](https://github.com/bvweerd/svenska_ovningar/blob/main/PLAN.md) (in de A1–A2-repo) voor het plan en `content/chapters/13-werk.yaml`
voor een volledig hoofdstuk.

### Woordvolgorde: tijdsbepaling vooraan of achteraan

De nakijker keurt een tijdsbepaling vooraan (met inversie) én achteraan goed, ook als het
antwoord in de content maar één volgorde heeft: *På kvällen tittar Bram på tv* = *Bram tittar på tv
på kvällen*. Een vastgelegde fout in `feedback` gaat voor. Vraagt de opdracht om een vaste volgorde
(„Begin de zin met de tijdsbepaling” of „Begin met het onderwerp”), zet dan `fixedOrder: true` bij de
oefening (of bij één vraag). De andere volgorde telt dan niet als fout, maar de leerling krijgt een tip om
de opdracht te volgen: begint het goede antwoord met de tijdsbepaling, dan „begin de zin met de
tijdsbepaling”; begint het met iets anders, dan „begin de zin zoals gevraagd”.

Bewust voorzichtig: de nakijker verplaatst alleen een tijdsbepaling tussen plaats 1 (met inversie) en het
eind van één enkelvoudige hoofdzin met een herkenbaar onderwerp (*Bram*, *min syster*, *Olles fru*,
*Fleur och Bram*, *Erik och jag*). Niet bij een vraag, een komma, een
voegwoord of bijzinwoord (*att, som, när, där, dit, vars, eftersom, medan …*; *kommer att* mag wel) of een
werkwoord als *tror/vet/hoppas* (bijzin zonder *att*). Wil je een andere volgorde in zo'n zin goedkeuren,
zet die dan zelf bij de antwoorden.

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
| `free` | vrije tekst (laatste stap van een schrijfopdracht): niet nagekeken, met „Hulp” en voorbeeldantwoord |
| `findError` | zoek de fout: `sentence`, `wrong` (woordnummers, vanaf 0) en `answers` |
| `transform` | Zweedse zin herschrijven: `prompt` (bronzin), optioneel `task`, `answers` |
| `listen` | luisteren: `say` (voor te lezen tekst); dictee, of met `options` + `answer` een keuzevraag |
| `sort` | indelen: `categories` en `items: [{ text, cat, tip? }]` |
| `steps` | samengestelde vraag: meerdere van bovenstaande na elkaar |

**Schrijfopdrachten (geleid schrijven).** Een schrijfoefening heeft eerst 3 tot 5 gewone vragen die de app
nakijkt en naar de tekst toe werken (openingszin kiezen, bijzin afmaken, signaalwoord kiezen), en als
laatste item de vrije tekst (`free`). Die stap is vrijblijvend: geen vinkjes en geen oordeel. Onder
„Hulp” staan `minWords` („Ongeveer … woorden”) en de `label`s van `require`; na „Klaar” of „Toon voorbeeld”
verschijnt `model`. `npm test` controleert dat `free` als laatste staat, na 3 tot 5 stappen, zonder `shuffle`.
In H25–H30 staat vóór de schrijfopdracht ook „Betoog in stappen” (`skriva-betoog`): vier `steps`-vragen voor
standpunt, argumenten, tegenargument met weerlegging en conclusie, en daarna een vrijblijvend betoog (in H27 is de
schrijfopdracht zelf het betoog).

```yaml
items:
  - { id: 7zwc, type: mc, prompt: "Kies de beste openingszin.", options: ["Hej! Jag heter Sanne.", "Hej! Heter jag Sanne."], answer: 0 }
  - { id: vau2, type: order, start: "Nu", tokens: ["bor", "jag", "i", "Zwolle"], answers: ["Nu bor jag i Zwolle."] }
  - { id: 3bp9, type: translate, prompt: "Ik spreek Nederlands.", answers: ["Jag {talar|pratar} nederländska."] }
  - id: sbrx
    type: free
    prompt: "Vertel hoe je heet, waar je vandaan komt …"
    minWords: 25
    require: [{ word: "heter", label: "Je vertelt hoe je heet (heter)" }]
    model: "Hej! Jag heter Sanne …"
```

Antwoordpatronen: `[optioneel]` en `{keuze|andere keuze}`, bijvoorbeeld
`"[Nej, ]vi {talar|pratar} inte finska."`. Bekende fouten met eigen tip:
`feedback: [{ match: "läsar", tip: "…" }]` of `{ contains: "…", tip: "…" }`.

Een oefening met `listen: true` en `text` is een luistertekst: de tekst wordt voorgelezen en is
eerst verborgen.

Met `vocab:` in een hoofdstuk worden drie woordenschatoefeningen automatisch gemaakt.
`npm test` controleert dat elk goed antwoord ook echt goed gerekend wordt en elke
vastgelegde fout als fout.

### Volgorde in een hoofdstuk

De knop „Begin/Verder” loopt de oefeningen af in de volgorde van het bestand, dus die volgorde ligt vast
(zie [PLAN.md](https://github.com/bvweerd/svenska_ovningar/blob/main/PLAN.md); `npm test` controleert hem). A-site: woorden → per onderwerp herkennen, vorm, kiezen →
gemengd (vertalen, „Wat zeg je?”, zoek de fout) → lezen (ook makkelijk lezen) → dialoog en taak → schrijven → luisteren →
herhaling → overige woordenschat.
B-site: Läsa (ook makkelijk lezen) → Ord → Grammatik → Zoek de fout → Lyssna → Praktiskt (ook „Wat zeg je?”) → Skriva →
Herhaling → overige woordenschat.
De eerste woordenoefening („Wat betekent het?”) zet de app zelf vooraan; „Verder” slaat een woordenoefening
over na één ronde van 10. Gebruik geen grammatica uit een later hoofdstuk: ook dat test `npm test`.

**Doeltaken (`kind: taak`).** Een taak is een oefening met `steps` waarin de leerling een gesprek voert om
een doel te bereiken. Zet `kind: taak` bij de oefening: op de A-site staat hij dan bij de dialoog (na lezen,
vóór schrijven); zonder `kind` telt een oefening met alleen `steps` als gewone oefening en hoort hij vóór
„Zoek de fout”. Op de B-site staan taken in het onderdeel `praktiskt`, dat hun plek al bepaalt; `kind` mag
daar, maar is niet nodig. Geef een taak geen `text`: dan blijven de stappen in de dagelijkse herhaling.
`npm test` controleert de waarde (alleen `taak`), het ontbreken van `text` en de plek.

**Makkelijk lezen (`kind: makkelijk`).** Een korte tekst met bijna alleen bekende woorden, om vlot te lezen
(input met aandacht voor betekenis), met 2–3 nagekeken vragen (rätt/fel of keuze). Vanaf H1 minstens twee per
hoofdstuk, direct na de leestekst; lengte per niveau in `LINE` (`scripts/difficulty-report.mjs`). Ze tellen
niet mee voor de leestekstlijn. `npm test` controleert aantal, lengte, `text` zonder `listen` en alleen
nagekeken vragen.

**„Wat zeg je?” (`kind: situatie`).** Een situatie in het Nederlands; de leerling zegt het zelf in het Zweeds
(`translate`, meestal meer goede antwoorden en foutregels). Geen `text`. Vanaf H1 minstens 4 vragen per
hoofdstuk; op de A-site vóór „Zoek de fout”, op de B-site in `praktiskt`.

**Vlot herhalen en instaptoets.** „Vlot herhalen” (bij de snelle rondes) vraagt alleen wat al in doos 2 of
hoger staat, met eenvoudige keuzevragen: tempo zonder nieuwe stof. De instaptoets (`#/k/<hoofdstuk>/instap`,
15 vragen over het hoofdstuk) zet goed beantwoorde vragen in doos 3 en markeert oefeningen als „✓ instap”
als alle vragen over hun onderwerp goed waren (`src/core/progress/placement.js`).

### Kan-doen-uitspraken

Elk hoofdstuk heeft bovenaan 2 tot 4 uitspraken (`canDo`), elk met de onderwerpen (`topics`) waar
hij op rust: `{ text: "Ik kan …", topics: [presens, v2] }`. De leerling beoordeelt niets zelf: de app
vinkt een uitspraak af als 80% van de vragen over die onderwerpen in doos 3 of hoger van de dagelijkse
herhaling staat (de eerste keer in één keer goed en daarna nog eens in de herhaling). `npm test` controleert dat de topics
bestaan en dat er minstens 5 vragen over zijn.

## Twee sites, één code

De code in `src/` is in lagen opgebouwd (zie `ARCHITECTURE.md` in svenska_ovningar): `core/` (puur: inhoud, nakijken, register van vraagtypen, voortgangsregels), `platform/` (opslag, synchroniseren, spraak, PWA, GoatCounter), `app/` (de store met de voortgang), `ui/` (router, pagina's, componenten, renderers per vraagtype) en `main.js` (alles aan elkaar). `tests/architecture.test.js` bewaakt dat elke laag alleen lagere lagen gebruikt.

Deze site en zijn zusterrepo (svenska_ovningar voor A1–A2, svenska_ovningar_b voor B1–B2) delen dezelfde code. `src/`, `tests/`, `scripts/`, `vite.config.js` en `package.json` zijn in beide repo's gelijk. Wat per site verschilt, staat in `src/config.js`: opslagsleutel, app-naam, GoatCounter-voorvoegsel, issue-repo, teksten en de link naar de andere site. Daarnaast verschillen de inhoud (`content/`), `index.html`, de app-iconen (`public/icons/`) en de Worker (alleen in de B1–B2-repo).

Pas je gedeelde code aan, kopieer die dan naar de andere repo en controleer met `npm run check-sync` (beide repo's naast elkaar uitgecheckt).

## Licentie

- **Code**: alle rechten voorbehouden ([LICENSE](LICENSE)). Je mag de code lezen, maar niet gebruiken,
  kopiëren, aanpassen of verspreiden (ook niet niet-commercieel) zonder schriftelijke toestemming; vraag
  die via een issue. De site zelf gebruiken is gratis. Eerder onder MIT gepubliceerde versies blijven
  voor die kopieën onder MIT.
- **Oefenstof** (`content/`): [CC BY-NC-SA 4.0](content/LICENSE.md): vrij te gebruiken en te bewerken
  met naamsvermelding, niet commercieel, en bewerkingen onder dezelfde licentie.
