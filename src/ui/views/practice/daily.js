// Dagelijkse herhaling: een dagdoel van DAILY_GOAL vragen, met afwisseling tussen onderwerpen.
// Wie het dagdoel heeft gehaald en meer wil, kan doorgaan.
import { h } from '../../dom.js';
import { practiceEntries } from '../../../app/content.js';
import { crumbs, practiceView } from '../../shared.js';
import { dueItems, srsStats, INTERVALS, DAILY_GOAL, pickReview, reviewLeft } from '../../../app/progress.js';
import { plural } from './common.js';

const topicOf = (e) => e.item.topic ?? e.ex.topic ?? e.ex.id;
const ROUND = 10;

function boxesBlock(entries) {
  const boxes = srsStats(entries);
  const total = boxes.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const when = (box) => (INTERVALS[box] === 1 ? 'morgen' : `over ${INTERVALS[box]} dagen`);
  return h('section', { class: 'block' },
    h('h2', {}, 'Hoe goed ken je de stof?'),
    h('p', { class: 'muted' }, 'Elke vraag zit in een doos. Heb je hem in één keer goed, dan gaat hij een doos hoger en komt hij later pas terug. Fout? Dan komt hij morgen weer.'),
    h('ul', { class: 'boxes' }, boxes.map((n, box) => (box === 0 || !n ? null : h('li', {},
      h('span', { class: 'box-label' }, `Doos ${box}`),
      h('span', { class: 'bar' }, h('span', { style: `width:${Math.round((n / total) * 100)}%` })),
      h('span', { class: 'box-n' }, `${n} · terug ${when(box)}`))))));
}

export function viewDaily({ query } = {}) {
  document.title = 'Dagelijkse herhaling · Svenska övningar';
  const entries = practiceEntries();
  const due = dueItems(entries);
  const extra = query?.has('meer');
  const goalLeft = reviewLeft(due.length);
  const trail = crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dagelijkse herhaling' });
  if (!due.length || (!goalLeft && !extra)) {
    const total = srsStats(entries).reduce((a, b) => a + b, 0);
    return h('div', {},
      trail,
      h('header', { class: 'page-head' },
        h('h1', {}, 'Dagelijkse herhaling'),
        h('p', { class: 'instruction' }, !total
          ? 'Hier komen de vragen terug die je in de oefeningen hebt gemaakt. Maak eerst een paar oefeningen.'
          : due.length
            ? `Je dagdoel van ${DAILY_GOAL} vragen is gehaald. Knap!`
            : 'Voor vandaag ben je klaar! Morgen staan er weer vragen voor je klaar.'),
        due.length && total
          ? h('div', { class: 'actions' },
              h('a', { class: 'btn ghost', href: '#/oefenen/herhaling?meer' }, `Toch nog meer doen (${plural(due.length, 'vraag', 'vragen')} klaar)`))
          : null),
      boxesBlock(entries) ?? h('a', { class: 'btn primary', href: '#/' }, 'Naar de hoofdstukken'),
    );
  }
  const size = extra ? ROUND : Math.min(ROUND, goalLeft);
  return practiceView(null, {
    title: 'Dagelijkse herhaling',
    instruction: extra
      ? `Extra herhaling: je dagdoel is al gehaald. Er ${due.length === 1 ? 'staat' : 'staan'} nog ${plural(due.length, 'vraag', 'vragen')} klaar.`
      : `Voor vandaag: ${plural(goalLeft, 'vraag', 'vragen')}. Heb je een vraag in één keer goed, dan komt hij pas later terug.`,
    entries: pickReview(due, size, topicOf),
    again: `#/oefenen/herhaling?${extra ? 'meer&' : ''}${Date.now()}`,
    empty: '',
    review: true,
    left: {
      count: () => (extra ? dueItems(practiceEntries()).length : reviewLeft(dueItems(practiceEntries()).length)),
      more: (n) => (extra ? `Er ${n === 1 ? 'staat' : 'staan'} nog ${plural(n, 'vraag', 'vragen')} klaar.` : `Nog ${plural(n, 'vraag', 'vragen')} op je dagdoel.`),
      done: extra ? 'Alles herhaald wat klaarstond. Knap!' : `Dagdoel gehaald: ${DAILY_GOAL} vragen herhaald. Wat je fout had, komt morgen terug.`,
    },
    after: () => (!extra && dueItems(practiceEntries()).length
      ? h('p', {}, h('a', { href: '#/oefenen/herhaling?meer' }, 'Zin in meer? Ga door met extra herhaling.'))
      : null),
  });
}
