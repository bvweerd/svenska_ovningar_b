// Hand-outs om af te drukken: één grammaticakaart per A4, om bijvoorbeeld op te hangen.
// Op het scherm een verkleinde voorvertoning; bij afdrukken alleen de vellen (zie @media print).
// Is de uitleg lang, dan wordt de letter kleiner tot alles op één vel past.
import { h } from '../dom.js';
import { markdown, inline } from '../md.js';
import { crumbs, splitTheme } from '../shared.js';
import { chapterHue } from '../components/chapter.js';

/** Lettergrootte (pt) van de uitleg: beginnen bij MAX, kleiner tot het past, nooit onder MIN. */
const MAX_PT = 11.5;
const MIN_PT = 7;

const siteUrl = () => `${location.origin}${location.pathname}`.replace(/index\.html$/, '');

function sheet(ch, card) {
  const { name } = splitTheme(ch.theme);
  const body = h('div', { class: 'sheet-body', html: markdown(card.body) });
  return h('article', { class: 'sheet', style: chapterHue(ch) },
    h('div', { class: 'sheet-flag', 'aria-hidden': 'true' }),
    h('header', { class: 'sheet-head' },
      h('p', { class: 'sheet-eyebrow' }, `${ch.title} · ${name}`),
      h('h1', { class: 'sheet-title' }, card.title)),
    h('div', { class: 'sheet-rule' },
      h('span', { class: 'sheet-rule-label' }, 'Onthoud'),
      h('p', { html: inline(card.summary) })),
    body,
    h('footer', { class: 'sheet-foot' },
      h('span', {}, 'Svenska övningar'),
      h('span', {}, siteUrl()),
      h('span', {}, 'oefenstof CC BY-NC-SA 4.0')));
}

/** Kleinere letter tot de uitleg in de kolommen past (geen extra kolom rechts, niets onderaf). */
export function fitSheet(el) {
  const body = el.querySelector('.sheet-body');
  if (!body) return;
  const fits = (pt) => {
    body.style.fontSize = `${pt}pt`;
    return body.scrollWidth <= body.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1;
  };
  // Grootste lettergrootte (in stappen van 0,25 pt) die past: binair zoeken, een paar metingen.
  let lo = 0;
  let hi = (MAX_PT - MIN_PT) * 4; // aantal stappen omlaag
  if (!fits(MAX_PT)) {
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (fits(MAX_PT - mid / 4)) hi = mid;
      else lo = mid + 1;
    }
  }
  el.classList.toggle('too-long', !fits(MAX_PT - lo / 4));
}

/** Voorvertoning op het scherm: het vel (210 mm breed) geschaald naar de beschikbare breedte. */
function frame(el) {
  const box = h('div', { class: 'sheet-frame' }, el);
  const scale = () => {
    if (!box.isConnected) return;
    const s = Math.min(1, box.clientWidth / el.offsetWidth);
    el.style.transform = `scale(${s})`;
    box.style.height = `${el.offsetHeight * s}px`;
  };
  box.layout = () => {
    el.style.transform = '';
    fitSheet(el);
    scale();
  };
  box.rescale = scale;
  return box;
}

function printPage({ title, back, sheets, intro, signal }) {
  document.title = `${title} · afdrukken`;
  const frames = sheets.map(frame);
  const layout = () => frames.forEach((f) => f.layout());
  // Pas meten als de pagina in het document staat en de letters geladen zijn.
  requestAnimationFrame(() => {
    layout();
    document.fonts?.ready.then(layout);
  });
  window.addEventListener('resize', () => frames.forEach((f) => f.rescale()), { signal });
  // Voor het afdrukken geen schaal; daarna weer de voorvertoning.
  window.addEventListener('beforeprint', () => frames.forEach((f) => { f.firstChild.style.transform = ''; f.style.height = ''; }), { signal });
  window.addEventListener('afterprint', () => frames.forEach((f) => f.rescale()), { signal });
  return h('div', { class: 'print-page' },
    h('div', { class: 'no-print' },
      crumbs(...back, { label: 'Afdrukken' }),
      h('header', { class: 'page-head' },
        h('h1', {}, title),
        h('p', { class: 'muted' }, intro),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => window.print() }, 'Afdrukken'),
          h('a', { class: 'btn ghost', href: back[back.length - 1].href }, 'Terug')))),
    frames);
}

export function viewPrintCard(ch, card, { signal } = {}) {
  return printPage({
    title: card.title,
    intro: 'Een A4 met deze uitleg, om op te hangen of naast je te leggen. Kies bij het afdrukken A4, staand, zonder kop- en voetteksten van de browser.',
    back: [{ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: card.title, href: `#/k/${ch.chapter}/g/${card.id}` }],
    sheets: [sheet(ch, card)],
    signal,
  });
}

export function viewPrintChapter(ch, { signal } = {}) {
  return printPage({
    title: `Uitleg ${ch.title.toLowerCase()}`,
    intro: `Alle ${ch.grammar.length} uitlegkaarten van dit hoofdstuk, elk op een eigen A4. Kies bij het afdrukken A4, staand, zonder kop- en voetteksten van de browser.`,
    back: [{ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }],
    sheets: ch.grammar.map((card) => sheet(ch, card)),
    signal,
  });
}
