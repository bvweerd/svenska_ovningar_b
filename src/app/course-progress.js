// Wat er in een hoofdstuk af is en waar je verder gaat (hoofdstuk, oefening, start).
import { course } from './content.js';
import { trackEvent } from '../platform/analytics.js';
import { newCanDo, openItems, progressStore } from './progress.js';
import * as rec from '../core/progress/record.js';

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
  return { chapter: course.find((c) => c.chapter > ch.chapter && c.available) ?? null };
}

/** Behaalde kan-doen-uitspraken die nog niet gemeld waren: tellen (één keer) en teruggeven. */
export function claimCanDo(ch) {
  const fresh = newCanDo(ch);
  for (const f of fresh) trackEvent(`kandoen/${ch.chapter}/${f.nr}/behaald`, `H${ch.chapter} · ${f.text}`);
  return fresh;
}
