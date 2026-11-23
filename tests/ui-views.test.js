// @vitest-environment happy-dom
// Elke pagina van de site, getekend door de echte app (main.js met router, menu en componenten), zoals
// de rooktest in de browser doet: geen fout, een gevulde pagina, en een paar interacties per pagina.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import './helpers/external-scripts.js';
import path from 'node:path';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[^>]*><\/script>/g, '');

let course;
const chapterNumbers = () => fs.readdirSync(path.join(process.cwd(), 'content', 'chapters'))
  .map((f) => Number(f.match(/^(\d+)-/)?.[1])).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
const errors = [];
const app = () => document.getElementById('app');

/** Ga naar een pagina en wacht tot de router getekend heeft. */
async function go(path) {
  location.hash = `#${path}`;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise((r) => setTimeout(r, 0));
  return app();
}

beforeAll(async () => {
  document.body.innerHTML = body;
  // Geen GoatCounter in de test (de app laadt dan geen extern script).
  localStorage.setItem('svensk-ovningar:analytics-opt-out', '1');
  window.addEventListener('error', (e) => errors.push(String(e.message ?? e.error)));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  ({ course } = await import('../src/app/content.js'));
  await import('../src/main.js');
});

afterEach(() => {
  expect(errors).toEqual([]);
});

const STATIC = ['/', '/over', '/voortgang', '/instellingen', '/koppel', '/koppel/abcd', '/luisteren', '/grammatica', '/herhalen',
  '/prestaties', '/statistieken', '/oefenen', '/oefenen/herhaling', '/oefenen/werkwoorden', '/oefenen/luisteren', '/oefenen/spel', '/bestaat-niet'];

describe('elke pagina wordt getekend', () => {
  for (const path of STATIC) {
    it(path, async () => {
      const el = await go(path);
      expect(el.childElementCount).toBeGreaterThan(0);
      expect(el.textContent.trim().length).toBeGreaterThan(10);
    });
  }

  it('alle spellen', async () => {
    const el = await go('/oefenen/spel');
    const games = [...el.querySelectorAll('a[href*="/spel/"]')].map((a) => a.getAttribute('href').slice(1));
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) expect((await go(g)).childElementCount).toBeGreaterThan(0);
  });

  // course staat pas na beforeAll vast; de hoofdstuknummers lezen we hier al uit de inhoud.
  for (const no of chapterNumbers()) {
    it(`hoofdstuk ${no} met al zijn onderdelen, oefeningen en uitleg`, async () => {
      const ch = course.find((c) => c.chapter === no);
      if (!ch?.available) return;
      const el = await go(`/k/${ch.chapter}`);
      expect(el.textContent).toContain(ch.title);
      for (const sub of ['mix', 'fouten', 'toets', 'instap', 'kaarten', 'print']) await go(`/k/${ch.chapter}/${sub}`);
      for (const ex of ch.exercises) {
        const page = await go(`/k/${ch.chapter}/o/${ex.id}`);
        expect(page.querySelector('article.item'), `${ch.chapter}/${ex.id}`).not.toBeNull();
      }
      for (const g of ch.grammar) {
        await go(`/k/${ch.chapter}/g/${g.id}`);
        await go(`/k/${ch.chapter}/g/${g.id}/print`);
      }
    }, 60000);
  }
});

describe('interacties op pagina’s', () => {
  it('menu: hoofdstukken openen en sluiten', async () => {
    await go('/');
    const btn = document.querySelector('#menu .has-sub');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('thema wisselen', async () => {
    const before = document.documentElement.dataset.theme;
    document.getElementById('theme').click();
    expect(document.documentElement.dataset.theme).not.toBe(before);
  });

  it('een oefening maken tot het eind van de ronde', async () => {
    const ch = course.find((c) => c.available && c.chapter >= 1);
    const ex = ch.exercises.find((e) => e.items.length >= 3 && e.items.every((it) => it.type === 'mc'));
    const el = await go(`/k/${ch.chapter}/o/${ex.id}`);
    for (let i = 0; i < 30; i++) {
      const card = [...el.querySelectorAll('article.item')].find((c) => !c.classList.contains('is-done') && !c.classList.contains('is-revealed') && !c.dataset.tried);
      if (card) card.dataset.tried = '1';
      if (!card) break;
      // Opties proberen tot de vraag goed is, zoals een leerling.
      for (const radio of card.querySelectorAll('input[type="radio"]')) {
        if (card.classList.contains('is-done')) break;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    expect(el.querySelectorAll('article.item.is-done').length).toBeGreaterThan(0);
    // De voortgang is opgeslagen.
    expect(Object.keys(localStorage).some((k) => k.endsWith(':progress:v2'))).toBe(true);
  });

  it('instellingen: knoppen en keuzes werken zonder fout', async () => {
    const el = await go('/instellingen');
    for (const input of el.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
      input.click();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    for (const sel of el.querySelectorAll('select')) {
      sel.selectedIndex = sel.options.length - 1;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  it('voortgang: exporteren geeft een bestand', async () => {
    const el = await go('/voortgang');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const exp = [...el.querySelectorAll('button')].find((b) => /export/i.test(b.textContent));
    exp?.click();
    if (exp) expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
