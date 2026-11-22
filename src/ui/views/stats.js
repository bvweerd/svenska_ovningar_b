// Jouw statistieken: hoe gaat het, vooral didactisch bekeken (dozen, beheersing, doelen, lastige onderwerpen).
import { h } from '../dom.js';
import { course, practiceEntries } from '../../app/content.js';
import { crumbs, progressBar, splitTheme, findTopic, plural } from '../shared.js';
import {
  chapterProgress, canDoStatus, getTest, srsStats, weakItems, streak, CANDO_BOX, DAILY_GOAL, reviewedToday,
  progressStore,
} from '../../app/progress.js';
import { badgeSummary } from './badges.js';

const BOX_TEXT = [
  null,
  'Net fout gegaan of nog onzeker: komt morgen terug.',
  'Eén keer goed: komt over twee dagen terug.',
  'Twee keer goed: dit begint te zitten.',
  'Beheerst: komt pas na een week terug.',
  'Stevig: twee weken.',
  'Heel stevig: een maand.',
  'Lange termijn: twee maanden.',
];

export function viewStats() {
  document.title = 'Jouw statistieken · Svenska övningar';
  const open = course.filter((c) => c.available);
  const state = progressStore.get();
  const items = Object.values(state.items ?? {});
  const graded = items.filter((r) => r.s !== 'free');
  const firstTry = graded.filter((r) => r.s === 'good').length;
  const entries = practiceEntries();
  const boxes = srsStats(entries);
  const inBoxes = boxes.reduce((a, b) => a + b, 0);
  const s = streak();
  const badges = badgeSummary();

  // Lastige onderwerpen: waar de meeste vragen nu fout staan (laatste poging).
  const weakByTopic = new Map();
  for (const ch of open) {
    for (const { ex, item } of weakItems(ch)) {
      const t = item.topic ?? ex.topic;
      if (!t || t === 'woordenschat') continue;
      const key = `${ch.chapter}/${t}`;
      weakByTopic.set(key, { ch, topic: t, n: (weakByTopic.get(key)?.n ?? 0) + 1 });
    }
  }
  const hardest = [...weakByTopic.values()].sort((a, b) => b.n - a.n).slice(0, 6);

  const tile = (value, label) => h('div', { class: 'stat-tile' }, h('strong', {}, value), h('span', {}, label));

  return h('div', { class: 'stats' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Statistieken' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Jouw statistieken'),
      h('p', { class: 'lead' }, 'Hoe het gaat, op basis van wat de app nakijkt. Alles staat alleen op dit apparaat (en op je andere apparaten als je synchroniseert).')),
    !graded.length
      ? h('p', {}, 'Nog niets te zien: maak eerst een paar oefeningen.')
      : [
          h('div', { class: 'stat-tiles' },
            tile(String(graded.length), 'vragen gemaakt'),
            tile(`${Math.round((firstTry / graded.length) * 100)}%`, 'in één keer goed (laatste poging)'),
            tile(String((state.days ?? []).length), plural((state.days ?? []).length, 'oefendag', 'oefendagen').replace(/^\d+ /, '')),
            tile(s.days ? `${s.days}` : '0', 'dagen op rij'),
            tile(`${reviewedToday()}/${DAILY_GOAL}`, 'herhaald vandaag'),
            tile(`${badges.earned}/${badges.total}`, 'prestaties')),

          inBoxes
            ? h('section', { class: 'block' },
                h('h2', {}, 'Je geheugen in dozen'),
                h('p', { class: 'muted' }, `Elke vraag die je gemaakt hebt, zit in een doos. In één keer goed: een doos hoger, en hij komt later terug. Fout: terug naar doos 1. Vanaf doos ${CANDO_BOX} telt een vraag mee voor de kan-doen-doelen.`),
                h('ul', { class: 'boxes' }, boxes.map((n, box) => (box === 0 ? null : h('li', {},
                  h('span', { class: 'box-label' }, `Doos ${box}`),
                  h('span', { class: 'bar' }, h('span', { style: `width:${Math.round((n / inBoxes) * 100)}%` })),
                  h('span', { class: 'box-n' }, `${n}`),
                  h('span', { class: 'box-text muted small' }, BOX_TEXT[box] ?? ''))))))
            : null,

          (() => {
            const started = open.filter((ch) => chapterProgress(ch).itemsDone);
            return h('section', { class: 'block' },
              h('h2', {}, 'Per hoofdstuk'),
              h('ul', { class: 'chapter-stats' }, started.map((ch) => {
                const p = chapterProgress(ch);
                const known = srsStats(practiceEntries([ch])).reduce((n, v, box) => n + (box >= CANDO_BOX ? v : 0), 0);
                const goals = canDoStatus(ch);
                const test = getTest(ch.chapter);
                return h('li', {},
                  h('a', { href: `#/k/${ch.chapter}` }, h('strong', {}, `${ch.chapter} · ${splitTheme(ch.theme).name}`)),
                  h('span', { class: 'stat-row' }, h('span', { class: 'muted small' }, 'Gemaakt'), progressBar(p.itemsDone, p.itemsTotal, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt`)),
                  h('span', { class: 'stat-row' }, h('span', { class: 'muted small' }, 'Beheerst'), progressBar(known, p.itemsTotal, `${known} van ${p.itemsTotal} vragen beheerst (doos ${CANDO_BOX} of hoger)`)),
                  h('span', { class: 'muted small' }, [
                    goals.length ? `Doelen ${goals.filter((g) => g.done).length} van ${goals.length}` : null,
                    test ? `toets ${Math.round(test.best * 100)}%` : 'nog geen toets',
                  ].filter(Boolean).join(' · ')));
              })),
              started.length < open.length
                ? h('p', { class: 'muted small' }, `${plural(open.length - started.length, 'hoofdstuk', 'hoofdstukken')} nog niet begonnen.`)
                : null);
          })(),

          hardest.length
            ? h('section', { class: 'block' },
                h('h2', {}, 'Wat nog lastig is'),
                h('p', { class: 'muted' }, 'Onderwerpen met de meeste vragen die je de laatste keer fout had of waarvan je het antwoord bekeek.'),
                h('ul', { class: 'hard-list' }, hardest.map(({ ch, topic, n }) => {
                  const found = findTopic(topic, ch);
                  return h('li', {},
                    found ? h('a', { href: found.href }, found.card.title) : h('span', {}, topic),
                    h('span', { class: 'muted' }, ` · ${ch.title} · ${plural(n, 'vraag', 'vragen')}`));
                })),
                h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#/herhalen' }, 'Oefen je fouten')))
            : null,
        ],
  );
}
