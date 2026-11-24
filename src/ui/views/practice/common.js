// Gedeeld door de oefenvormen (herhaling, werkwoorden, flitskaarten, toets, snelle rondes).
import { h } from '../../dom.js';
import { practiceEntries } from '../../../app/content.js';
import { plural } from '../../shared.js';
import { dueItems, reviewLeft, streak } from '../../../app/progress.js';

export { openChapters as available } from '../../../app/content.js';
export { plural };

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
