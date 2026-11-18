// Zinnen invoeren met woordtegels in plaats van typen (handig op een telefoon).
// Een zinsveld geeft { el, value(), reveal(text), mark(ok), lock(), focus() } terug,
// zodat de vraagtypen niet hoeven te weten of er getypt of getikt wordt.
import { h } from '../dom.js';
import { displayAnswer, expand } from '../check/normalize.js';
import { shuffle } from '../build.js';
import { getPref, setPref } from '../progress.js';

const MIN_WORDS = 3; // kortere antwoorden blijven gewoon typen
const MAX_DISTRACTORS = 3;

/** 'tiles', 'type' of 'auto' (tegels op een touchscreen). */
export const getInputMode = () => getPref('input', 'auto');
export const setInputMode = (m) => setPref('input', m);

export function useTiles() {
  const mode = getInputMode();
  if (mode === 'tiles') return true;
  if (mode === 'type') return false;
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// Het eerste woord krijgt een kleine letter, zodat de hoofdletter niet verraadt welk woord
// vooraan hoort. Behalve namen: woorden die in de cursus midden in een zin met een hoofdletter staan.
let lowerWords = new Set();
let names = new Set();
export function setKnownWords(words, nameWords = []) {
  lowerWords = new Set(words);
  names = new Set(nameWords);
}
const lowerFirst = (w) => (names.has(w) ? w : w.toLowerCase());

const strip = (w) => w.replace(/^[„”"'«(]+|[.,!?;:…”"'»)]+$/g, '');
const words = (s) => s.split(/\s+/).map(strip).filter(Boolean);

/** De tegels voor een antwoord: de woorden van het eerste antwoord. */
export function answerTiles(answers) {
  const ws = words(displayAnswer(answers));
  if (ws.length) ws[0] = lowerFirst(ws[0]);
  return ws;
}

/**
 * Afleiders: woorden uit vastgelegde foute antwoorden en uit de bronzin
 * die niet in het goede antwoord voorkomen.
 */
export function distractorTiles(spec, { source } = {}) {
  const inAnswer = new Set(words(displayAnswer(spec.answers)).map((w) => w.toLowerCase()));
  const pool = [];
  for (const f of spec.feedback ?? []) {
    for (const m of [].concat(f.match ?? [], f.contains ?? [])) pool.push(...words(expand(m)[0]));
  }
  if (source) pool.push(...words(source.replace(/\*\*|\*|”|”/g, '')));
  const seen = new Set();
  const out = [];
  for (const w of pool) {
    const key = w.toLowerCase();
    if (inAnswer.has(key) || seen.has(key) || w.length < 2) continue;
    seen.add(key);
    out.push(lowerWords.has(key) && !names.has(w) ? key : w);
  }
  return out.slice(0, MAX_DISTRACTORS);
}

export const isSentence = (answers) => words(displayAnswer(answers)).length >= MIN_WORDS;

/**
 * Invoerveld voor een zin. spec: { answers, feedback? }.
 * opts: { label, source (bronzin voor afleiders), prefill, onComplete, textInput(spec, opts) }
 */
export function sentenceInput(spec, opts) {
  const wrap = h('div', { class: 'sentence-input' });
  let impl;
  const build = () => {
    impl = useTiles() && isSentence(spec.answers) ? tileImpl(spec, opts) : typedImpl(spec, opts);
    const switchLink = isSentence(spec.answers)
      ? h('button', {
          type: 'button',
          class: 'link-btn input-switch',
          onclick: () => {
            setInputMode(impl.kind === 'tiles' ? 'type' : 'tiles');
            build();
            impl.focus();
          },
        }, impl.kind === 'tiles' ? 'Liever typen' : 'Liever woordtegels')
      : null;
    wrap.replaceChildren(impl.el, switchLink ?? '');
  };
  build();
  return {
    el: wrap,
    get kind() { return impl.kind; },
    value: () => impl.value(),
    reveal: (text) => impl.reveal(text),
    mark: (ok) => impl.mark(ok),
    lock: () => {
      impl.lock();
      wrap.querySelector('.input-switch')?.remove();
    },
    focus: () => impl.focus(),
  };
}

function typedImpl(spec, opts) {
  const input = opts.textInput(spec, { wide: true, label: opts.label });
  if (opts.prefill) input.value = opts.prefill;
  return {
    kind: 'type',
    el: input,
    value: () => input.value,
    reveal(text) {
      input.value = text;
      input.classList.add('revealed');
    },
    mark(ok) {
      input.classList.toggle('ok', ok === true);
      input.classList.toggle('bad', ok === false);
    },
    lock() { input.disabled = true; },
    focus() {
      input.focus();
      if (opts.prefill) input.setSelectionRange(input.value.length, input.value.length);
    },
    input,
  };
}

function tileImpl(spec, opts) {
  const answer = answerTiles(spec.answers);
  const all = shuffle([...answer, ...distractorTiles(spec, { source: opts.source })].map((t, i) => ({ t, i })));
  let chosen = [];
  let locked = false;
  const line = h('div', { class: 'chips line', lang: 'sv', 'aria-label': opts.label ?? 'Jouw zin' });
  const bank = h('div', { class: 'chips bank', lang: 'sv', 'aria-label': 'Woorden' });
  const draw = () => {
    line.replaceChildren(...(chosen.length
      ? chosen.map((c) => h('button', { type: 'button', class: 'chip', disabled: locked, onclick: () => { chosen = chosen.filter((x) => x !== c); draw(); } }, c.t))
      : [h('span', { class: 'placeholder' }, 'Tik de woorden aan in de goede volgorde.')]));
    bank.replaceChildren(...all.filter((x) => !chosen.includes(x)).map((c) =>
      h('button', {
        type: 'button',
        class: 'chip',
        disabled: locked,
        onclick: () => {
          chosen.push(c);
          line.classList.remove('ok', 'bad');
          draw();
          if (chosen.length === answer.length) opts.onComplete?.();
        },
      }, c.t)));
  };
  draw();
  return {
    kind: 'tiles',
    el: h('div', { class: 'tiles' }, line, bank),
    value: () => chosen.map((c) => c.t).join(' '),
    reveal(text) {
      line.replaceChildren(h('span', { class: 'chip revealed' }, text));
      bank.replaceChildren();
    },
    mark(ok) {
      line.classList.toggle('ok', ok === true);
      line.classList.toggle('bad', ok === false);
    },
    lock() {
      locked = true;
      line.querySelectorAll('button').forEach((b) => (b.disabled = true));
      bank.querySelectorAll('button').forEach((b) => (b.disabled = true));
    },
    focus() {
      bank.querySelector('button')?.focus({ preventScroll: true });
    },
  };
}
