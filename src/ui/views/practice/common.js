// Gedeeld door de oefenvormen (herhaling, werkwoorden, flitskaarten, toets, snelle rondes).
import { h } from '../../dom.js';
import { course, practiceEntries } from '../../../app/content.js';
import { dueItems, reviewLeft, streak } from '../../../app/progress.js';

export const available = () => course.filter((c) => c.available);
export const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

/**
 * Toetsenbord-luisteraar voor één pagina. Met signal (van de router) verdwijnt hij bij weggaan;
 * zonder signal zodra de pagina niet meer in het document staat.
 */
export function onKeys(root, handler, signal) {
  if (signal) return document.addEventListener('keydown', handler, { signal });
  const listener = (e) => {
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', listener);
      return;
    }
    handler(e);
  };
  document.addEventListener('keydown', listener);
}

/** Herhaalvragen voor vandaag: wat klaarstaat, hooguit tot het dagdoel. */
export function dueCount() {
  return reviewLeft(dueItems(practiceEntries()).length);
}

export function streakText() {
  const s = streak();
  if (!s.days) return 'Oefen vandaag en begin een reeks.';
  const base = `${plural(s.days, 'dag', 'dagen')} op rij geoefend`;
  return s.today ? `${base}. Goed bezig!` : `${base}. Oefen vandaag om je reeks vast te houden.`;
}

/** Hoofdstukknoppen met nummer en naam, per niveau gegroepeerd. */
export function chapterChips(chapters, href, extra = () => null) {
  const groups = new Map();
  for (const c of chapters) {
    const key = c.level ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return h('div', { class: 'chip-groups' }, [...groups].map(([level, list]) =>
    h('div', { class: 'chip-group' },
      level ? h('span', { class: 'chip-group-label' }, level) : null,
      h('div', { class: 'chip-links' }, list.map((c) =>
        h('a', { class: 'chip-link named', href: href(c), 'aria-label': `${c.title}: ${c.theme.split(' · ')[0]}` },
          h('span', { class: 'chip-no', 'aria-hidden': 'true' }, String(c.chapter)),
          h('span', { 'aria-hidden': 'true' }, c.theme.split(' · ')[0]),
          extra(c)))))));
}
