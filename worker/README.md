# Foutmeldingen via een Cloudflare Worker

Bij elke vraag op beide oefensites staat een knop **Fout gezien?**. Een gebruiker schrijft kort wat er niet klopt, en deze Worker maakt er een issue van: meldingen van de B1–B2-site in `bvweerd/svenska_ovningar_b`, van de A1–A2-site in `bvweerd/svenska_ovningar`. Elke site stuurt zijn repo mee (`REPORT_REPO` in `src/config.js`); de Worker accepteert alleen repo's uit `GITHUB_REPO`. Gebruikers hebben geen GitHub-account nodig.

```
site (GitHub Pages) ──POST──▶ Worker ──▶ Turnstile: is dit een mens?
                                     └─▶ GitHub API: issue aanmaken
```

- De vraag (als JSON), het antwoord van de gebruiker, het hoofdstuk en de oefening worden automatisch meegestuurd.
- Het GitHub-token staat alleen in de Worker, als secret. Het kan alleen issues aanmaken in de repo's die het token toestaat.
- Turnstile (gratis, van Cloudflare) houdt bots tegen. De Worker accepteert alleen verzoeken van de origins in `ALLOWED_ORIGINS`.
- `@naam` in een melding wordt onschadelijk gemaakt, zodat niemand ongewild gepingd wordt.

Zolang `REPORT_URL` en `TURNSTILE_SITEKEY` niet zijn ingesteld, blijft de knop verborgen. Er gebeurt dan niets.

## Eenmalig instellen

### 1. Label in GitHub
Maak in beide repo's een label `melding` aan (Issues → Labels → New label). Het token mag zelf geen labels aanmaken.

### 2. GitHub-token
GitHub → Settings → Developer settings → Fine-grained personal access tokens → *Generate new token*:
- **Repository access:** *Only select repositories* → `svenska_ovningar_b` en `svenska_ovningar`
- **Permissions:** *Issues: Read and write* (de rest blijft *No access*)
- Kies een vervaldatum en zet een herinnering om hem te vernieuwen.

### 3. Turnstile-widget
Cloudflare-dashboard → Turnstile → *Add widget*:
- **Hostnames:** `bvweerd.github.io` en `localhost`
- **Widget mode:** *Managed*

Je krijgt een **sitekey** (openbaar) en een **secret key** (geheim).

### 4. Worker deployen
```bash
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```
Wrangler vraagt bij `secret put` om de waarde. Na `deploy` toont het het adres, bijvoorbeeld `https://svensk-ovningar-b.<account>.workers.dev`. `wrangler deploy` zet ook de variabelen uit `wrangler.toml` (de secrets blijven staan).

### 5. Site koppelen
In **beide** repo's: GitHub → repo → Settings → Secrets and variables → Actions → tabblad **Variables** → *New repository variable*:
- `REPORT_URL` = het Worker-adres uit stap 4
- `TURNSTILE_SITEKEY` = de sitekey uit stap 3

Start daarna de workflow *Deploy naar GitHub Pages* opnieuw, of push iets. De knop verschijnt dan op de site.

## Lokaal testen
```bash
set VITE_REPORT_URL=http://localhost:8787/&& set VITE_TURNSTILE_SITEKEY=1x00000000000000000000AA&& npx vite
```
`1x00000000000000000000AA` is de officiële testsleutel van Turnstile: die slaagt altijd. Draai de Worker lokaal met `npx wrangler dev` (in `worker/`), met in `worker/.dev.vars`:
```
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
GITHUB_TOKEN=<token, of een token voor een testrepo>
```

## Aanpassen
- Alleen tokens van je eigen site: zet `TURNSTILE_HOSTNAMES = "bvweerd.github.io"` bij `[vars]`. Laat het leeg als je lokaal met de testsleutels van Turnstile werkt (die geven een andere hostnaam).
- Extra site of repo: voeg de repo toe aan `GITHUB_REPO` (komma-gescheiden; de eerste is de standaard) en zo nodig de origin aan `ALLOWED_ORIGINS`. Geef het token toegang tot die repo en maak daar het label `melding` aan. Zet in de site `REPORT_REPO` op die repo.
- De opbouw van het issue staat in `buildIssue()` in `src/index.js`. De tests staan in `tests/report.test.js` in de hoofdmap.
