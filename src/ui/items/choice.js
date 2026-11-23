// Kiezen: meerkeuze, meer antwoorden, sorteren, rätt/fel (met verbetering).
import { h, nextId } from '../dom.js';
import { inline } from '../md.js';
import { gradeMc, gradeMulti, gradeTrueFalse, gradeSort } from '../../core/check/grade.js';
import { prompt, lockInputs, sentenceField, displayOrder } from './fields.js';

// ---------- Meerkeuze ----------
export function mc(item, ctx) {
  const name = nextId('mc');
  const order = displayOrder(item, item.options.length);
  const radios = [];
  const list = h('div', { class: 'options', role: 'radiogroup' },
    order.map((orig) => {
      const r = h('input', { type: 'radio', name, value: String(orig), onchange: () => ctx.auto?.() });
      radios.push(r);
      return h('label', { class: 'option' }, r, h('span', { html: inline(String(item.options[orig])) }));
    }),
  );
  const el = h('div', {}, prompt(item.prompt), list);
  const selected = () => {
    const r = radios.find((x) => x.checked);
    return r ? Number(r.value) : null;
  };
  return {
    el,
    check() {
      const res = gradeMc(selected(), item);
      radios.forEach((r) => r.parentElement.classList.remove('ok', 'bad'));
      const r = radios.find((x) => x.checked);
      if (r && !res.empty) r.parentElement.classList.add(res.correct ? 'ok' : 'bad');
      return res;
    },
    reveal() {
      radios.forEach((r) => r.parentElement.classList.toggle('ok', Number(r.value) === item.answer));
    },
    lock: () => lockInputs(el),
  };
}

export function multi(item) {
  const order = displayOrder(item, item.options.length);
  const boxes = [];
  const list = h('div', { class: 'options' },
    order.map((orig) => {
      const c = h('input', { type: 'checkbox', value: String(orig) });
      boxes.push(c);
      return h('label', { class: 'option' }, c, h('span', { html: inline(String(item.options[orig])) }));
    }),
  );
  const el = h('div', {}, prompt(item.prompt ?? 'Kies alle goede antwoorden.'), list);
  return {
    el,
    check() {
      return gradeMulti(boxes.filter((b) => b.checked).map((b) => Number(b.value)), item);
    },
    reveal() {
      boxes.forEach((b) => {
        const good = item.answers.includes(Number(b.value));
        b.checked = good;
        b.parentElement.classList.toggle('ok', good);
      });
    },
    lock: () => lockInputs(el),
  };
}

// ---------- Sorteren: elk woord of elke zin in een categorie ----------
export function sort(item, ctx) {
  const order = displayOrder(item, item.items.length);
  const choice = item.items.map(() => null);
  const rows = [];
  const groups = order.map((idx) => {
    const name = nextId('sort');
    const radios = item.categories.map((cat, c) => {
      const r = h('input', {
        type: 'radio', name, value: String(c),
        onchange: () => {
          choice[idx] = c;
          rows[idx].classList.remove('ok', 'bad');
          if (choice.every((x) => x !== null)) ctx.auto?.();
        },
      });
      return h('label', { class: 'pill' }, r, h('span', {}, cat));
    });
    const row = h('div', { class: 'sort-row' },
      h('span', { class: 'sort-text', lang: 'sv', html: inline(item.items[idx].text) }),
      h('span', { class: 'pills', role: 'radiogroup', 'aria-label': item.items[idx].text.replace(/\*/g, '') }, radios));
    rows[idx] = row;
    return row;
  });
  const el = h('div', {}, prompt(item.prompt ?? 'Deel in.'), h('div', { class: 'sort' }, groups));
  return {
    el,
    check() {
      const res = gradeSort(choice, item);
      rows.forEach((row, i) => {
        row.classList.toggle('ok', res.fields?.[i] === true);
        row.classList.toggle('bad', res.fields?.[i] === false);
      });
      return res;
    },
    reveal() {
      rows.forEach((row, i) => {
        const r = row.querySelector(`input[value="${item.items[i].cat}"]`);
        if (r) r.checked = true;
        row.classList.add('ok');
        row.classList.remove('bad');
      });
    },
    lock: () => lockInputs(el),
  };
}

// ---------- Juist/fout, eventueel met verbetering ----------
export function truefalse(item, ctx) {
  const name = nextId('tf');
  let phase = 'choose';
  const mk = (label, value) => {
    const r = h('input', { type: 'radio', name, value: String(value), onchange: () => phase === 'choose' && ctx.auto?.() });
    return { r, label: h('label', { class: 'option inline' }, r, h('span', {}, label)) };
  };
  const yes = mk('Rätt', true);
  const no = mk('Fel', false);
  const correctionBox = h('div', { class: 'correction', hidden: true });
  let fix = null;
  const showFix = (label) => {
    fix = sentenceField(item.correction, ctx, { label: 'Verbeterde zin', source: item.statement });
    const text = fix.field.kind === 'tiles' && label.endsWith('op:') ? label.replace('Schrijf de juiste zin op:', 'Maak de juiste zin:') : label;
    correctionBox.replaceChildren(h('p', { class: 'prompt' }, text), fix.field.el);
    correctionBox.hidden = false;
  };
  const el = h('div', {},
    h('p', { class: 'prompt', lang: 'sv' }, item.statement),
    h('div', { class: 'options row' }, yes.label, no.label),
    correctionBox,
  );
  const value = () => (yes.r.checked ? true : no.r.checked ? false : null);
  return {
    el,
    check() {
      if (phase === 'choose') {
        const res = gradeTrueFalse(value(), item);
        [yes, no].forEach((o) => o.label.classList.remove('ok', 'bad'));
        if (!res.empty) (value() ? yes : no).label.classList.add(res.correct ? 'ok' : 'bad');
        if (res.correct && item.correction) {
          phase = 'correct';
          yes.r.disabled = no.r.disabled = true;
          showFix(item.correction.prompt ?? 'Goed, het klopt niet. Schrijf de juiste zin op:');
          fix.field.focus();
          return { correct: true, advance: true };
        }
        return res;
      }
      return fix.check();
    },
    reveal() {
      (item.answer ? yes : no).label.classList.add('ok');
      (item.answer ? yes : no).r.checked = true;
      if (item.correction) {
        if (!fix) showFix('Juiste zin:');
        fix.reveal();
      }
    },
    lock: () => { fix?.field.lock(); lockInputs(el); },
  };
}
