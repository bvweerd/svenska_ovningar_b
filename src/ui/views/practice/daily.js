// Dagelijkse herhaling.
import { h } from '../../dom.js';
import { practiceEntries } from '../../../app/content.js';
import { crumbs, practiceView } from '../../shared.js';
import { dueItems, srsStats, INTERVALS } from '../../../app/progress.js';
import { plural } from './common.js';

export function viewDaily() {
  document.title = 'Dagelijkse herhaling · Svenska övningar';
  const entries = practiceEntries();
  const due = dueItems(entries);
  if (!due.length) {
    const boxes = srsStats(entries);
    const total = boxes.reduce((a, b) => a + b, 0);
    const when = (box) => (INTERVALS[box] === 1 ? 'morgen' : `over ${INTERVALS[box]} dagen`);
    return h('div', {},
      crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dagelijkse herhaling' }),
      h('header', { class: 'page-head' },
        h('h1', {}, 'Dagelijkse herhaling'),
        h('p', { class: 'instruction' }, total
          ? 'Voor vandaag ben je klaar! Morgen staan er weer vragen voor je klaar.'
          : 'Hier komen de vragen terug die je in de oefeningen hebt gemaakt. Maak eerst een paar oefeningen.')),
      total
        ? h('section', { class: 'block' },
            h('h2', {}, 'Hoe goed ken je de stof?'),
            h('p', { class: 'muted' }, 'Elke vraag zit in een doos. Heb je hem in één keer goed, dan gaat hij een doos hoger en komt hij later pas terug. Fout? Dan komt hij morgen weer.'),
            h('ul', { class: 'boxes' }, boxes.map((n, box) => (box === 0 || !n ? null : h('li', {},
              h('span', { class: 'box-label' }, `Doos ${box}`),
              h('span', { class: 'bar' }, h('span', { style: `width:${Math.round((n / total) * 100)}%` })),
              h('span', { class: 'box-n' }, `${n} · terug ${when(box)}`))))))
        : h('a', { class: 'btn primary', href: '#/' }, 'Naar de hoofdstukken'),
    );
  }
  return practiceView(null, {
    title: 'Dagelijkse herhaling',
    instruction: `${plural(due.length, 'vraag staat', 'vragen staan')} klaar. Heb je een vraag in één keer goed, dan komt hij pas later terug.`,
    entries: due.slice(0, 20),
    again: `#/oefenen/herhaling?${Date.now()}`,
    empty: '',
    left: {
      count: () => dueItems(practiceEntries()).length,
      more: (n) => `Er ${n === 1 ? 'staat' : 'staan'} vandaag nog ${plural(n, 'vraag', 'vragen')} klaar.`,
      done: 'Voor vandaag ben je klaar! Wat je fout had, komt morgen terug.',
    },
  });
}
