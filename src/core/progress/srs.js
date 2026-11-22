// Herhaling met intervallen (Leitner-dozen), oefendagen en de reeks. Puur.
import { answerHash, itemKey } from './schema.js';

/** Aantal dagen tot de volgende herhaling, per doos. */
export const INTERVALS = [0, 1, 2, 4, 7, 14, 30, 60];
const MAX_BOX = INTERVALS.length - 1;

/** Lokale datum als 'JJJJ-MM-DD'. */
export function today(offsetDays = 0, now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Volgende stand van een vraag: in één keer goed → doos hoger; anders terug naar doos 1 (morgen). */
export function nextSrs(prev, status, now = Date.now()) {
  if (status === 'free') return prev ?? null;
  const box = status === 'good' ? Math.min((prev?.box ?? 0) + 1, MAX_BOX) : 1;
  return { box, due: today(INTERVALS[box], now) };
}

/** Vandaag als oefendag erbij (de laatste 400 dagen). */
export function withDay(days, now = Date.now()) {
  const t = today(0, now);
  const list = days ?? [];
  return list[list.length - 1] === t ? list : [...list.filter((d) => d !== t), t].slice(-400);
}

/**
 * Vragen die vandaag (of eerder) herhaald moeten worden.
 * @param entries [{ chapter, ex, idx, item }]
 */
export function dueItems(state, entries, date = today()) {
  const srs = state.srs ?? {};
  return entries
    .map((e) => ({ ...e, rec: srs[itemKey(e.chapter.chapter, e.ex, e.idx)] }))
    .filter((e) => e.rec && e.rec.h === answerHash(e.item) && e.rec.due <= date)
    .sort((a, b) => (a.rec.due < b.rec.due ? -1 : a.rec.due > b.rec.due ? 1 : a.rec.box - b.rec.box));
}

/** Hoeveel vragen zitten in welke doos (alleen bekende, actuele vragen). */
export function srsStats(state, entries) {
  const srs = state.srs ?? {};
  const boxes = Array(INTERVALS.length).fill(0);
  for (const e of entries) {
    const r = srs[itemKey(e.chapter.chapter, e.ex, e.idx)];
    if (r && r.h === answerHash(e.item)) boxes[r.box]++;
  }
  return boxes;
}

/** Aantal dagen op rij geoefend (tot en met vandaag of gisteren). */
export function streak(state, now = Date.now()) {
  const days = new Set(state.days ?? []);
  let n = 0;
  let offset = days.has(today(0, now)) ? 0 : -1;
  while (days.has(today(offset, now))) {
    n++;
    offset--;
  }
  return { days: n, today: days.has(today(0, now)) };
}
