// Onderdelen van een hoofdstukpagina die ook elders gebruikt worden.
import { h } from '../dom.js';
import { getResult, runState, canDoStatus, openItems } from '../../app/progress.js';
import { claimCanDo, exerciseDone } from '../../app/course-progress.js';

/** Eigen kleur per hoofdstuk (een tint op de kleurencirkel), voor een streep op kaart en kop. */
export const chapterHue = (ch) => `--ch-hue:${(ch.chapter * 137) % 360}`;

/** Wat je na dit hoofdstuk kunt; de app vinkt het zelf af (zie canDoStatus in progress.js). */
export function canDoList(ch) {
  claimCanDo(ch);
  const st = canDoStatus(ch);
  if (!st.length) return null;
  return h('section', { class: 'cando', 'aria-labelledby': 'cando-title' },
    h('h2', { id: 'cando-title' }, 'Dit kun je na dit hoofdstuk'),
    h('ul', {}, st.map((x) => {
      const pct = (n) => (x.total ? Math.round((n / x.total) * 100) : 0);
      const label = `${x.seen} van ${x.total} vragen gemaakt, ${x.known} beheerst`;
      return h('li', { class: x.done ? 'done' : '' },
        h('span', { class: 'cando-mark', 'aria-hidden': 'true' }, x.done ? '✓' : ''),
        h('span', { class: 'cando-body' },
          h('span', { class: 'cando-text' }, x.text, x.done ? h('span', { class: 'sr-only' }, ' (behaald)') : null),
          // Twee tinten: licht = gemaakt, donker = beheerst. Zo is er al voortgang te zien vóór het vinkje.
          !x.done && x.seen
            ? h('span', { class: 'cando-bar', role: 'img', 'aria-label': label, title: label },
                h('span', { class: 'seen', style: `width:${pct(x.seen)}%` }),
                h('span', { class: 'known', style: `width:${pct(x.known)}%` }))
            : null));
    })),
    h('p', { class: 'muted small' },
      st.some((x) => !x.done && x.seen) ? [h('span', { class: 'cando-key seen', 'aria-hidden': 'true' }), ' gemaakt · ', h('span', { class: 'cando-key known', 'aria-hidden': 'true' }), ' beheerst. '] : null,
      'Het vinkje komt vanzelf: als je de meeste vragen hierover een paar keer achter elkaar in één keer goed hebt, ook in de dagelijkse herhaling.'));
}

export function exerciseBadge(ch, ex) {
  const run = runState(ch.chapter, ex);
  const res = getResult(ch.chapter, ex.id);
  const inProgress = run.started && run.done.size > 0 && run.done.size < run.total;
  if (inProgress) return h('span', { class: 'badge mid', title: 'Bezig' }, `${run.done.size}/${run.total}`);
  // Afgerond, maar met vragen die nog niet meetellen (later toegevoegd, gewijzigd, of woorden die nog niet aan de beurt waren).
  const open = res?.completedAt || exerciseDone(ch, ex) ? openItems(ch.chapter, ex).length : 0;
  if (open) {
    const words = ex.roundSize && ex.items.length > ex.roundSize;
    return h('span', { class: 'badge mid', title: words ? `${open} woorden nog niet gehad` : `${open} ${open === 1 ? 'vraag' : 'vragen'} nieuw of nog niet gemaakt` },
      words ? `${open} te gaan` : `${open} nieuw`);
  }
  if (res?.completedAt) return h('span', { class: `badge ${res.best >= 0.8 ? 'good' : 'mid'}`, title: 'Beste score' }, `${Math.round(res.best * 100)}%`);
  return null;
}

/** Een in- en uitklapbaar onderdeel van een hoofdstukpagina. */
export function foldSection(title, open, meta, ...content) {
  return h('details', { class: 'block fold', open },
    h('summary', {}, h('h2', {}, title), meta ? h('span', { class: 'fold-meta' }, meta) : null),
    ...content);
}
