// Gedeelde onderdelen voor alle pagina's.
import { h } from './dom.js';
import { course } from './content.js';
import { itemCard } from './render/item-card.js';
import { recordItem, getPref, setPref } from './progress.js';

/** Na een goed antwoord vanzelf naar de volgende vraag (instelling op de pagina Over, per apparaat). */
export const autoNext = () => getPref('autoNext', true) !== false;
export const setAutoNext = (on) => setPref('autoNext', !!on);
import { trackEvent, itemSummary, STATUS_LABEL } from './analytics.js';
import { spokenText } from './render/speak.js';

export const chapterByNo = (n) => course.find((c) => c.chapter === Number(n));

/** Voert go uit na ms, tenzij de gebruiker intussen tikt, scrolt of typt. */
function afterPause(go, ms) {
  const events = ['pointerdown', 'touchmove', 'wheel', 'keydown'];
  const stop = () => events.forEach((e) => removeEventListener(e, cancel, true));
  const cancel = () => {
    clearTimeout(timer);
    stop();
  };
  const timer = setTimeout(() => {
    stop();
    go();
  }, ms);
  events.forEach((e) => addEventListener(e, cancel, { capture: true, passive: true }));
}

export function findTopic(topic, preferChapter) {
  const order = [preferChapter, ...course.filter((c) => c !== preferChapter)].filter(Boolean);
  for (const ch of order) {
    const card = ch.grammar?.find((g) => g.id === topic);
    if (card) return { card, href: `#/k/${ch.chapter}/g/${card.id}`, chapter: ch };
  }
  return null;
}

/** "Werk en solliciteren · lijdende vorm …" → { name: 'Werk en solliciteren', topics: 'lijdende vorm …' } */
export function splitTheme(theme = '') {
  const [name, ...rest] = String(theme).split(' · ');
  return { name, topics: rest.join(' · ') };
}

export const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

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

/** Boodschap bij de eindscore: kort en eerlijk, met een volgende stap. */
export function scoreMessage(good, total) {
  if (!total) return 'Knap gedaan.';
  const r = good / total;
  if (r === 1) return 'Alles in één keer goed. Knap gedaan!';
  if (r >= 0.8) return 'Knap gedaan. Kijk nog even naar wat niet meteen goed ging.';
  if (r >= 0.5) return 'Goed bezig. De vragen hieronder komen terug bij „Oefen je fouten” en in de dagelijkse herhaling.';
  return 'Dit is nog lastig. Lees de uitleg nog eens en doe de oefening daarna opnieuw.';
}

/** Lijstje met de goede antwoorden van de vragen die niet in één keer goed waren. */
export function missedList(missed) {
  if (!missed?.length) return null;
  return h('div', { class: 'missed' },
    h('h3', {}, missed.length === 1 ? 'Deze ging nog niet meteen goed' : 'Deze gingen nog niet meteen goed'),
    h('ul', {}, missed.slice(0, 8).map((item) => {
      const say = spokenText(item);
      return h('li', { lang: say ? 'sv' : null }, say ?? itemSummary(item));
    })));
}

export const statusOf = (r) => (r.neutral ? 'free' : r.revealed ? 'revealed' : r.firstTry ? 'good' : 'wrong');

// ---------- Oefenronde ----------
/**
 * @param items  [{ item, ctx, label?, ref?: { ch, ex, idx, outside? } }]
 * @param opts   { onFinish(good, total), offset?: { done, good, total } }
 */
export function exerciseRunner(items, { onFinish, offset = { done: 0, good: 0, total: 0 }, onItem, advanceAfterReveal = false }) {
  let done = offset.done;
  let good = offset.good;
  const missed = []; // vragen uit deze ronde die niet in één keer goed waren
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
      const card = itemCard(item, ref ? { ...ctx, ref } : ctx, offset.done + i + 1, (r) => {
        if (ref) {
          const status = statusOf(r);
          recordItem(ref.ch, ref.ex, ref.idx, status, { outside: !!ref.outside });
          // De vaste vraag-id (spaties → -), zodat tellingen bij een vraag blijven als de volgorde verandert.
          const qid = String(ref.ex.items[ref.idx]?.id ?? ref.idx + 1).replace(/\s+/g, '-');
          trackEvent(`vraag/${ref.ch}/${ref.ex.id}/${qid}/${STATUS_LABEL[status]}`, `H${ref.ch} · ${ref.ex.title} · ${itemSummary(item)}`);
        }
        onItem?.(items[i], r);
        done++;
        finished++;
        if (r.firstTry && !r.neutral) good++;
        else if (!r.neutral) missed.push(item);
        updateScore();
        // Vanzelf door naar de volgende vraag. Op een telefoon iets later, en niet als je intussen
        // tikt of scrolt (dan zou de pagina onder je vinger wegschuiven); de knop blijft als uitweg.
        // Staat „vanzelf verder” uit (pagina Over), dan alleen de knop.
        const touch = matchMedia('(pointer: coarse)').matches;
        const auto = autoNext();
        const advance = (label, go, ms) => {
          if (!auto) return void card.offerNext(label, () => go({ tapped: true }));
          if (!touch) return void setTimeout(go, ms);
          card.offerNext(label, () => go({ tapped: true }));
          afterPause(go, ms + 600);
        };
        if (finished === items.length) {
          summary.hidden = false;
          summary.replaceChildren(...onFinish(good, done, missed).filter(Boolean));
          const toSummary = () => {
            summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
            summary.querySelector('.btn.primary')?.focus({ preventScroll: true });
          };
          advance('Naar de uitslag ↓', toSummary, r.revealed ? 1200 : 700);
          return;
        }
        // Na een goed antwoord door naar de volgende open vraag.
        if (r.revealed && !advanceAfterReveal) return;
        const next = cards.slice(i + 1).find((c) => !c.isFinished()) ?? cards.find((c) => !c.isFinished());
        if (!next) return;
        // Getypt op een telefoon: de cursor meteen in het volgende tekstveld, nog tijdens de tik of Enter,
        // zodat het toetsenbord open blijft (iOS opent het alleen vanuit een tik). Daarna schuift de pagina mee.
        if (touch && auto && r.typed && !r.revealed && next.takeKeyboard()) {
          setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 700);
          return;
        }
        advance('Volgende vraag ↓', ({ tapped = false } = {}) => next.focusFirst({ keyboard: tapped }), r.revealed ? 1500 : 700);
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
export function practiceView(ch, { title, instruction, entries, again, empty, left }) {
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
      ref: { ch: owner.chapter, ex, idx, outside: true },
      label: `${ch ? '' : `${owner.title} · `}${ex.instruction.replace(/\*\*|\*/g, '')}`,
      ctx: { topic: ex.topic, fixedOrder: !!ex.fixedOrder, findTopic: (t) => findTopic(t, owner) },
    };
  });
  const [list, score, summary] = exerciseRunner(items, {
    onFinish: (good, total, missed) => {
      const heading = [h('h2', {}, `Klaar! ${good} van ${total} in één keer goed.`), progressBar(good, total, `${good} van ${total} in één keer goed`), missedList(missed)];
      // left: hoeveel er na deze ronde nog openstaat (fouten, herhaalvragen); 0 = alles klaar.
      const n = left ? left.count() : null;
      if (n === 0) {
        back.className = 'btn primary';
        return [...heading, h('p', {}, left.done), h('div', { class: 'actions' }, back)];
      }
      return [
        ...heading,
        n ? h('p', {}, left.more(n)) : null,
        h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: again }, 'Nog een ronde'), back),
      ];
    },
  });
  return h('div', {},
    crumbs(...trail),
    h('header', { class: 'page-head' }, h('h1', {}, ch ? `${title}: ${ch.title}` : title), h('p', { class: 'instruction' }, instruction)),
    score, list, summary,
  );
}

