// @vitest-environment happy-dom
// Elke vraag van de cursus in de echte renderer: tekenen, het goede antwoord laten invullen (reveal) en
// nakijken moet „goed” geven. Daarna dezelfde vraag in de vraagkaart: een fout antwoord geeft een tip.
import { describe, it, expect, beforeEach } from 'vitest';
import { course } from '../src/app/content.js';
import { RENDERERS } from '../src/ui/items/index.js';
import { itemCard } from '../src/ui/items/item-card.js';
import { expand } from '../src/core/check/normalize.js';

const ctx = (ch) => ({ topic: null, findTopic: () => null, ref: { ch: ch.chapter, ex: 'x', idx: 0 }, onSkip: () => {} });

const first = (p) => expand(String(p))[0];
const clean = (w) => w.replace(/^[„”"'«(]+|[.,!?;:…”"'»)]+$/g, '').toLowerCase();

/** Zet tekst in een invoerveld zoals een gebruiker (met input-event). */
function type(input, text) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Kies een optie (happy-dom stuurt bij een klik geen change-event). */
function pick(radio) {
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Naar typen in plaats van tegels, als de vraag tegels toont. */
function preferTyping(el) {
  [...el.querySelectorAll('.input-switch')].find((b) => b.textContent === 'Liever typen')?.click();
}

/** Tik tegels aan in de volgorde van `sentence` (hoofdletters en leestekens tellen niet). */
function tapTiles(el, sentence) {
  for (const w of sentence.split(/\s+/).map(clean).filter(Boolean)) {
    const chip = [...el.querySelectorAll('.chips.bank .chip:not(.used):not([disabled])')].find((c) => clean(c.textContent) === w);
    chip?.click();
  }
}

/**
 * Beantwoord een vraag in `el` zoals een gebruiker: kiezen, typen, tegels tikken, een woord aanklikken.
 * Geeft false als dat voor dit type niet lukt; dan vult de test het antwoord in met reveal().
 */
function answer(item, el) {
  const t = item.type;
  if (t === 'mc' || (t === 'listen' && item.options)) {
    pick(el.querySelector(`input[type="radio"][value="${item.answer}"]`));
    return true;
  }
  if (t === 'truefalse') {
    const radio = el.querySelector(`input[type="radio"][value="${item.answer ? 'true' : 'false'}"]`) ?? el.querySelectorAll('input[type="radio"]')[item.answer ? 0 : 1];
    if (!radio) return false;
    pick(radio);
    return true;
  }
  if (t === 'sort') {
    // Per regel de goede categorie (de regels kunnen geschud zijn: zoek op de tekst).
    for (const row of el.querySelectorAll('.sort-row')) {
      const text = row.querySelector('.sort-text').textContent.trim();
      const it = item.items.find((x) => x.text.replace(/\*/g, '').trim() === text);
      pick(row.querySelector(`input[value="${it.cat}"]`));
    }
    return true;
  }
  if (t === 'free') {
    type(el.querySelector('textarea, input[type="text"]'), 'Jag heter Bram och jag bor i Västerås.');
    return true;
  }
  if (t === 'findError') {
    el.querySelectorAll('.chips.find-error .chip')[item.wrong[0]].click();
    return true;
  }
  if (t === 'order') {
    // Tegels kunnen woordgroepen zijn; het begin (start) ligt er al. Leg ze op volgorde van het antwoord.
    const norm = (s) => s.split(/\s+/).map(clean).filter(Boolean).join(' ');
    let rest = norm(first(item.answers[0]));
    if (item.start) rest = rest.slice(norm(item.start).length).trim();
    const chips = [...el.querySelectorAll('.chips.bank .chip')];
    while (rest) {
      const chip = chips.find((c) => !c.used && (rest === norm(c.textContent) || rest.startsWith(`${norm(c.textContent)} `)));
      if (!chip) break;
      chip.used = true;
      chip.click();
      rest = rest.slice(norm(chip.textContent).length).trim();
    }
    return true;
  }
  if (['translate', 'transform'].includes(t) || (t === 'listen' && !item.options)) {
    const input = el.querySelector('input[type="text"]:not(:disabled), textarea:not(:disabled)');
    if (input) type(input, first((item.answers ?? [item.say])[0]));
    else tapTiles(el, first((item.answers ?? [item.say])[0]).replace(/\[[^\]]*\]/g, ''));
    return true;
  }
  if (t === 'gap') {
    const inputs = el.querySelectorAll('input[type="text"], select');
    item.gaps.forEach((g, k) => inputs[k] && type(inputs[k], first(g.answers[0])));
    return true;
  }
  return false;
}

/** Beantwoord en kijk na tot de vraag klaar is: steps en zoek de fout geven eerst { advance }. */
function play(item, r) {
  const ok = item.type === 'steps' ? answer(item.steps[0], r.el.querySelector('.step')) : answer(item, r.el);
  if (!ok) r.reveal();
  let res = r.check();
  for (let i = 0; i < 20 && res.correct && res.advance; i++) {
    if (item.type === 'steps') {
      const steps = r.el.querySelectorAll('.step');
      const step = item.steps[steps.length - 1];
      if (!answer(step, steps[steps.length - 1])) r.reveal();
    } else r.reveal(); // zoek de fout: de verbeterde zin
    res = r.check();
  }
  return res;
}

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe('renderers: elke vraag, het onthulde antwoord is goed', () => {
  for (const ch of course.filter((c) => c.available)) {
    it(`hoofdstuk ${ch.chapter}`, () => {
      const bad = [];
      for (const ex of ch.exercises) {
        for (const [i, item] of ex.items.entries()) {
          const render = RENDERERS[item.type];
          if (!render) { bad.push(`${ex.id}[${i}]: geen renderer voor ${item.type}`); continue; }
          const r = render(item, { ...ctx(ch), auto: () => {}, ready: () => {} });
          document.body.append(r.el);
          const res = play(item, r);
          if (!(res.correct || res.neutral)) bad.push(`${ex.id}[${i}] ${item.id ?? ''} ${item.type}: ${JSON.stringify(res).slice(0, 120)}`);
          r.lock();
          r.el.remove();
        }
      }
      expect(bad).toEqual([]);
    });
  }
});

describe('vraagkaart: nakijken, tips, hint en het antwoord tonen', () => {
  const card = (item, extra = {}) => {
    const done = [];
    const ctxCard = { topic: null, findTopic: () => ({ card: { summary: 'De **regel**.' }, href: '#/k/1/g/x' }), ref: { ch: 1, ex: 'x', idx: 0 }, onSkip: () => {}, ...extra };
    const el = itemCard(item, ctxCard, 1, (r) => done.push(r), 'Opdracht');
    document.body.append(el);
    const btn = (text) => [...el.querySelectorAll('button')].find((b) => b.textContent === text && !b.hidden);
    return { el, done, btn, feedback: () => el.querySelector('.feedback') };
  };
  // Vragen met één fase (rätt/fel met verbeterzin heeft er twee; die zit in de renderertest).
  const simple = ['mc', 'translate', 'transform', 'gap', 'free', 'order'];

  for (const ch of course.filter((c) => c.available)) {
    it(`hoofdstuk ${ch.chapter}: goed in één keer, en fout → tip → antwoord tonen`, () => {
      const bad = [];
      for (const ex of ch.exercises) {
        for (const item of ex.items.filter((it) => simple.includes(it.type))) {
          // Goed in één keer.
          let c = card(item);
          answer(item, c.el);
          c.btn('Controleer')?.click();
          c.btn('Klaar')?.click();
          if (!c.done.length) bad.push(`${ex.id} ${item.id} ${item.type}: goed antwoord niet afgerond (${c.feedback().textContent.slice(0, 60)})`);
          else if (item.type !== 'free' && !c.done[0].firstTry) bad.push(`${ex.id} ${item.id}: goed antwoord niet in één keer goed`);
          c.el.remove();

          // Drie keer fout, dan „Toon antwoord”.
          if (!['translate', 'transform', 'gap'].includes(item.type)) continue;
          c = card(item);
          preferTyping(c.el);
          // Alleen vragen waar je typt (een gat met keuzelijst heeft geen tekstveld).
          if (!c.el.querySelector('input[type="text"], textarea')) { c.el.remove(); continue; }
          for (let i = 0; i < 3; i++) {
            c.el.querySelectorAll('input[type="text"]:not(:disabled), textarea:not(:disabled)').forEach((inp) => type(inp, 'xyz qqq'));
            c.btn('Controleer')?.click();
          }
          if (!c.feedback().classList.contains('bad') || !c.feedback().textContent.trim()) bad.push(`${ex.id} ${item.id}: geen foutmelding met tekst`);
          const reveal = c.btn('Toon antwoord');
          if (!reveal) bad.push(`${ex.id} ${item.id}: na drie pogingen geen „Toon antwoord”`);
          reveal?.click();
          if (!c.done[0]?.revealed) bad.push(`${ex.id} ${item.id}: antwoord tonen rondt niet af`);
          c.el.remove();
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('hint: telt niet als in één keer goed', () => {
    const item = course[1].exercises.flatMap((e) => e.items).find((it) => it.type === 'translate');
    const c = card(item);
    c.btn('Hint').click();
    expect(c.el.querySelector('.hint-help').hidden).toBe(false);
    answer(item, c.el);
    c.btn('Controleer').click();
    expect(c.done[0]).toMatchObject({ firstTry: false, revealed: false });
  });

  it('toets: één poging, geen hint, het goede antwoord meteen', () => {
    const item = course[1].exercises.flatMap((e) => e.items).find((it) => it.type === 'translate');
    const c = card(item, { testMode: true });
    expect(c.btn('Hint')).toBeUndefined();
    preferTyping(c.el);
    c.el.querySelectorAll('input[type="text"], textarea').forEach((inp) => type(inp, 'fel'));
    c.btn('Controleer').click();
    expect(c.feedback().textContent).toContain('Niet goed');
    expect(c.done[0]).toMatchObject({ revealed: true });
  });

  it('Enter in een tekstveld kijkt na; cijfertoets kiest een optie', () => {
    const tr = course[1].exercises.flatMap((e) => e.items).find((it) => it.type === 'translate');
    let c = card(tr);
    answer(tr, c.el);
    c.el.querySelector('input[type="text"], textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(c.done.length).toBe(1);
    const mc = course[1].exercises.flatMap((e) => e.items).find((it) => it.type === 'mc');
    c = card(mc);
    const radios = [...c.el.querySelectorAll('input[type="radio"]')];
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: String(radios.findIndex((r) => r.value === String(mc.answer)) + 1), bubbles: true }));
    expect(c.done.length).toBe(1);
  });
});
