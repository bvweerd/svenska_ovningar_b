// Onderdelen van een hoofdstukpagina die ook elders gebruikt worden.
import { h } from '../dom.js';
import { getResult, runState, canDoStatus, openItems, roundProgress, isRoundBased } from '../../app/progress.js';
import { claimCanDo, exerciseDone } from '../../app/course-progress.js';

/** Eigen kleur per hoofdstuk (een tint op de kleurencirkel), voor een streep op kaart en kop. */
/** Vinkje als SVG: staat altijd precies in het midden van het rondje (een ✓-teken verschuift per lettertype). */
const CHECK = '<svg viewBox="0 0 16 16" width="0.8em" height="0.8em"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const chapterHue = (ch) => `--ch-hue:${(ch.chapter * 137) % 360}`;

/** Wat je na dit hoofdstuk kunt; de app vinkt het zelf af (zie canDoStatus in core/progress/cando.js). */
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
        h('span', { class: 'cando-mark', 'aria-hidden': 'true', html: x.done ? CHECK : '' }),
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
  // Lange woordenlijst in rondes: net als bij andere oefeningen een percentage, hier van de woorden
  // die je (de laatste keer) goed had.
  if (isRoundBased(ex)) {
    const p = roundProgress(ch.chapter, ex);
    if (!p.seen) return null;
    const good = p.seen - p.wrong;
    const pct = Math.round((good / p.total) * 100);
    return h('span', { class: `badge ${pct >= 80 ? 'good' : 'mid'}`, title: `${good} van ${p.total} woorden goed${p.fresh ? `, ${p.fresh} nog niet gehad` : ''}` }, `${pct}%`);
  }
  if (res?.placed) return h('span', { class: 'badge good', title: 'Overgeslagen na de instaptoets' }, '✓ instap');
  // Afgerond, maar met vragen die nog niet meetellen (later toegevoegd of gewijzigd).
  const open = res?.completedAt || exerciseDone(ch, ex) ? openItems(ch.chapter, ex).length : 0;
  if (open) return h('span', { class: 'badge mid', title: `${open} ${open === 1 ? 'vraag' : 'vragen'} nieuw of nog niet gemaakt` }, `${open} nieuw`);
  if (res?.completedAt) return h('span', { class: `badge ${res.best >= 0.8 ? 'good' : 'mid'}`, title: 'Beste score' }, `${Math.round(res.best * 100)}%`);
  return null;
}

/** Een in- en uitklapbaar onderdeel van een hoofdstukpagina. */
export function foldSection(title, open, meta, ...content) {
  return h('details', { class: 'block fold', open },
    h('summary', {}, h('h2', {}, title), meta ? h('span', { class: 'fold-meta' }, meta) : null),
    ...content);
}
