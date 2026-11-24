// Zinnen invoeren met woordtegels in plaats van typen (handig op een telefoon).
// Een zinsveld geeft { el, value(), reveal(text), mark(ok), lock(), focus() } terug,
// zodat de vraagtypen niet hoeven te weten of er getypt of getikt wordt.
import { h, isTouch } from '../dom.js';
import { displayAnswer, expand } from '../../core/check/normalize.js';
import { shuffle } from '../../core/content/build.js';
import { draggable, dropIndex, inside } from './drag.js';
import { getPref, setPref } from '../../app/progress.js';

const MIN_WORDS = 3; // kortere antwoorden blijven gewoon typen
const MAX_DISTRACTORS = 3;

/** 'tiles', 'type' of 'auto' (tegels op een touchscreen). */
export const getInputMode = () => getPref('input', 'auto');
export const setInputMode = (m) => setPref('input', m);

function useTiles() {
  const mode = getInputMode();
  if (mode === 'tiles') return true;
  if (mode === 'type') return false;
  return isTouch();
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

/**
 * De tegels voor een antwoord: de woorden van het eerste antwoord, zonder de optionele stukken [..].
 * Anders kun je een optioneel stuk half leggen („så” zonder „mycket”) en is je zin fout.
 */
export function answerTiles(answers) {
  const first = String([].concat(answers ?? [])[0] ?? '');
  let depth = 0;
  let core = '';
  for (const c of first) {
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (!depth) core += c;
  }
  core = core.replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
  const ws = words(displayAnswer(core && words(core).length ? [core] : answers));
  if (ws.length) ws[0] = lowerFirst(ws[0]);
  return ws;
}

/**
 * Afleiders: woorden uit vastgelegde foute antwoorden en uit de bronzin
 * die niet in het goede antwoord voorkomen.
 */
export function distractorTiles(spec, { source } = {}) {
  // Gaat het om hoofdletters (caseSensitive), dan is „Måndag” naast „måndag” juist een goede afleider.
  const keyOf = (w) => (spec.caseSensitive ? w : w.toLowerCase());
  const inAnswer = new Set(words(displayAnswer(spec.answers)).map(keyOf));
  const pool = [];
  for (const f of spec.feedback ?? []) {
    for (const m of [].concat(f.match ?? [], f.contains ?? [])) pool.push(...words(expand(m)[0]));
  }
  if (source) pool.push(...words(source.replace(/\*\*|\*|”|”/g, '')));
  const seen = new Set();
  const out = [];
  for (const w of pool) {
    const key = keyOf(w);
    if (inAnswer.has(key) || seen.has(key) || w.length < 2) continue;
    seen.add(key);
    out.push(!spec.caseSensitive && lowerWords.has(key) && !names.has(w) ? key : w);
  }
  return out.slice(0, MAX_DISTRACTORS);
}

export const isSentence = (answers) => words(displayAnswer(answers)).length >= MIN_WORDS;

/**
 * Invoerveld voor een zin. spec: { answers, feedback? }.
 * opts: { label, source (bronzin voor afleiders), prefill, onComplete, textInput(spec, opts) }
 */
// Zinsvelden op de pagina die nog mee kunnen wisselen als je „Liever typen” of „Liever woordtegels” kiest.
const live = new Set();

export function sentenceInput(spec, opts) {
  const wrap = h('div', { class: 'sentence-input' });
  let impl;
  let locked = false;
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
            // De keuze geldt ook voor de andere vragen op deze pagina waar je nog niets hebt ingevuld.
            for (const other of live) other.follow();
          },
        }, impl.kind === 'tiles' ? 'Liever typen' : 'Liever woordtegels')
      : null;
    wrap.replaceChildren(impl.el, switchLink ?? '');
  };
  build();
  const self = {
    follow() {
      if (!wrap.isConnected) return void live.delete(self);
      if (locked || impl.kind === (useTiles() ? 'tiles' : 'type')) return;
      if ((impl.value() ?? '').trim() !== (opts.prefill ?? '').trim()) return; // al iets ingevuld: laten staan
      build();
    },
  };
  if (isSentence(spec.answers)) live.add(self);
  return {
    el: wrap,
    get kind() { return impl.kind; },
    value: () => impl.value(),
    reveal: (text) => impl.reveal(text),
    mark: (ok) => impl.mark(ok),
    lock: () => {
      locked = true;
      live.delete(self);
      impl.lock();
      // Onzichtbaar maken in plaats van weghalen, zodat de knoppen eronder niet verspringen.
      const sw = wrap.querySelector('.input-switch');
      if (sw) {
        sw.style.visibility = 'hidden';
        sw.disabled = true;
      }
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
  };
}

/**
 * Zin leggen met woordtegels, gedeeld door vertalen (tegels) en zinsbouw.
 * - Een gekozen tegel laat een lege plek in de bank achter, zodat de andere tegels niet onder
 *   je vinger verschuiven.
 * - Een invoegcursor in de zin (standaard achteraan): tik tussen twee woorden om daar verder
 *   te gaan. Een tik op een woord in de zin haalt het weg. Op een woord in de zin verplaatsen
 *   ←/→ het woord, Delete/Backspace haalt het weg.
 * - Tegels zijn ook te slepen (drag.js): naar een plek in de zin, of uit de zin weg.
 * - Er wordt niet vanzelf nagekeken: onComplete meldt alleen dat alle woorden liggen.
 * opts: { tiles: [{ t }], start (vaste tekst vooraan), label, placeholder, needed (aantal woorden
 *   van een volledige zin), sample (de woorden van de goede zin, om de hoogte te meten), onComplete }
 */
export function tileBoard(opts) {
  const all = opts.tiles;
  let chosen = [];
  let cursor = 0;
  let locked = false;
  const line = h('div', { class: 'chips line', lang: 'sv', role: 'group', 'aria-label': opts.label ?? 'Jouw zin' });
  const bank = h('div', { class: 'chips bank', lang: 'sv', role: 'group', 'aria-label': 'Woorden' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const say = (text) => { live.textContent = text; };

  /** Na elke wijziging; true als de zin compleet is (dan krijgt Controleer de focus). */
  const changed = () => {
    line.classList.remove('ok', 'bad');
    draw();
    if (chosen.length !== opts.needed || !opts.onComplete) return false;
    opts.onComplete();
    return true;
  };
  const remove = (i, { refocus = true } = {}) => {
    const [c] = chosen.splice(i, 1);
    if (i < cursor) cursor--;
    say(`„${c.t}” weggehaald.`);
    changed();
    if (refocus) (line.querySelectorAll('.chip:not(.fixed)')[Math.min(i, chosen.length - 1)] ?? bankFirst())?.focus({ preventScroll: true });
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= chosen.length) return;
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    if (cursor === i + 1 || cursor === j + 1) cursor = Math.max(i, j) + 1;
    say(`„${chosen[j].t}” staat nu op plaats ${j + 1} van ${chosen.length}.`);
    changed();
    line.querySelectorAll('.chip:not(.fixed)')[j]?.focus({ preventScroll: true });
  };
  const slot = (pos) => h('button', {
    type: 'button',
    class: `slot${pos === chosen.length ? ' end' : ''}`,
    disabled: locked,
    'aria-pressed': String(pos === cursor),
    'aria-label': pos < chosen.length ? `Invoegen vóór „${chosen[pos].t}”` : 'Invoegen aan het eind',
    onclick: () => {
      cursor = pos;
      say(pos < chosen.length ? `Volgende woord komt vóór „${chosen[pos].t}”.` : 'Volgende woord komt aan het eind.');
      draw();
      bankFirst()?.focus({ preventScroll: true });
    },
  });
  const bankFirst = () => bank.querySelector('.chip:not(.used):not(:disabled)');

  // ---------- Slepen ----------
  const lineChips = (except) => [...line.querySelectorAll('.chip:not(.fixed)')].filter((c) => c !== except);
  const showDrop = (except) => (p) => {
    const at = inside(line, p) ? dropIndex(lineChips(except), p) : -1;
    line.querySelectorAll('.slot').forEach((s, k) => s.classList.toggle('drop', k === at));
    line.classList.toggle('drop-out', at === -1 && !!except);
  };
  const endDrag = () => {
    line.querySelectorAll('.slot.drop').forEach((s) => s.classList.remove('drop'));
    line.classList.remove('drop-out');
  };
  /** Tegel uit de zin (plek i) losgelaten op p: verplaatsen binnen de zin, of weghalen. */
  const dropFromLine = (i, el) => (p) => {
    if (!inside(line, p)) return remove(i, { refocus: false });
    const to = dropIndex(lineChips(el), p);
    const [c] = chosen.splice(i, 1);
    chosen.splice(to, 0, c);
    cursor = chosen.length;
    say(`„${c.t}” staat nu op plaats ${to + 1} van ${chosen.length}.`);
    changed();
  };
  /** Tegel uit de bank losgelaten op p: invoegen op die plek in de zin. */
  const dropFromBank = (c) => (p) => {
    if (!inside(line, p) || chosen.includes(c)) return;
    const to = dropIndex(lineChips(), p);
    chosen.splice(to, 0, c);
    cursor = chosen.length;
    say(`„${c.t}” ingevoegd op plaats ${to + 1} van ${chosen.length}.`);
    changed();
  };

  // Getoond goed antwoord (reveal): blijft staan, ook als lock() de regel daarna opnieuw tekent.
  let revealedText = null;

  function draw() {
    if (revealedText !== null) {
      line.replaceChildren(h('span', { class: 'chip revealed' }, revealedText));
      line.classList.remove('has-cursor', 'ok', 'bad');
      line.style.minHeight = '';
      bank.replaceChildren();
      bank.hidden = true; // geen lege ruimte waar de tegels stonden
      return;
    }
    const kids = [];
    if (opts.start) kids.push(h('span', { class: 'chip fixed' }, opts.start));
    chosen.forEach((c, i) => {
      let chip;
      kids.push(slot(i), chip = h('button', {
        type: 'button',
        class: 'chip',
        disabled: locked,
        'aria-label': `${c.t}, plaats ${i + 1}. Tik om weg te halen.`,
        onclick: () => remove(i),
        onkeydown: (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            move(i, e.key === 'ArrowLeft' ? -1 : 1);
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            remove(i);
          }
        },
      }, c.t));
      draggable(chip, { disabled: () => locked, onMove: showDrop(chip), onDrop: dropFromLine(i, chip), onEnd: endDrag });
    });
    if (chosen.length || opts.start) kids.push(slot(chosen.length));
    if (!chosen.length && !opts.start) kids.push(h('span', { class: 'placeholder' }, opts.placeholder ?? 'Tik de woorden aan in de goede volgorde.'));
    line.replaceChildren(...kids);
    line.classList.toggle('has-cursor', chosen.length > 0 && cursor < chosen.length);
    // Gebruikte tegels blijven als lege plek staan: de bank verspringt niet.
    bank.replaceChildren(...all.map((c) => {
      const used = chosen.includes(c);
      const chip = h('button', {
        type: 'button',
        class: `chip${used ? ' used' : ''}`,
        disabled: locked || used,
        'aria-hidden': used ? 'true' : null,
        tabindex: used ? '-1' : null,
        onclick: () => {
          if (chosen.includes(c)) return;
          chosen.splice(cursor, 0, c);
          cursor++;
          say(cursor < chosen.length ? `„${c.t}” ingevoegd op plaats ${cursor} van ${chosen.length}.` : '');
          if (!changed()) bankFirst()?.focus({ preventScroll: true });
        },
      }, c.t);
      if (!used) draggable(chip, { disabled: () => locked, onMove: showDrop(null), onDrop: dropFromBank(c), onEnd: endDrag });
      return chip;
    }));
  }
  draw();

  // De zinsregel krijgt meteen de hoogte van de volledige zin, zodat hij niet groeit terwijl je
  // tegels legt. Gemeten met een onzichtbare kopie van de goede zin (of anders de langste tegels).
  const el = h('div', { class: 'tiles' }, line, bank, live);
  const sample = opts.sample ?? [...all].sort((a, b) => b.t.length - a.t.length).slice(0, opts.needed ?? all.length).map((c) => c.t);
  let fittedWidth = 0;
  const fitLine = () => {
    const width = line.offsetWidth;
    if (locked || revealedText !== null || !width || width === fittedWidth) return;
    fittedWidth = width;
    const probe = h('div', { class: 'chips line', 'aria-hidden': 'true', style: `position: absolute; visibility: hidden; width: ${width}px` },
      opts.start ? h('span', { class: 'chip fixed' }, opts.start) : null,
      ...sample.flatMap((t) => [h('span', { class: 'slot' }), h('span', { class: 'chip' }, t)]),
      h('span', { class: 'slot end' }));
    el.append(probe);
    line.style.minHeight = `${probe.offsetHeight}px`;
    probe.remove();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(fitLine).observe(line);

  return {
    el,
    tokens: () => chosen.map((c) => c.t),
    reveal(text) {
      revealedText = text;
      draw();
    },
    mark(ok) {
      if (revealedText !== null) return;
      line.classList.toggle('ok', ok === true);
      line.classList.toggle('bad', ok === false);
    },
    lock() {
      locked = true;
      draw();
    },
    focus() {
      bankFirst()?.focus({ preventScroll: true });
    },
  };
}

/**
 * Een vaste opening (spec.tileStart, bv. „Klockan är” bij de klok) staat als vaste tegel vooraan als
 * het eerste antwoord met die opening als optioneel stuk begint. Zo kan de leerling hem niet half leggen.
 */
export function tileStart(spec) {
  const first = String([].concat(spec.answers ?? [])[0] ?? '');
  const pat = spec.tileStart ? `[${spec.tileStart} ]` : null;
  return pat && first.startsWith(pat) ? { start: spec.tileStart, body: [first.slice(pat.length)] } : { start: null, body: spec.answers };
}

function tileImpl(spec, opts) {
  const { start, body } = tileStart(spec);
  const answer = answerTiles(body);
  const tiles = shuffle([...answer, ...distractorTiles(spec, { source: opts.source })].map((t, i) => ({ t, i })));
  const board = tileBoard({ tiles, start, label: opts.label, placeholder: opts.placeholder, needed: answer.length, sample: answer, onComplete: opts.onComplete });
  return {
    kind: 'tiles',
    el: board.el,
    value: () => [start, ...board.tokens()].filter(Boolean).join(' '),
    reveal: board.reveal,
    mark: board.mark,
    lock: board.lock,
    focus: board.focus,
  };
}
