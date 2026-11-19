// Koppelen en dialoog ordenen door te tikken (handig op een telefoon, werkt ook met toetsenbord).
import { h } from '../dom.js';
import { inline } from '../md.js';
import { shuffle } from '../build.js';
import { gradeMatch, gradeDialogue } from '../check/grade.js';

const prompt = (text) => (text ? h('p', { class: 'prompt', html: inline(text) }) : null);
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

// ---------- Koppelen: kies een rij, tik daarna de betekenis aan ----------
export function match(item, ctx) {
  const n = item.pairs.length;
  const order = shuffle(item.pairs.map((_, i) => i));
  const chosen = item.pairs.map(() => null); // chosen[rij] = index van de gekozen rechterkant
  let active = 0;
  let locked = false;
  let marks = null; // na nakijken: true/false per rij
  const rows = h('div', { class: 'tap-match', role: 'list' });
  const bank = h('div', { class: 'chips bank', 'aria-label': 'Betekenissen' });

  const nextEmpty = (from = 0) => {
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (chosen[i] === null) return i;
    }
    return -1;
  };
  const draw = () => {
    fill(rows, item.pairs.map(([left], i) => {
      const value = chosen[i];
      const slot = h('button', {
        type: 'button',
        class: `match-slot${value === null ? ' empty' : ''}${i === active && !locked ? ' active' : ''}`,
        disabled: locked,
        'aria-label': value === null ? `Kies een betekenis voor ${left}` : `${left}: ${item.pairs[value][1]}. Tik om te wissen.`,
        onclick: () => {
          if (value !== null) chosen[i] = null;
          marks = null;
          active = i;
          draw();
          bank.querySelector('button:not(.used)')?.focus({ preventScroll: true });
        },
      }, value === null ? '…' : item.pairs[value][1]);
      return h('div', { class: `match-row${marks ? (marks[i] ? ' ok' : ' bad') : ''}`, role: 'listitem' },
        h('span', { class: 'match-left', lang: 'sv' }, left), slot);
    }));
    // Gekozen betekenissen blijven als lege plek staan, zodat de rest niet onder je vinger verschuift.
    fill(bank, order.map((r) => chosen.includes(r)
      ? h('button', { type: 'button', class: 'chip used', disabled: true, tabindex: '-1', 'aria-hidden': 'true' }, item.pairs[r][1])
      : h('button', {
        type: 'button',
        class: 'chip',
        disabled: locked,
        onclick: () => {
          if (active < 0 || chosen[active] !== null) active = nextEmpty();
          if (active < 0) return;
          chosen[active] = r;
          marks = null;
          const done = nextEmpty(active + 1);
          active = done;
          draw();
          if (done < 0) ctx.auto?.();
          else bank.querySelector('button:not(.used)')?.focus({ preventScroll: true });
        },
      }, item.pairs[r][1])));
  };
  draw();
  const el = h('div', {}, prompt(item.prompt ?? 'Kies een woord en tik dan de betekenis aan.'), rows, bank);
  return {
    el,
    check() {
      const res = gradeMatch(chosen, item);
      marks = res.fields ?? null;
      if (!res.correct && marks) {
        // Foute koppelingen terug in de bank, zodat je ze opnieuw kunt kiezen.
        chosen.forEach((v, i) => { if (!marks[i]) chosen[i] = null; });
        active = nextEmpty();
      }
      draw();
      return res;
    },
    reveal() {
      item.pairs.forEach((_, i) => (chosen[i] = i));
      marks = item.pairs.map(() => true);
      draw();
    },
    lock() {
      locked = true;
      draw();
    },
  };
}

// ---------- Dialoog: tik de regels aan in de goede volgorde ----------
export function dialogue(item, ctx = {}) {
  const order = (() => {
    let o = item.lines.map((_, i) => i);
    while (o.length > 1 && o.every((v, i) => v === i)) o = shuffle(o);
    return o;
  })();
  let placed = [];
  let locked = false;
  let marks = null;
  const list = h('ol', { class: 'dialogue tap', lang: 'sv', 'aria-label': 'Jouw volgorde' });
  const bank = h('div', { class: 'dialogue-bank', lang: 'sv', 'aria-label': 'Regels' });
  const draw = () => {
    fill(list, placed.length
      ? placed.map((lineNo, pos) => h('li', { class: marks ? (marks[pos] ? 'ok' : 'bad') : '' },
          h('button', { type: 'button', class: 'line-btn', disabled: locked, onclick: () => { placed = placed.filter((x) => x !== lineNo); marks = null; draw(); } }, item.lines[lineNo])))
      : h('li', { class: 'placeholder' }, 'Tik de regels hieronder aan in de goede volgorde.'));
    fill(bank, order.map((lineNo) => placed.includes(lineNo)
      ? h('button', { type: 'button', class: 'line-btn used', disabled: true, tabindex: '-1', 'aria-hidden': 'true' }, item.lines[lineNo])
      : h('button', {
        type: 'button',
        class: 'line-btn',
        disabled: locked,
        onclick: () => {
          placed.push(lineNo);
          marks = null;
          draw();
          if (placed.length === item.lines.length) ctx.auto?.();
          else bank.querySelector('button:not(.used)')?.focus({ preventScroll: true });
        },
      }, item.lines[lineNo])));
  };
  draw();
  const el = h('div', {}, prompt(item.prompt ?? 'Zet de dialoog in de goede volgorde.'), list, bank);
  return {
    el,
    check() {
      if (placed.length < item.lines.length) return { correct: false, empty: true, tip: 'Zet eerst alle regels op hun plek.' };
      const res = gradeDialogue(placed, item);
      marks = placed.map((v, i) => v === i);
      if (!res.correct) {
        // Alles vanaf de eerste fout terug naar de stapel.
        const first = marks.indexOf(false);
        placed = placed.slice(0, first);
        marks = marks.slice(0, first);
      }
      draw();
      return res;
    },
    reveal() {
      placed = item.lines.map((_, i) => i);
      marks = placed.map(() => true);
      draw();
    },
    lock() {
      locked = true;
      draw();
    },
  };
}
