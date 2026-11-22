// Prestaties: behaalde badges en wat je nog kunt halen.
import { h } from '../dom.js';
import { toast } from '../components/toast.js';
import { crumbs, progressBar } from '../shared.js';
import { badges } from '../../app/rewards.js';

const date = (t) => new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

function badgeCard(b) {
  return h('li', { class: `badge-card${b.earned ? ' earned' : ''}` },
    h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, b.icon),
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

export function viewBadges() {
  document.title = 'Prestaties · Svenska övningar';
  const list = badges();
  const earned = list.filter((b) => b.earned);
  // Per groep alleen de eerstvolgende die nog niet behaald is: geen muur van grijze badges.
  const next = [];
  const seen = new Set();
  for (const b of list) {
    if (b.earned || seen.has(b.group)) continue;
    seen.add(b.group);
    next.push(b);
  }
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Prestaties' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Prestaties'),
      h('p', { class: 'lead' }, `Je hebt ${earned.length} van de ${list.length} prestaties behaald.`),
      h('p', { class: 'muted' }, 'Prestaties komen vanzelf: de app houdt bij wat je goed doet. Ze gaan vooral over wat je beheerst, niet over hoe vaak je klikt. Een gemiste dag kost je niets.')),
    earned.length
      ? h('section', { class: 'block' }, h('h2', {}, 'Behaald'), h('ul', { class: 'badge-grid' }, earned.map(badgeCard)))
      : null,
    next.length
      ? h('section', { class: 'block' }, h('h2', {}, 'Volgende'), h('ul', { class: 'badge-grid' }, next.map(badgeCard)))
      : null,
  );
}

/** Melding bij nieuwe badges. */
export function announceBadges(fresh) {
  for (const b of fresh) {
    toast([h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, b.icon),
      h('span', {}, h('strong', {}, `Nieuwe prestatie: ${b.title}`), h('br'), h('a', { href: '#/prestaties' }, 'Bekijk je prestaties'))]);
  }
}
