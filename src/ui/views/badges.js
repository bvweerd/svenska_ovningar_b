// Prestaties: behaalde badges en wat je nog kunt halen.
import { h } from '../dom.js';
import { toast } from '../components/toast.js';
import { crumbs, progressBar } from '../shared.js';
import { badges } from '../../app/rewards.js';
import { badgeIconSvg } from '../components/badge-icon.js';

const date = (t) => new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

function badgeCard(b) {
  return h('li', { class: `badge-card${b.earned ? ' earned' : ''}` },
    h('span', { class: 'badge-icon', 'aria-hidden': 'true', html: badgeIconSvg(b) }),
    h('span', { class: 'badge-body' },
      h('strong', {}, b.title, b.earned ? h('span', { class: 'sr-only' }, ' (behaald)') : null),
      h('span', { class: 'badge-text' }, b.text),
      b.earned
        ? h('span', { class: 'badge-meta' }, b.at ? `Behaald op ${date(b.at)}` : 'Behaald')
        : b.done
          ? [progressBar(b.done, b.goal, `${b.done} van ${b.goal}`), h('span', { class: 'badge-meta' }, `${b.done} van ${b.goal}`)]
          : null));
}

/** Aantal behaalde badges, voor links naar deze pagina. */
export function badgeSummary() {
  const list = badges();
  return { earned: list.filter((b) => b.earned).length, total: list.length };
}

// Indeling van de pagina: per strand (lezen en luisteren, zeggen en schrijven, herhalen, vlot) en de rest.
const SECTIONS = [
  { title: 'Oefeningen en hoofdstukken', groups: ['oefening', 'hoofdstuk', 'alles', 'doelen', 'toets', 'foutloos'] },
  { title: 'Lezen en luisteren', groups: ['lezen', 'luisteren', 'dictee'] },
  { title: 'Zeggen en schrijven', groups: ['zeggen', 'schrijven', 'taak'] },
  { title: 'Herhalen en onthouden', groups: ['beheerst', 'hoofdstukbeheerst', 'dagdoel', 'dagen'] },
  { title: 'Vlot', groups: ['snel', 'vlot', 'en-ett'] },
];

export function viewBadges() {
  document.title = 'Prestaties · Svenska övningar';
  const list = badges();
  const earned = list.filter((b) => b.earned);
  // Per groep de behaalde en alleen de eerstvolgende die nog niet behaald is: geen muur van grijze badges.
  const shown = [];
  const seen = new Set();
  for (const b of list) {
    if (b.earned) shown.push(b);
    else if (!seen.has(b.group)) {
      seen.add(b.group);
      shown.push(b);
    }
  }
  const placed = new Set(SECTIONS.flatMap((x) => x.groups));
  const sections = [...SECTIONS, { title: 'Overig', groups: [...new Set(list.map((b) => b.group))].filter((g) => !placed.has(g)) }]
    .map(({ title, groups }) => {
      // Behaald eerst, daarna wat je nog kunt halen; binnen elk deel in de volgorde van de groepen.
      const mine = shown.filter((b) => groups.includes(b.group));
      const order = (b) => (b.earned ? 0 : 1000) + groups.indexOf(b.group);
      return { title, cards: mine.sort((x, y) => order(x) - order(y)) };
    })
    .filter((x) => x.cards.length);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Voortgang', href: '#/voortgang' }, { label: 'Prestaties' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Prestaties'),
      h('p', { class: 'lead' }, `Je hebt ${earned.length} van de ${list.length} prestaties behaald.`),
      h('p', { class: 'muted' }, 'Prestaties komen vanzelf: de app houdt bij wat je goed doet. Ze gaan vooral over wat je beheerst en over alle kanten van de taal: lezen, luisteren, zeggen, schrijven en herhalen. Een gemiste dag kost je niets.')),
    sections.map(({ title, cards }) => h('section', { class: 'block' }, h('h2', {}, title), h('ul', { class: 'badge-grid' }, cards.map(badgeCard)))),
  );
}

/** Melding bij nieuwe badges. */
export function announceBadges(fresh) {
  for (const b of fresh) {
    toast([h('span', { class: 'toast-icon', 'aria-hidden': 'true', html: badgeIconSvg(b) }),
      h('span', {}, h('strong', {}, `Nieuwe prestatie: ${b.title}`), h('br'), h('a', { href: '#/prestaties' }, 'Bekijk je prestaties'))]);
  }
}
