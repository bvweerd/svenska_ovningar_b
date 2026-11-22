// Toets per hoofdstuk.
import { h } from '../../dom.js';
import { practiceEntries, balancedSample } from '../../../app/content.js';
import { crumbs, exerciseRunner, findTopic } from '../../shared.js';
import { shuffle } from '../../../core/content/build.js';
import { saveTest, getTest } from '../../../app/progress.js';
import { trackEvent, scoreBucket } from '../../../platform/analytics.js';

export function viewTest(ch) {
  document.title = `Toets · ${ch.title}`;
  const pool = practiceEntries([ch]);
  const picked = balancedSample(pool, 20, shuffle);
  const results = [];
  const items = picked.map(({ item, ex, idx, chapter }) => ({
    item,
    ref: { ch: chapter.chapter, ex, idx, outside: true },
    topic: item.topic ?? ex.topic ?? 'woordenschat',
    label: ex.instruction.replace(/\*\*|\*/g, ''),
    ctx: { topic: ex.topic, fixedOrder: !!ex.fixedOrder, testMode: true, findTopic: (t) => findTopic(t, chapter) },
  }));
  const prev = getTest(ch.chapter);
  const [list, score, summary] = exerciseRunner(items, {
    advanceAfterReveal: true,
    onItem: (entry, r) => results.push({ topic: entry.topic, ok: r.firstTry }),
    onFinish: () => {
      const good = results.filter((r) => r.ok).length;
      const perTopic = {};
      for (const r of results) {
        perTopic[r.topic] = perTopic[r.topic] ?? { good: 0, total: 0 };
        perTopic[r.topic].total++;
        if (r.ok) perTopic[r.topic].good++;
      }
      saveTest(ch.chapter, good, results.length, perTopic);
      trackEvent(`toets/${ch.chapter}/klaar/${scoreBucket(good / Math.max(results.length, 1))}`, `Toets ${ch.title}`);
      const rows = Object.entries(perTopic)
        .map(([topic, s]) => ({ topic, ...s, ratio: s.good / s.total, found: findTopic(topic, ch) }))
        .sort((a, b) => a.ratio - b.ratio);
      const pct = Math.round((good / Math.max(results.length, 1)) * 100);
      return [
        h('h2', {}, `Je score: ${good} van ${results.length} (${pct}%)`),
        h('p', {}, pct >= 80 ? 'Uitstekend! Dit hoofdstuk zit er goed in.' : pct >= 55 ? 'Voldoende. Kijk hieronder welke onderwerpen nog aandacht nodig hebben.' : 'Nog even oefenen. Begin bij de onderwerpen bovenaan de lijst.'),
        prev ? h('p', { class: 'muted' }, `Je vorige beste score was ${Math.round(prev.best * 100)}%.`) : null,
        h('div', { class: 'table-wrap' }, h('table', { class: 'report' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Onderwerp'), h('th', {}, 'Goed'), h('th', {}, ''))),
          h('tbody', {}, rows.map((r) => h('tr', { class: r.ratio < 0.6 ? 'weak' : '' },
            h('td', {}, r.found ? r.found.card.title : r.topic === 'woordenschat' ? 'Woordenschat' : r.topic),
            h('td', {}, `${r.good} / ${r.total}`),
            h('td', {}, r.found ? h('a', { href: r.found.href }, 'Uitleg') : null)))))),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/toets?${Date.now()}` }, 'Nieuwe toets'),
          h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk')),
      ];
    },
  });
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: 'Toets' }),
    h('header', { class: 'page-head' },
      h('h1', {}, `Toets: ${ch.title}`),
      h('p', { class: 'instruction' }, `${items.length} willekeurige vragen. Je hebt één poging per vraag en krijgt geen tips. Aan het eind zie je per onderwerp hoe het ging.`)),
    score, list, summary,
  );
}
