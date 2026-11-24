// Wat er in een hoofdstuk af is en waar je verder gaat (hoofdstuk, oefening, start).
import { course, openChapters } from './content.js';
import { trackEvent } from '../platform/analytics.js';
import { newCanDo, openItems, progressStore, weakItems, getLast, runState } from './progress.js';
import * as rec from '../core/progress/record.js';

/** Openstaande fouten uit alle open hoofdstukken (zonder vragen bij een leestekst). */
export const openMistakes = () => openChapters().flatMap((c) =>
  weakItems(c).filter(({ ex }) => !ex.text).map((w) => ({ ...w, chapter: c })));

/**
 * „Verder waar je gebleven was”: de laatst geopende pagina, maar wijst die naar een oefening die al af is
 * (en niet halverwege), dan de eerstvolgende die nog niet af is. → { href, title } of null
 */
export function continueTarget() {
  const last = getLast();
  const m = /^#\/k\/(\d+)\/o\/([^?]+)/.exec(last?.href ?? '');
  if (!m) return last;
  const ch = course.find((c) => c.chapter === Number(m[1]) && c.available);
  const ex = ch?.exercises.find((e) => e.id === m[2]);
  if (!ex) return last;
  const run = runState(ch.chapter, ex);
  const busy = run.started && run.done.size > 0 && run.done.size < run.total;
  if (busy || !exerciseDone(ch, ex)) return last;
  const to = onwardFrom(ch, ex);
  if (to.ex) return { href: `#/k/${ch.chapter}/o/${to.ex.id}`, title: `${ch.title} · ${to.ex.title}` };
  if (to.chapter) return { href: `#/k/${to.chapter.chapter}`, title: to.chapter.title };
  return { href: `#/k/${ch.chapter}`, title: ch.title };
}

/** Is een oefening af? (zie core/progress/record.js) */
export const exerciseDone = (ch, ex) => rec.exerciseDone(progressStore.get(), ch, ex);
export const chapterDone = (c) => rec.chapterDone(progressStore.get(), c);

/** Waar na deze oefening heen: de eerstvolgende die nog niet af is (daarna vooraan in het hoofdstuk verder zoeken). */
export function onwardFrom(ch, ex) {
  const pos = ch.exercises.indexOf(ex);
  const after = ch.exercises.slice(pos + 1).find((e) => !exerciseDone(ch, e));
  if (after) return { ex: after, label: `Volgende: ${after.title}` };
  const before = ch.exercises.slice(0, pos).find((e) => !exerciseDone(ch, e));
  if (before) return { ex: before, label: `Nog niet gedaan: ${before.title}` };
  // Alles afgerond: dan de oefeningen met vragen die nog openstaan.
  const open = [...ch.exercises.slice(pos + 1), ...ch.exercises.slice(0, pos)].find((e) => openItems(ch.chapter, e).length);
  if (open) return { ex: open, label: `Nog open: ${open.title}` };
  // Hoofdstuk af: het eerstvolgende hoofdstuk dat nog niet af is (daarna een eerder hoofdstuk).
  const open2 = course.filter((c) => c.available && c !== ch && !chapterDone(c));
  return { chapter: open2.find((c) => c.chapter > ch.chapter) ?? open2[0] ?? null };
}

/** Behaalde kan-doen-uitspraken die nog niet gemeld waren: tellen (één keer) en teruggeven. */
export function claimCanDo(ch) {
  const fresh = newCanDo(ch);
  for (const f of fresh) trackEvent(`kandoen/${ch.chapter}/${f.nr}/behaald`, `H${ch.chapter} · ${f.text}`);
  return fresh;
}
