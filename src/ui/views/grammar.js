// Grammatica: overzicht en één uitlegkaart.
import { h } from '../dom.js';
import { markdown, inline } from '../md.js';
import { course } from '../../app/content.js';
import { crumbs } from '../shared.js';

export function viewGrammarIndex() {
  document.title = 'Grammatica · Svenska övningar';
  const chapters = course.filter((c) => c.available && c.grammar.length);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Grammatica' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Grammatica'),
      h('p', { class: 'lead' }, 'Alle uitleg op een rij, per hoofdstuk.')),
    chapters.map((ch) =>
      h('section', { class: 'block' },
        h('h2', {}, h('a', { href: `#/k/${ch.chapter}`, class: 'plain' }, ch.title), h('span', { class: 'h2-sub' }, ch.theme)),
        h('p', { class: 'small' }, h('a', { href: `#/k/${ch.chapter}/print` }, '🖨 Alle uitleg van dit hoofdstuk afdrukken (A4)')),
        h('ul', { class: 'cards' }, ch.grammar.map((g) =>
          h('li', {}, h('a', { class: 'card', href: `#/k/${ch.chapter}/g/${g.id}` }, h('strong', {}, g.title), h('span', { html: inline(g.summary) }))))),
      ),
    ),
  );
}

export function viewGrammar(ch, card) {
  document.title = `${card.title} · ${ch.title}`;
  const related = ch.exercises.filter((e) => e.topic === card.id || e.items.some((i) => i.topic === card.id));
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: card.title }),
    h('article', { class: 'grammar' },
      h('p', { class: 'eyebrow' }, 'Grammatica'),
      h('h1', {}, card.title),
      h('p', { class: 'summary-rule', html: inline(card.summary) }),
      h('div', { class: 'prose', html: markdown(card.body) }),
      h('div', { class: 'actions' },
        h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/g/${card.id}/print` }, '🖨 Afdrukken als A4')),
    ),
    related.length
      ? h('section', { class: 'block' }, h('h2', {}, 'Oefen dit'),
          h('ul', { class: 'exercise-list' }, related.map((e) => h('li', {}, h('a', { href: `#/k/${ch.chapter}/o/${e.id}` }, h('span', { class: 'ex-title' }, e.title))))))
      : null,
  );
}
