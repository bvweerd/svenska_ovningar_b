// Hoofdstukpagina.
import { h } from '../dom.js';
import { inline } from '../md.js';
import { typeName } from '../../core/items/index.js';
import { crumbs, progressBar, splitTheme, plural } from '../shared.js';
import { getResult, chapterProgress, runState, weakItems, openItems } from '../../app/progress.js';
import { exerciseDone } from '../../app/course-progress.js';
import { chapterHue, canDoList, foldSection, exerciseBadge } from '../components/chapter.js';

export function viewChapter(ch) {
  document.title = `${ch.title} · Svenska övningar`;
  const p = chapterProgress(ch);
  const weak = weakItems(ch);
  const { name, topics } = splitTheme(ch.theme);
  // Waar ga je verder? De oefening die bezig is, anders de eerste die nog niet af is. Een lange
  // oefening in rondes (woordenschat) telt na één ronde als gedaan: die oefen je verder in rondes en
  // in de herhaling, zonder dat de leerling eerst de hele lijst moet afmaken.
  const next = ch.exercises.find((ex) => { const r = runState(ch.chapter, ex); return r.started && r.done.size > 0 && r.done.size < r.total; })
    ?? ch.exercises.find((ex) => !exerciseDone(ch, ex))
    ?? ch.exercises.find((ex) => openItems(ch.chapter, ex).length);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title }),
    h('header', { class: 'page-head chapter-head', style: chapterHue(ch) },
      h('p', { class: 'eyebrow' }, ch.title),
      h('h1', {}, name),
      topics ? h('p', { class: 'lead' }, topics) : null,
      ch.goal || ch.writing
        ? h('ul', { class: 'goals' },
            ch.goal ? h('li', {}, h('strong', {}, 'Doel: '), ch.goal) : null,
            ch.writing ? h('li', {}, h('strong', {}, 'Schrijven: '), ch.writing) : null)
        : null,
      p.itemsDone
        ? h('div', { class: 'chapter-progress' },
            progressBar(p.itemsDone, p.itemsTotal, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt`),
            h('span', { class: 'muted' }, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt · ${p.completed} van ${p.exercises} oefeningen afgerond`))
        : null,
      h('div', { class: 'actions chapter-actions' },
        next ? h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/o/${next.id}` }, p.itemsDone ? `Verder: ${next.title}` : `Begin: ${next.title}`) : null,
        weak.length ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/fouten` }, `Oefen je fouten (${weak.length})`) : null,
        h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/mix` }, 'Mix'),
        h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/toets` }, 'Toets'),
        ch.vocab?.length ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/kaarten` }, 'Flitskaarten') : null),
    ),
    canDoList(ch),
    // Onderdelen zijn in- en uitklapbaar, zodat de pagina op een telefoon niet eindeloos lang is.
    // Open staat het onderdeel waar je verder gaat; bij een nieuw hoofdstuk ook de uitleg.
    ch.grammar.length
      ? foldSection('Grammatica', !p.itemsDone, plural(ch.grammar.length, 'onderwerp', 'onderwerpen'),
          h('ul', { class: 'cards' }, ch.grammar.map((g) =>
            h('li', {}, h('a', { class: 'card', href: `#/k/${ch.chapter}/g/${g.id}` }, h('strong', {}, g.title), h('span', { html: inline(g.summary) }))))))
      : null,
    ch.sections.map((s, i) => {
      const done = s.exercises.filter((ex) => getResult(ch.chapter, ex.id)?.completedAt).length;
      const open = next ? s.exercises.includes(next) : i === 0;
      // Alles afgerond maar nog vragen open (nieuw, gewijzigd, of woorden die nog niet aan de beurt waren): geen vinkje.
      const left = done === s.exercises.length ? s.exercises.reduce((n, ex) => n + openItems(ch.chapter, ex).length, 0) : 0;
      return foldSection(s.title, open,
        done === s.exercises.length
          ? (left ? `${plural(done, 'oefening', 'oefeningen')} afgerond · ${plural(left, 'vraag', 'vragen')} open` : `✓ ${plural(done, 'oefening', 'oefeningen')} afgerond`)
          : `${done} van ${s.exercises.length} afgerond`,
        s.intro ? h('p', { class: 'muted' }, s.intro) : null,
        h('ol', { class: 'exercise-list' }, s.exercises.map((ex) => {
          const types = [...new Set(ex.items.flatMap((i) => (i.type === 'steps' ? i.steps.map((s) => s.type) : [i.type])))];
          return h('li', {},
            h('a', { href: `#/k/${ch.chapter}/o/${ex.id}` },
              h('span', { class: 'ex-title' }, ex.title),
              h('span', { class: 'ex-meta' }, `${plural(ex.items.length, 'vraag', 'vragen')}${ex.roundSize && ex.items.length > ex.roundSize ? `, ${ex.roundSize} per ronde` : ''} · ${types.map(typeName).join(', ')}`),
              exerciseBadge(ch, ex),
            ));
        })));
    }),
  );
}
