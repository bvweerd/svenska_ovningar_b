// Instaptoets per hoofdstuk: wat je al kunt, hoef je niet helemaal te doorlopen (core/progress/placement.js).
import { h } from '../../dom.js';
import { practiceEntries, balancedSample } from '../../../app/content.js';
import { crumbs, exerciseRunner, findTopic, plural } from '../../shared.js';
import { shuffle } from '../../../core/content/build.js';
import { applyPlacement, PLACEMENT_SIZE } from '../../../app/progress.js';
import { trackEvent, scoreBucket } from '../../../platform/analytics.js';

export function viewPlacement(ch) {
  document.title = `Instaptoets · ${ch.title}`;
  // Liefst geen gegenereerde woordenschat: de toets gaat over de onderwerpen van het hoofdstuk.
  const pool = practiceEntries([ch]);
  const own = pool.filter((e) => !e.ex.generated);
  const picked = balancedSample(own.length >= PLACEMENT_SIZE ? own : pool, PLACEMENT_SIZE, shuffle);
  const results = [];
  const items = picked.map(({ item, ex, idx, chapter }) => ({
    item,
    label: ex.instruction.replace(/\*\*|\*/g, ''),
    ctx: { topic: ex.topic, fixedOrder: !!ex.fixedOrder, testMode: true, findTopic: (t) => findTopic(t, chapter) },
    entry: { ex, idx },
  }));
  const [list, score, summary] = exerciseRunner(items, {
    advanceAfterReveal: true,
    onItem: (entry, r) => results.push({ ...entry.entry, ok: r.firstTry }),
    onFinish: () => {
      const good = results.filter((r) => r.ok).length;
      const { passed, skipped } = applyPlacement(ch, results);
      trackEvent(`instaptoets/${ch.chapter}/klaar/${scoreBucket(good / Math.max(results.length, 1))}`, `Instaptoets ${ch.title}`);
      const names = passed.map((t) => findTopic(t, ch)?.card.title ?? (t === 'woordenschat' ? 'Woordenschat' : t));
      return [
        h('h2', {}, `${good} van ${results.length} goed`),
        h('p', {}, good
          ? `De ${plural(good, 'vraag', 'vragen')} die je goed had, komen pas over een paar dagen terug in de herhaling.`
          : 'Geen probleem: begin gewoon bij de eerste oefening.'),
        skipped.length
          ? [h('p', {}, `Deze onderwerpen ken je al: ${names.join(', ')}. ${plural(skipped.length, 'oefening telt', 'oefeningen tellen')} daarom als afgerond:`),
             h('ul', {}, skipped.map((e) => h('li', {}, h('a', { href: `#/k/${ch.chapter}/o/${e.id}` }, e.title))))]
          : null,
        h('p', { class: 'muted' }, 'De kan-doen-doelen vink je pas af als je de meeste vragen echt beheerst, ook in de herhaling.'),
        h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: `#/k/${ch.chapter}` }, 'Naar het hoofdstuk')),
      ];
    },
  });
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: 'Instaptoets' }),
    h('header', { class: 'page-head' },
      h('h1', {}, `Instaptoets: ${ch.title}`),
      h('p', { class: 'instruction' }, `Ken je dit hoofdstuk misschien al? ${items.length} vragen, één poging per vraag, zonder tips. Wat je goed hebt, komt minder vaak terug; ken je een onderwerp helemaal, dan tellen de oefeningen daarover als afgerond.`)),
    score, list, summary,
    h('p', { class: 'exercise-foot' }, h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, `← Terug naar ${ch.title.toLowerCase()}`)),
  );
}
