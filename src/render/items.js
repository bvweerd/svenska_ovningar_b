// Renderers per vraagtype. Elke renderer geeft terug:
//   { el, check() → resultaat, reveal(), lock() }
// Een resultaat met { correct: true, advance: true } betekent: volgende fase van dezelfde vraag.
import { h, nextId } from '../dom.js';
import { inline } from '../md.js';
import { displayAnswer } from '../check/normalize.js';
import { shuffle } from '../build.js';
import {
  gradeText, gradeMc, gradeMulti, gradeTrueFalse, gradeOrder,
  gradeFields, clockSpec, checkFree, gradeSort,
} from '../check/grade.js';
import { speakButton, speedSelect } from './speak.js';
import { sentenceInput, tileBoard } from './tiles.js';
import { match, dialogue } from './tap.js';
import { speak, speechStatus } from '../speech.js';

// replaceChildren met geneste arrays en lege waarden
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

const prompt = (text) => (text ? h('p', { class: 'prompt', html: inline(text) }) : null);

function markFields(inputs, fields) {
  inputs.forEach((inp, i) => {
    inp.classList.toggle('ok', fields?.[i] === true);
    inp.classList.toggle('bad', fields?.[i] === false);
  });
}

/** Aantal tekens van het langste goede antwoord (minstens 4), voor de breedte van een veld. */
const fieldChars = (spec) => Math.max(...[].concat(spec.answers ?? ['']).map((a) => displayAnswer([a]).length), 4) + 1;

function textInput(spec, { size, label, wide } = {}) {
  const longest = fieldChars(spec) - 1;
  return h('input', {
    type: 'text',
    class: `answer-input${wide ? ' wide' : ''}`,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    lang: 'sv',
    'aria-label': label ?? 'Antwoord',
    size: size ?? Math.min(longest + 2, 40),
  });
}

function lockInputs(root) {
  root.querySelectorAll('input, select, button.chip, button.move, textarea').forEach((e) => (e.disabled = true));
}

/** Zinsveld (typen of woordtegels) met nakijken; gedeeld door vertalen, omvormen, luisteren enz. */
function sentenceField(spec, ctx, { label, source, prefill, topic } = {}) {
  const field = sentenceInput(spec, { label, source, prefill, textInput, onComplete: () => ctx.ready?.() });
  return {
    field,
    check() {
      const res = gradeText(field.value(), spec, topic ? { ...ctx, topic } : ctx);
      field.mark(res.empty ? undefined : res.correct);
      return res;
    },
    reveal() {
      field.reveal(displayAnswer(spec.answers));
    },
  };
}

// ---------- Meerkeuze ----------
function mc(item, ctx) {
  const name = nextId('mc');
  const order = item.shuffle === false ? item.options.map((_, i) => i) : shuffle(item.options.map((_, i) => i));
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

function multi(item) {
  const order = item.shuffle === false ? item.options.map((_, i) => i) : shuffle(item.options.map((_, i) => i));
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

// ---------- Invullen ----------
function gap(item, ctx) {
  const parts = item.text.split('___');
  const fields = [];
  const sentence = h('p', { class: 'gap-text', lang: 'sv' });
  parts.forEach((part, i) => {
    // Een hint direct na het gat, zoals „(arbeta)”, blijft aan het veld vast (zie hieronder).
    if (i > 0) part = part.replace(/^\s*\([^()]{1,40}\)/, '');
    sentence.append(h('span', { html: inline(part) }));
    if (i < parts.length - 1) {
      const g = item.gaps[i];
      let f;
      if (g.options) {
        f = h('select', {
          class: 'answer-input',
          'aria-label': `Gat ${i + 1}`,
          onchange: () => {
            if (item.gaps.every((x) => x.options) && fields.every((x) => x.value)) ctx.auto?.();
          },
        },
          h('option', { value: '' }, '…'),
          (g.shuffle === false ? g.options : shuffle(g.options)).map((o) => h('option', { value: o }, o)),
        );
      } else {
        f = textInput(g, { label: `Gat ${i + 1}` });
        // Zo breed als het langste goede antwoord (net als het size-attribuut), in ch: dan blijft
        // de zin bij elkaar en breekt hij niet over regels zoals bij een breed veld.
        f.style.width = `calc(${Math.min(fieldChars(g), 30)}ch + 22px)`;
      }
      fields.push(f);
      const hint = parts[i + 1].match(/^\s*\(([^()]{1,40})\)/);
      sentence.append(hint
        ? h('span', { class: 'gap-field' }, f, h('span', { class: 'gap-hint', html: ` (${inline(hint[1])})` }))
        : f);
    }
  });
  const el = h('div', {}, prompt(item.prompt), sentence, item.hint ? h('p', { class: 'hint' }, item.hint) : null);
  return {
    el,
    check() {
      const res = gradeFields(fields.map((f) => f.value), item.gaps, ctx);
      markFields(fields, res.fields);
      return res;
    },
    reveal() {
      fields.forEach((f, i) => {
        f.value = displayAnswer(item.gaps[i].answers);
        f.classList.add('revealed');
      });
    },
    lock: () => lockInputs(el),
  };
}

function translate(item, ctx) {
  const f = sentenceField(item, ctx, { label: 'Jouw vertaling' });
  const el = h('div', {}, h('p', { class: 'prompt source' }, item.prompt), f.field.el);
  return { el, check: f.check, reveal: f.reveal, lock: () => { f.field.lock(); lockInputs(el); } };
}

// ---------- Omvormen: een Zweedse zin herschrijven (actief → passief, twee zinnen → één) ----------
function transform(item, ctx) {
  const f = sentenceField(item, ctx, { label: 'Jouw zin', source: item.prompt });
  const el = h('div', {},
    item.task ? h('p', { class: 'task', html: inline(item.task) }) : null,
    h('p', { class: 'prompt source', lang: 'sv', html: inline(item.prompt) }),
    f.field.el);
  return { el, check: f.check, reveal: f.reveal, lock: () => { f.field.lock(); lockInputs(el); } };
}

// ---------- Luisteren: dictee of „wat hoor je?” ----------
function listenPlayer(item) {
  const status = speechStatus();
  if (status === 'unsupported') {
    const shown = h('p', { class: 'listen-text', lang: 'sv', hidden: true }, item.say);
    return {
      el: h('div', { class: 'listen-player unsupported' },
        h('p', { class: 'muted' }, 'Deze browser kan niet voorlezen. ', h('a', { href: '#/luisteren' }, 'Bekijk hoe je dat aanzet'), ', of lees de tekst.'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { shown.hidden = false; e.currentTarget.remove(); } }, 'Toon de tekst'),
        shown),
      play: () => {},
    };
  }
  // Zonder Zweedse stem (klasse no-sv-voice op <html>) toont de CSS het blok listen-novoice in plaats
  // van de knoppen: een andere stem leert de verkeerde uitspraak aan. „Toch voorlezen” zet ze terug.
  const shown = h('p', { class: 'listen-text', lang: 'sv', hidden: true }, item.say);
  const el = h('div', { class: 'listen-player' },
    h('div', { class: 'listen-normal' },
      speakButton(item.say, { label: 'Luister', className: 'big' }),
      speakButton(item.say, { label: 'Langzaam', rate: 0.6 }),
      speedSelect(),
      status === 'no-voice' ? h('p', { class: 'muted small' }, 'Er is geen Zweedse stem gevonden, dus het kan vreemd klinken. ', h('a', { href: '#/luisteren' }, 'Luisteren instellen')) : null),
    h('div', { class: 'listen-novoice' },
      h('p', { class: 'muted' }, 'Op dit apparaat is geen Zweedse stem gevonden. ', h('a', { href: '#/luisteren' }, 'Installeer er een'), ', of lees de tekst.'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { shown.hidden = false; e.currentTarget.remove(); } }, 'Toon de tekst'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { el.classList.add('forced'); speak(item.say); } }, 'Toch voorlezen'),
      shown),
  );
  // Enter in een leeg veld speelt alleen af als de knoppen ook zichtbaar zijn.
  const audible = () => !document.documentElement.classList.contains('no-sv-voice') || el.classList.contains('forced');
  return { el, play: () => { if (audible()) speak(item.say); } };
}

function listen(item, ctx) {
  const player = listenPlayer(item);
  if (item.options) {
    const inner = mc({ ...item, type: 'mc', prompt: item.prompt ?? 'Wat hoor je?' }, ctx);
    return { ...inner, el: h('div', {}, player.el, inner.el) };
  }
  const spec = { ...item, answers: item.answers ?? [item.say] };
  const f = sentenceField(spec, ctx, { label: 'Wat hoor je?' });
  // Enter in een leeg typveld: nog een keer afspelen.
  f.field.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input') && !e.target.value.trim()) {
      e.preventDefault();
      e.stopPropagation();
      player.play();
    }
  });
  const el = h('div', {}, player.el, prompt(item.prompt ?? (f.field.kind === 'tiles' ? 'Zet de woorden in de volgorde die je hoort.' : 'Schrijf op wat je hoort.')), f.field.el,
    f.field.kind === 'tiles' ? null : h('p', { class: 'hint speech-extra' }, 'Tip: druk op Enter in het lege veld om het nog eens te horen.'));
  return { el, check: f.check, reveal: f.reveal, lock: () => { f.field.lock(); lockInputs(el); } };
}

// ---------- Sorteren: elk woord of elke zin in een categorie ----------
function sort(item, ctx) {
  const order = item.shuffle === false ? item.items.map((_, i) => i) : shuffle(item.items.map((_, i) => i));
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

// ---------- Klok ----------
function clockSvg(time) {
  const [hh, mm] = time.split(':').map(Number);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'clock');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Klok die ${time} aanwijst`);
  const add = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.append(e);
    return e;
  };
  add('circle', { cx: 50, cy: 50, r: 46, class: 'face' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    add('line', {
      x1: 50 + 38 * Math.sin(a), y1: 50 - 38 * Math.cos(a),
      x2: 50 + 43 * Math.sin(a), y2: 50 - 43 * Math.cos(a), class: 'tick',
    });
  }
  const hand = (angle, len, cls) => add('line', { x1: 50, y1: 50, x2: 50 + len * Math.sin(angle), y2: 50 - len * Math.cos(angle), class: cls });
  hand((((hh % 12) + mm / 60) / 12) * 2 * Math.PI, 24, 'hour');
  hand((mm / 60) * 2 * Math.PI, 35, 'minute');
  add('circle', { cx: 50, cy: 50, r: 2.5, class: 'pin' });
  return svg;
}

function clock(item, ctx) {
  const spec = clockSpec(item);
  const f = sentenceField(spec, ctx, { label: 'Hoe laat is het?', topic: 'klockan' });
  const el = h('div', { class: 'clock-item' }, clockSvg(item.time), h('div', {}, prompt(item.prompt ?? 'Hoe laat is het?'), f.field.el));
  return { el, check: f.check, reveal: f.reveal, lock: () => { f.field.lock(); lockInputs(el); } };
}

// ---------- Zinsbouw ----------
/** De tegels in de volgorde van het eerste goede antwoord (voor het meten van de zinsregel). */
function orderedTokens(item) {
  const answer = ` ${String(item.answers?.[0] ?? '').toLowerCase()}`;
  const at = (t) => answer.indexOf(` ${t.toLowerCase()}`) >>> 0;
  return [...item.tokens].sort((a, b) => at(a) - at(b));
}

function order(item, ctx) {
  const board = tileBoard({
    tiles: shuffle(item.tokens.map((t, i) => ({ t, i }))),
    start: item.start,
    label: 'Jouw zin',
    placeholder: 'Tik de woorden aan in de goede volgorde.',
    needed: item.tokens.length,
    sample: orderedTokens(item),
    onComplete: () => ctx.ready?.(),
  });
  const el = h('div', {}, prompt(item.prompt), board.el);
  return {
    el,
    check() {
      const res = gradeOrder(board.tokens(), item, ctx);
      board.mark(res.empty ? undefined : res.correct);
      return res;
    },
    reveal() {
      board.reveal(displayAnswer(item.answers));
    },
    lock: () => board.lock(),
  };
}



function table(item, ctx) {
  const specs = [];
  const inputs = [];
  const rows = item.rows.map((row) =>
    h('tr', {}, row.map((cell, c) => {
      if (cell && typeof cell === 'object') {
        const inp = textInput(cell, { label: item.columns[c] });
        specs.push(cell);
        inputs.push(inp);
        return h('td', { 'data-label': item.columns[c] }, inp);
      }
      return h(c === 0 ? 'th' : 'td', { lang: 'sv', scope: c === 0 ? 'row' : undefined, 'data-label': c === 0 ? undefined : item.columns[c] }, String(cell ?? ''));
    })),
  );
  const el = h('div', {}, prompt(item.prompt),
    h('div', { class: 'table-wrap' }, h('table', { class: 'fill' }, h('thead', {}, h('tr', {}, item.columns.map((c) => h('th', {}, c)))), h('tbody', {}, rows))),
  );
  return {
    el,
    check() {
      const res = gradeFields(inputs.map((i) => i.value), specs, ctx);
      markFields(inputs, res.fields);
      return res;
    },
    reveal() {
      inputs.forEach((inp, i) => {
        inp.value = displayAnswer(specs[i].answers);
        inp.classList.add('revealed');
      });
    },
    lock: () => lockInputs(el),
  };
}

// ---------- Juist/fout, eventueel met verbetering ----------
function truefalse(item, ctx) {
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

// ---------- Vrij schrijven ----------
function free(item) {
  const area = h('textarea', { class: 'answer-input free', rows: 6, lang: 'sv', spellcheck: false, 'aria-label': 'Jouw tekst' });
  const model = item.model ? h('details', { class: 'model' }, h('summary', {}, 'Voorbeeldantwoord'), h('p', { lang: 'sv' }, item.model)) : null;
  if (model) model.hidden = true;
  const el = h('div', {}, prompt(item.prompt), area, model);
  return {
    el,
    neutral: true,
    check() {
      const r = checkFree(area.value, item);
      if (model) model.hidden = false;
      if (!r.words) return { correct: false, empty: true, tip: 'Schrijf eerst je tekst.' };
      return { correct: r.allOk, neutral: true, checks: r.checks };
    },
    reveal() {
      if (model) { model.hidden = false; model.open = true; }
    },
    lock: () => lockInputs(el),
  };
}

// ---------- Zoek de fout ----------
function findError(item, ctx) {
  const words = item.sentence.split(' ');
  let phase = 'find';
  let chosen = null;
  let fixField = null;
  const buttons = words.map((w, i) =>
    h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': 'false',
      onclick: () => {
        if (phase !== 'find') return;
        chosen = i;
        buttons.forEach((b, k) => {
          b.classList.toggle('selected', k === i);
          b.classList.remove('bad');
          b.setAttribute('aria-pressed', String(k === i));
        });
        ctx.auto?.();
      },
    }, w),
  );
  const fix = h('div', { class: 'correction', hidden: true });
  const el = h('div', {},
    prompt(item.prompt ?? 'Klik op het woord dat niet klopt.'),
    h('div', { class: 'chips find-error', lang: 'sv', role: 'group', 'aria-label': 'Woorden van de zin' }, buttons),
    fix,
  );
  const showFix = (label) => {
    fixField = sentenceField(item, ctx, { label: 'Verbeterde zin', source: item.sentence, prefill: item.sentence });
    fix.replaceChildren(h('p', { class: 'prompt' }, fixField.field.kind === 'tiles' ? label.replace('Verbeter nu de zin:', 'Maak nu de goede zin:') : label), fixField.field.el);
    fix.hidden = false;
  };
  return {
    el,
    check() {
      if (phase === 'find') {
        if (chosen === null) return { correct: false, empty: true, tip: 'Klik eerst op het woord dat niet klopt.' };
        if (item.wrong.includes(chosen)) {
          buttons[chosen].classList.add('ok');
          phase = 'fix';
          buttons.forEach((b) => (b.disabled = true));
          showFix('Goed gevonden! Verbeter nu de zin:');
          fixField.field.focus();
          return { correct: true, advance: true };
        }
        buttons[chosen].classList.add('bad');
        return { correct: false, kind: 'find', tip: `„${words[chosen]}” is goed. ${item.tip ?? 'Zoek nog eens.'}` };
      }
      return fixField.check();
    },
    reveal() {
      item.wrong.forEach((i) => buttons[i].classList.add('ok'));
      if (!fixField) showFix('Goede zin:');
      fixField.reveal();
    },
    lock: () => { fixField?.field.lock(); lockInputs(el); },
  };
}

// ---------- Samengestelde vraag ----------
function steps(item, ctx) {
  const box = h('div', { class: 'steps' });
  const rendered = [];
  let current = 0;
  const addStep = (i) => {
    const r = RENDERERS[item.steps[i].type](item.steps[i], ctx);
    rendered[i] = r;
    const step = h('div', { class: 'step' }, h('span', { class: 'step-no' }, `Stap ${i + 1}`), r.el);
    box.append(step);
    // Niet scrollen en op een telefoon geen toetsenbord openen; de stap komt rustig in beeld.
    const first = r.el.querySelector('input, select, textarea, button');
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (first && !(touch && first.matches('input[type="text"], textarea'))) first.focus({ preventScroll: true });
    if (i > 0) requestAnimationFrame(() => step.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  };
  addStep(0);
  return {
    el: box,
    check() {
      const r = rendered[current];
      const res = r.check();
      if (res.correct && res.advance) return res;
      if (res.correct && current < item.steps.length - 1) {
        r.lock();
        current++;
        addStep(current);
        return { correct: true, advance: true };
      }
      return res;
    },
    reveal() {
      rendered[current].reveal();
      rendered[current].lock();
      for (let i = current + 1; i < item.steps.length; i++) {
        addStep(i);
        rendered[i].reveal();
        rendered[i].lock();
      }
      current = item.steps.length - 1;
    },
    lock() {
      rendered.forEach((r) => r.lock());
    },
  };
}

export const RENDERERS = { mc, multi, gap, translate, transform, listen, sort, clock, order, dialogue, match, table, truefalse, free, steps, findError };
