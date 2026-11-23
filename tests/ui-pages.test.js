// @vitest-environment happy-dom
// Pagina's met veel knoppen (kaartjes, toets, instap, dictee, voortgang, statistieken): de echte app, en
// dan elke knop op de pagina een paar keer aanklikken. Bevestigingsvragen krijgen „nee”, dus er wordt
// niets gewist. Verder: de Å Ä Ö-balk, de terugknop in de geïnstalleerde app en de installatieknop.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import './helpers/external-scripts.js';
import { pageBody } from './helpers/page-body.js';

const body = pageBody();

let course;
const errors = [];
const app = () => document.getElementById('app');
const tick = () => new Promise((r) => setTimeout(r, 0));

async function go(hash) {
  location.hash = `#${hash}`;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await tick();
  return app();
}

/** Klik `rounds` keer op alle zichtbare, bruikbare knoppen (geen links: die verlaten de pagina). */
async function clickAll(root, rounds = 3) {
  for (let r = 0; r < rounds; r++) {
    for (const b of [...root.querySelectorAll('button:not([disabled])')]) {
      if (!b.isConnected || b.hidden || b.closest('[hidden]')) continue;
      b.click();
      await tick();
    }
  }
}

beforeAll(async () => {
  document.body.innerHTML = body;
  localStorage.setItem('svensk-ovningar:analytics-opt-out', '1');
  window.addEventListener('error', (e) => errors.push(String(e.message ?? e.error)));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  window.confirm = () => false;
  window.alert = () => {};
  ({ course } = await import('../src/app/content.js'));
  await import('../src/main.js');
});

afterEach(() => expect(errors).toEqual([]));

const first = () => course.find((c) => c.available && c.chapter >= 1);

describe('pagina’s met knoppen', () => {
  it('kaartjes: omdraaien, gekend, nog niet, volgende', async () => {
    const el = await go(`/k/${first().chapter}/kaarten`);
    await clickAll(el, 6);
    expect(el.childElementCount).toBeGreaterThan(0);
  });

  it('toets en instap: alles beantwoorden tot de uitslag', async () => {
    for (const sub of ['toets', 'instap']) {
      const el = await go(`/k/${first().chapter}/${sub}`);
      for (let i = 0; i < 40; i++) {
        const card = [...el.querySelectorAll('article.item')].find((c) => !c.classList.contains('is-done') && !c.classList.contains('is-revealed'));
        if (!card) break;
        const radio = card.querySelector('input[type="radio"]:not(:disabled)');
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          card.querySelectorAll('input[type="text"], textarea').forEach((f) => { f.value = 'x'; f.dispatchEvent(new Event('input', { bubbles: true })); });
          card.querySelector('.chips.bank .chip')?.click();
          [...card.querySelectorAll('button')].find((b) => b.textContent === 'Controleer' && !b.hidden)?.click();
        }
        await tick();
        if (!card.classList.contains('is-done') && !card.classList.contains('is-revealed')) break;
      }
      await clickAll(el, 1);
    }
  });

  it('dagelijkse herhaling, mix, fouten, werkwoorden en dictee', async () => {
    for (const p of ['/oefenen/herhaling', `/k/${first().chapter}/mix`, `/k/${first().chapter}/fouten`, '/herhalen', '/oefenen/werkwoorden', '/oefenen/luisteren']) {
      const el = await go(p);
      el.querySelectorAll('input[type="text"]').forEach((f) => { f.value = 'jag'; f.dispatchEvent(new Event('input', { bubbles: true })); });
      await clickAll(el, 2);
    }
  });

  it('voortgang, statistieken, prestaties, luisteren en instellingen', async () => {
    for (const p of ['/voortgang', '/statistieken', '/prestaties', '/luisteren', '/instellingen', '/over', '/oefenen']) {
      const el = await go(p);
      await clickAll(el, 1);
    }
  });

  it('grammaticakaart en afdrukpagina', async () => {
    const ch = first();
    const el = await go(`/k/${ch.chapter}/g/${ch.grammar[0].id}`);
    await clickAll(el, 1);
    window.print = () => {};
    await clickAll(await go(`/k/${ch.chapter}/print`), 1);
  });
});

describe('Å Ä Ö-balk', () => {
  it('zet een letter op de plek van de cursor', async () => {
    const ex = first().exercises.find((e) => e.items.length <= 8 && e.items.every((it) => it.type === 'gap' && it.gaps.every((g) => !g.options)));
    const el = await go(`/k/${first().chapter}/o/${ex.id}`);
    const input = el.querySelector('input[type="text"]');
    input.value = 'hej';
    input.focus();
    input.setSelectionRange(1, 1);
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    const btn = [...document.querySelectorAll('.charbar button')].find((b) => b.textContent === 'å');
    btn.click();
    expect(input.value).toBe('håej');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }));
    btn.click(); // na pointerdown niet nog een keer
    expect(input.value).toBe('hååej');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await tick();
  });
});

describe('geïnstalleerde app: terugknop', () => {
  it('links gaan via de stapel, terug naar de bovenliggende pagina', async () => {
    const { initAppNav, navigate, parentOf } = await import('../src/ui/nav.js');
    await go('/');
    initAppNav();
    navigate(`#/k/${first().chapter}`);
    await tick();
    expect(location.hash).toBe(`#/k/${first().chapter}`);
    const link = app().querySelector('a[href*="/o/"]');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await tick();
    expect(location.hash).toContain('/o/');
    expect(parentOf(location.hash)).toBe(`/k/${first().chapter}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await tick();
    navigate('#/');
    await tick();
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
});

describe('installeren als app', () => {
  it('het installatieverzoek van de browser wordt bewaard en gebruikt', async () => {
    const pwa = await import('../src/platform/pwa.js');
    let asked = false;
    const ev = new Event('beforeinstallprompt');
    ev.prompt = async () => { asked = true; };
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    const seen = [];
    pwa.watchInstall((can) => seen.push(can));
    window.dispatchEvent(ev);
    expect(pwa.canPromptInstall()).toBe(true);
    await pwa.promptInstall();
    expect(asked).toBe(true);
    expect(pwa.isStandalone()).toBe(false);
    expect(typeof pwa.isIos()).toBe('boolean');
    pwa.syncThemeColor();
    window.dispatchEvent(new Event('appinstalled'));
  });
});
