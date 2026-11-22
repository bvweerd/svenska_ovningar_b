// Flitskaarten.
import { h } from '../../dom.js';
import { crumbs, progressBar } from '../../shared.js';
import { shuffle } from '../../../core/content/build.js';
import { getPref, setPref, rateCard, pickCards, cardProgress } from '../../../app/progress.js';
import { speak, speechSupported } from '../../../platform/speech.js';
import { plural, onKeys } from './common.js';

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
  let flipped;
  let stackSize;
  let wrongOnce;

  const face = h('div', { class: 'flash-face' });
  const card = h('button', { type: 'button', class: 'flashcard', 'aria-live': 'polite', onclick: () => flip() }, face);
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
      actions.replaceChildren();
      summary.hidden = false;
      summary.replaceChildren(...finish().filter(Boolean));
      setTimeout(() => summary.querySelector('.btn.primary')?.focus(), 0);
      return;
    }
    card.hidden = false;
    summary.hidden = true;
    card.classList.toggle('flipped', flipped);
    face.replaceChildren(
      h('span', { class: 'flash-main', lang: dir === 'sv' && !flipped ? 'sv' : dir === 'nl' && flipped ? 'sv' : 'nl' }, flipped ? back(current.v) : front(current.v)),
      h('span', { class: 'flash-hint' }, flipped ? front(current.v) : 'Tik op de kaart (of druk op spatie) om hem om te draaien'),
    );
    // Vaste knoppen op een vaste plek: „Wist ik” en „Nog niet” kunnen pas na het omdraaien, zodat
    // een dubbele tik op de kaart niet per ongeluk een beoordeling geeft.
    actions.replaceChildren(
      h('button', { type: 'button', class: 'btn primary', disabled: !flipped, onclick: () => rate(true) }, 'Wist ik (1)'),
      h('button', { type: 'button', class: 'btn ghost', disabled: !flipped, onclick: () => rate(false) }, 'Nog niet (2)'),
      speechSupported() ? h('button', { type: 'button', class: 'btn ghost speech-extra', onclick: () => speak(current.v.sv) }, 'Luister (L)') : '');
  };
  let flippedAt = 0;
  const settling = () => Date.now() - flippedAt < 350;
  const flip = () => {
    if (!current || settling()) return;
    flipped = !flipped;
    flippedAt = Date.now();
    show();
  };
  const rate = (ok) => {
    if (!current || !flipped || settling()) return;
    // Alleen de eerste beoordeling telt: wat je pas na herhalen wist, komt in een volgende stapel terug.
    if (!current.rated) rateCard(ch.chapter, dir, current.v.sv, ok);
    current.rated = true;
    if (!ok) {
      wrongOnce.add(current.v.sv);
      deck.splice(Math.min(3, deck.length), 0, current);
    }
    current = deck.shift() ?? null;
    flipped = false;
    show();
    card.focus();
  };
  function start() {
    const pick = new Set(pickCards(ch.chapter, dir, words, CARD_STACK));
    deck = shuffle(vocab.filter((v) => pick.has(v.sv)).map((v) => ({ v, rated: false })));
    stackSize = deck.length;
    current = deck.shift() ?? null;
    flipped = false;
    wrongOnce = new Set();
    show();
    card.focus();
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
      h('p', { class: 'instruction' }, `Draai de kaart om en geef eerlijk aan of je het wist. Je oefent in stapels van ${CARD_STACK}: eerst wat nieuw is of wat je nog niet wist. Wat je in de stapel niet wist, komt een paar kaarten later terug.`),
      h('div', { class: 'actions' }, dirButtons)),
    progress, card, actions, summary,
  );
  onKeys(view, (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' || (e.key === 'Enter' && e.target === card)) {
      e.preventDefault();
      flip();
    } else if (e.key === '1' || e.key.toLowerCase() === 'j') rate(true);
    else if (e.key === '2' || e.key.toLowerCase() === 'n') rate(false);
    else if (e.key.toLowerCase() === 'l' && current) speak(current.v.sv);
  }, signal);
  if (!vocab.length) return h('div', {}, h('p', {}, 'Dit hoofdstuk heeft geen woordenlijst.'));
  start();
  setTimeout(() => card.focus(), 0);
  return view;
}
