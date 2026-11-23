// Koppelen en dialoog ordenen door te tikken (handig op een telefoon, werkt ook met toetsenbord).
import { h } from '../dom.js';
import { shuffle } from '../../core/content/build.js';
import { gradeMatch, gradeDialogue } from '../../core/check/grade.js';
import { prompt, displayOrder } from './fields.js';

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

// ---------- Koppelen: kies een rij, tik daarna de betekenis aan ----------
export function match(item, ctx) {
  const n = item.pairs.length;
  const order = shuffle(item.pairs.map((_, i) => i));
  // Ook de linkerkant in willekeurige volgorde (tenzij shuffle: false): anders verraadt een vaste
  // reeks (maandag … zondag) het antwoord.
  const rowOrder = displayOrder(item, item.pairs.length);
  const chosen = item.pairs.map(() => null); // chosen[rij] = index van de gekozen rechterkant
  let active = rowOrder[0];
  let locked = false;
  let marks = null; // na nakijken: true/false per rij
  const rows = h('div', { class: 'tap-match', role: 'list' });
  const bank = h('div', { class: 'chips bank', 'aria-label': 'Betekenissen' });

  /** De eerstvolgende lege rij (in de getoonde volgorde), vanaf de rij ná `after`. */
  const nextEmpty = (after = null) => {
    const start = after === null ? 0 : rowOrder.indexOf(after) + 1;
    for (let k = 0; k < n; k++) {
      const i = rowOrder[(start + k) % n];
      if (chosen[i] === null) return i;
    }
    return -1;
  };
  const draw = () => {
    fill(rows, rowOrder.map((i) => {
      const [left] = item.pairs[i];
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
          const done = nextEmpty(active);
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
export function dialogue(item) {
  // Eén lijst in willekeurige volgorde (nooit al goed). Tik een regel aan en dan een andere: ze wisselen
  // van plaats. Na Controleer staan goede regels vast (groen); de rest wissel je verder.
  let order = item.lines.map((_, i) => i);
  while (order.length > 1 && order.every((v, i) => v === i)) order = shuffle(order);
  let selected = null;
  let locked = false;
  let marks = order.map(() => null); // per plek: true = goed (vast), false = fout, null = nog niet nagekeken
  const list = h('ol', { class: 'dialogue tap swap', lang: 'sv', 'aria-label': 'Dialoog: tik twee regels aan om ze te wisselen' });
  const tap = (pos) => {
    if (selected === null) selected = pos;
    else if (selected === pos) selected = null;
    else {
      [order[selected], order[pos]] = [order[pos], order[selected]];
      marks[selected] = marks[pos] = null;
      selected = null;
    }
    draw();
    list.querySelectorAll('button')[pos]?.focus({ preventScroll: true });
  };
  const draw = () => fill(list, order.map((lineNo, pos) =>
    h('li', { class: [marks[pos] === true ? 'ok' : marks[pos] === false ? 'bad' : '', selected === pos ? 'selected' : ''].join(' ').trim() },
      h('button', {
        type: 'button',
        class: 'line-btn',
        disabled: locked || marks[pos] === true,
        'aria-pressed': String(selected === pos),
        onclick: () => tap(pos),
      }, item.lines[lineNo]))));
  draw();
  const el = h('div', {},
    prompt(item.prompt ?? 'Zet de dialoog in de goede volgorde.'),
    h('p', { class: 'hint' }, 'Tik een regel aan en daarna de plek waar hij hoort: de twee wisselen van plaats.'),
    list);
  return {
    el,
    check() {
      const res = gradeDialogue(order, item);
      marks = order.map((v, i) => v === i);
      selected = null;
      draw();
      return res;
    },
    reveal() {
      order = item.lines.map((_, i) => i);
      marks = order.map(() => true);
      draw();
    },
    lock() {
      locked = true;
      draw();
    },
  };
}
