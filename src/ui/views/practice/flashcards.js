// Flitskaarten.
import { h, fill } from '../../dom.js';
import { crumbs, progressBar } from '../../shared.js';
import { shuffle } from '../../../core/content/build.js';
import { getPref, setPref, rateCard, pickCards, cardProgress } from '../../../app/progress.js';
import { speak, speechSupported } from '../../../platform/speech.js';
import { plural } from './common.js';

/** Zoveel kaarten per stapel; daarna zie je hoe ver je bent (net als de rondes van een woordenlijst). */
const CARD_STACK = 15;

export function viewFlashcards(ch, { signal } = {}) {
  document.title = `Flitskaarten · ${ch.title}`;
  const vocab = ch.vocab ?? [];
  const ex = ch.exercises.find((e) => e.id === 'woorden-sv-nl');
  const words = vocab.map((v) => v.sv);
  let dir = getPref('cardsDir', 'sv');
  let deck;
  let current;
  let stackSize;
  let wrongOnce;

  const face = h('div', { class: 'flash-face' });
  const card = h('div', { class: 'flashcard', 'aria-live': 'polite' }, face);
  const options = h('div', { class: 'flash-options' });
  const actions = h('div', { class: 'actions flash-actions' });
  const progress = h('div', { class: 'score' });
  const summary = h('div', { class: 'summary', hidden: true });

  const front = (v) => (dir === 'sv' ? v.sv : v.nl);
  const back = (v) => (dir === 'sv' ? v.nl : v.sv);
  const typing = () => (ex ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/o/woorden-nl-sv` }, 'Oefen de woorden met typen') : null);

  const finish = () => {
    const p = cardProgress(ch.chapter, dir, words);
    const again = wrongOnce.size ? h('p', {}, `${plural(wrongOnce.size, 'kaart', 'kaarten')} moest je vaker zien; ${wrongOnce.size === 1 ? 'die komt' : 'die komen'} in een volgende stapel terug.`) : null;
    if (!p.fresh && !p.unknown) {
      return [
        h('h2', {}, `Je kent alle ${p.total} woorden!`),
        again,
        h('div', { class: 'actions' },
          ex ? h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/o/woorden-nl-sv` }, 'Oefen de woorden met typen') : h('a', { class: 'btn primary', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk'),
          h('button', { type: 'button', class: 'btn ghost', onclick: start }, 'Nog een stapel (herhalen)')),
      ];
    }
    const todo = [p.fresh ? `${p.fresh} nog nieuw` : null, p.unknown ? `${p.unknown} nog niet gekend` : null].filter(Boolean).join(', ');
    return [
      h('h2', {}, 'Stapel klaar!'),
      h('p', {}, `Je kent nu ${p.known} van de ${p.total} woorden (${todo}).`),
      progressBar(p.known, p.total, `${p.known} van ${p.total} woorden gekend`),
      again,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Volgende stapel'), typing()),
    ];
  };

  const show = () => {
    const p = cardProgress(ch.chapter, dir, words);
    progress.textContent = `Stapel: nog ${deck.length + (current ? 1 : 0)} van ${stackSize} kaarten · ${p.known} van ${p.total} woorden gekend`;
    if (!current) {
      card.hidden = true;
      fill(actions, );
      summary.hidden = false;
      fill(summary, finish());
      setTimeout(() => summary.querySelector('.btn.primary')?.focus(), 0);
      return;
    }
    card.hidden = false;
    summary.hidden = true;
    card.classList.toggle('flipped', current.answered);
    fill(face,
      h('span', { class: 'flash-main', lang: dir === 'sv' ? 'sv' : 'nl' }, front(current.v)),
      h('span', { class: 'flash-hint' }, current.answered ? (current.ok ? 'Goed!' : `Het is: ${back(current.v)}`) : 'Kies de goede betekenis (of druk op 1–4)'),
    );
    const buttons = current.options.map((v, i) => {
      const cls = !current.answered ? 'btn ghost flash-opt'
        : v === current.v ? 'btn ghost flash-opt good'
          : v === current.chosen ? 'btn ghost flash-opt bad' : 'btn ghost flash-opt';
      return h('button', { type: 'button', class: cls, lang: dir === 'sv' ? 'nl' : 'sv', disabled: current.answered, onclick: () => answer(v) }, `${i + 1}. ${back(v)}`);
    });
    fill(options, buttons);
    fill(actions,
      current.answered ? h('button', { type: 'button', class: 'btn primary flash-next', onclick: next }, 'Volgende (Enter)') : '',
      speechSupported() ? h('button', { type: 'button', class: 'btn ghost speech-extra', onclick: () => speak(current.v.sv) }, 'Luister (L)') : '');
  };
  /** Drie andere woorden uit het hoofdstuk als foute keuzes, met een andere vertaling dan het goede antwoord. */
  const optionsFor = (v) => {
    const others = shuffle(vocab.filter((o) => o !== v && back(o) !== back(v)));
    const seen = new Set([back(v)]);
    const wrong = [];
    for (const o of others) {
      if (wrong.length === 3) break;
      if (!seen.has(back(o))) { seen.add(back(o)); wrong.push(o); }
    }
    return shuffle([v, ...wrong]);
  };
  // De app kijkt na: alleen de eerste keuze per kaart telt; wat fout ging, komt een paar kaarten later terug.
  const answer = (v) => {
    if (!current || current.answered) return;
    current.answered = true;
    current.chosen = v;
    current.ok = v === current.v;
    if (!current.rated) rateCard(ch.chapter, dir, current.v.sv, current.ok);
    current.rated = true;
    if (!current.ok) wrongOnce.add(current.v.sv);
    show();
    actions.querySelector('.flash-next')?.focus();
  };
  const next = () => {
    if (!current || !current.answered) return;
    if (!current.ok) deck.splice(Math.min(3, deck.length), 0, { ...current, answered: false, chosen: null, options: optionsFor(current.v) });
    current = deck.shift() ?? null;
    show();
  };
  function start() {
    const pick = new Set(pickCards(ch.chapter, dir, words, CARD_STACK));
    deck = shuffle(vocab.filter((v) => pick.has(v.sv)).map((v) => ({ v, rated: false, answered: false, options: optionsFor(v) })));
    stackSize = deck.length;
    current = deck.shift() ?? null;
    wrongOnce = new Set();
    show();
  }
  const dirBtn = (value, label) => h('button', {
    type: 'button',
    class: `btn ${dir === value ? 'primary' : 'ghost'} small`,
    onclick: () => {
      dir = value;
      setPref('cardsDir', value);
      dirButtons.forEach((b) => b.className = `btn ${b.dataset.dir === dir ? 'primary' : 'ghost'} small`);
      start();
    },
    'data-dir': value,
  }, label);
  const dirButtons = [dirBtn('sv', 'Zweeds → Nederlands'), dirBtn('nl', 'Nederlands → Zweeds')];

  const view = h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: 'Flitskaarten' }),
    h('header', { class: 'page-head' },
      h('h1', {}, `Flitskaarten: ${ch.title}`),
      h('p', { class: 'instruction' }, `Kies bij elk woord de goede betekenis; de app kijkt na. Je oefent in stapels van ${CARD_STACK}: eerst wat nieuw is of wat je nog niet wist. Wat je fout had, komt een paar kaarten later terug.`),
      h('div', { class: 'actions' }, dirButtons)),
    progress, card, options, actions, summary,
  );
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (!current) return;
    if (e.key === 'Enter' && current.answered && !e.target.matches('button')) {
      e.preventDefault();
      next();
    } else if (/^[1-4]$/.test(e.key) && !current.answered) answer(current.options[Number(e.key) - 1]);
    else if (e.key.toLowerCase() === 'l' && current) speak(current.v.sv);
  }, { signal });
  if (!vocab.length) return h('div', {}, h('p', {}, 'Dit hoofdstuk heeft geen woordenlijst.'));
  start();
  return view;
}
