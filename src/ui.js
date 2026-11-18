// Gedeelde onderdelen voor alle pagina's.
import { h } from './dom.js';
import { course } from './content.js';
import { itemCard } from './render/item-card.js';
import { recordItem } from './progress.js';
import { trackEvent, itemSummary, STATUS_LABEL } from './analytics.js';

export const chapterByNo = (n) => course.find((c) => c.chapter === Number(n));

export function findTopic(topic, preferChapter) {
  const order = [preferChapter, ...course.filter((c) => c !== preferChapter)].filter(Boolean);
  for (const ch of order) {
    const card = ch.grammar?.find((g) => g.id === topic);
    if (card) return { card, href: `#/k/${ch.chapter}/g/${card.id}`, chapter: ch };
  }
  return null;
}

export function crumbs(...parts) {
  return h('nav', { class: 'crumbs', 'aria-label': 'Kruimelpad' },
    parts.map((p, i) => [i ? h('span', { class: 'sep', 'aria-hidden': 'true' }, '›') : null, p.href ? h('a', { href: p.href }, p.label) : h('span', {}, p.label)]),
  );
}

export function progressBar(done, total, label) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return h('span', { class: 'progress', title: label },
    h('span', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label },
      h('span', { style: `width:${pct}%` })),
    h('span', { class: 'pct' }, `${pct}%`));
}

export const statusOf = (r) => (r.neutral ? 'free' : r.revealed ? 'revealed' : r.firstTry ? 'good' : 'wrong');

// ---------- Oefenronde ----------
/**
 * @param items  [{ item, ctx, label?, ref?: { ch, ex, idx } }]
 * @param opts   { onFinish(good, total), offset?: { done, good, total } }
 */
export function exerciseRunner(items, { onFinish, offset = { done: 0, good: 0, total: 0 }, onItem, advanceAfterReveal = false }) {
  let done = offset.done;
  let good = offset.good;
  const all = offset.total || items.length;
  const score = h('div', { class: 'score', 'aria-live': 'polite' });
  const summary = h('div', { class: 'summary', hidden: true });
  const updateScore = () => {
    score.replaceChildren(h('span', {}, `${done} van ${all} beantwoord · ${good} in één keer goed`));
  };
  updateScore();
  const cards = [];
  let finished = 0;
  const list = h('div', { class: 'items' },
    items.map(({ item, ctx, label, ref }, i) => {
      const card = itemCard(item, ctx, offset.done + i + 1, (r) => {
        if (ref) {
          const status = statusOf(r);
          recordItem(ref.ch, ref.ex, ref.idx, status);
          trackEvent(`vraag/${ref.ch}/${ref.ex.id}/${ref.idx + 1}/${STATUS_LABEL[status]}`, `H${ref.ch} · ${ref.ex.title} · ${itemSummary(item)}`);
        }
        onItem?.(items[i], r);
        done++;
        finished++;
        if (r.firstTry && !r.neutral) good++;
        updateScore();
        if (finished === items.length) {
          summary.hidden = false;
          summary.replaceChildren(...onFinish(good, done).filter(Boolean));
          setTimeout(() => {
            summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
            summary.querySelector('.btn.primary')?.focus({ preventScroll: true });
          }, r.revealed ? 1200 : 700);
          return;
        }
        // Na een goed antwoord automatisch door naar de volgende open vraag.
        if (r.revealed && !advanceAfterReveal) return;
        const next = cards.slice(i + 1).find((c) => !c.isFinished()) ?? cards.find((c) => !c.isFinished());
        if (next) setTimeout(() => next.focusFirst(), r.revealed ? 1500 : 700);
      }, label);
      cards.push(card);
      return card;
    }),
  );
  // Bij openen: cursor in de eerste vraag zonder te scrollen (niet op touchscreens, i.v.m. het toetsenbord).
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => cards[0]?.focusFirst({ scroll: false }), 50);
  return [list, score, summary];
}

/**
 * Oefenronde met losse vragen uit één of meer hoofdstukken (mix, fouten).
 * entries: [{ item, ex, idx, chapter }]
 */
export function practiceView(ch, { title, instruction, entries, again, empty }) {
  const trail = ch
    ? [{ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: title }]
    : [{ label: 'Start', href: '#/' }, { label: title }];
  const back = ch ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk') : h('a', { class: 'btn ghost', href: '#/' }, 'Naar de start');
  if (!entries.length) {
    return h('div', {},
      crumbs(...trail),
      h('header', { class: 'page-head' }, h('h1', {}, title), h('p', { class: 'instruction' }, empty)),
      back);
  }
  const items = entries.map(({ item, ex, idx, chapter }) => {
    const owner = chapter ?? ch;
    return {
      item,
      ref: { ch: owner.chapter, ex, idx },
      label: `${ch ? '' : `${owner.title} · `}${ex.instruction.replace(/\*\*|\*/g, '')}`,
      ctx: { topic: ex.topic, findTopic: (t) => findTopic(t, owner) },
    };
  });
  const [list, score, summary] = exerciseRunner(items, {
    onFinish: (good, total) => [
      h('h2', {}, `Klaar! ${good} van ${total} in één keer goed.`),
      h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: again }, 'Nog een ronde'), back),
    ],
  });
  return h('div', {},
    crumbs(...trail),
    h('header', { class: 'page-head' }, h('h1', {}, ch ? `${title}: ${ch.title}` : title), h('p', { class: 'instruction' }, instruction)),
    score, list, summary,
  );
}

