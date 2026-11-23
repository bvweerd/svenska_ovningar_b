// Rooktest in een echte browser: opent elke pagina van de gebouwde site (npm run build) op
// telefoonformaat (Pixel 7), licht en donker, en faalt bij JavaScript-fouten of als een pagina
// breder is dan het scherm (horizontaal scrollen).
//
// Gebruik: npm run build && npm run smoke            (alle oefeningen van alle hoofdstukken)
//          npm run smoke -- --quick                   (alleen het eerste hoofdstuk)
// Playwright staat niet in package.json; zonder Playwright slaat dit script zich over.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';

import { root } from './sibling.mjs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('Playwright niet gevonden: rooktest overgeslagen.');
  process.exit(0);
}
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('Eerst npm run build.');
  process.exit(1);
}

const quick = process.argv.includes('--quick');
const server = await preview({ root, preview: { port: 0, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await playwright.chromium.launch();
const problems = [];
let visited = 0;

async function session(scheme, visit) {
  const ctx = await browser.newContext({ ...playwright.devices['Pixel 7'], colorScheme: scheme, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${scheme}] ${page.url()}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/goatcounter|Failed to load resource|net::/i.test(m.text())) problems.push(`[${scheme}] ${page.url()}: ${m.text()}`);
  });
  const go = async (hash) => {
    await page.goto(`${base}#${hash}`, { timeout: 10000 });
    // De router tekent synchroon bij hashchange: wachten tot #app gevuld is en één beeld verder.
    await page.waitForFunction(() => document.getElementById('app')?.childElementCount > 0, null, { timeout: 5000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    visited++;
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 1) problems.push(`[${scheme}] #${hash}: ${wide}px breder dan het scherm`);
  };
  await visit(page, go);
  await ctx.close();
}

const PAGES = ['/', '/over', '/luisteren', '/grammatica', '/herhalen', '/prestaties', '/statistieken', '/oefenen', '/oefenen/herhaling', '/oefenen/werkwoorden',
  '/oefenen/luisteren', '/oefenen/spel', '/koppel/abcd', '/bestaat-niet'];

for (const scheme of ['light', 'dark']) {
  await session(scheme, async (page, go) => {
    for (const p of PAGES) await go(p);
    for (const g of await page.goto(`${base}#/oefenen/spel`).then(() => page.$$eval('a[href*="/spel/"]', (as) => as.map((a) => a.getAttribute('href').slice(1))))) await go(g);
    await go('/');
    const chapters = await page.$$eval('a[href^="#/k/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href').slice(1)))]);
    for (const ch of quick ? chapters.slice(0, 1) : chapters) {
      await go(ch);
      const links = await page.$$eval('a[href*="/o/"], a[href*="/g/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href').slice(1)))]);
      for (const sub of ['/mix', '/fouten', '/toets', '/kaarten', '/print']) await go(ch + sub);
      // Alle oefeningen en uitleg in licht; in donker alleen het eerste hoofdstuk.
      if (scheme === 'light' || ch === chapters[0]) for (const l of links) await go(l);
    }
  });
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`${visited} pagina's bekeken, ${problems.length} problemen.`);
for (const p of problems.slice(0, 50)) console.log(`- ${p}`);
process.exit(problems.length ? 1 : 0);
