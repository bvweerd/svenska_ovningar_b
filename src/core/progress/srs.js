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

/**
 * Volgende stand van een vraag: in één keer goed → doos hoger; anders terug naar doos 1 (morgen).
 * De allereerste keer in één keer goed: meteen doos 2 (over twee dagen). Wie de stof al kent, krijgt zo
 * minder herhaling; een fout zet de vraag altijd terug naar doos 1.
 */
export function nextSrs(prev, status, now = Date.now()) {
  if (status === 'free') return prev ?? null;
  const box = status === 'good' ? Math.min((prev?.box ?? 1) + 1, MAX_BOX) : 1;
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
  const out = [];
  for (const e of entries) {
    const rec = srs[itemKey(e.chapter.chapter, e.ex, e.idx)];
    if (rec && rec.h === answerHash(e.item) && rec.due <= date) out.push({ ...e, rec });
  }
  return out.sort((a, b) => (a.rec.due < b.rec.due ? -1 : a.rec.due > b.rec.due ? 1 : a.rec.box - b.rec.box));
}

/** Vragen die je al kent: in doos minBox of hoger (actueel antwoord). */
export function knownEntries(state, entries, minBox = 2) {
  const srs = state.srs ?? {};
  return entries.filter((e) => {
    const r = srs[itemKey(e.chapter.chapter, e.ex, e.idx)];
    return r && r.h === answerHash(e.item) && r.box >= minBox;
  });
}

/** Zoveel herhaalvragen per dag is het doel; wie wil, doet er meer. */
export const DAILY_GOAL = 20;

/**
 * Herhaalvragen die vandaag gemaakt zijn: afgeleid uit de antwoorden zelf (r: 1, zie recordItem). Zo is
 * er geen aparte teller die bij synchroniseren extra data kost, en tellen twee apparaten vanzelf samen.
 */
export function reviewedToday(state, now = Date.now()) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let n = 0;
  for (const r of Object.values(state.items ?? {})) if (r.r && r.at >= start) n++;
  return n;
}

/**
 * Zet vandaag bij de dagen met het dagdoel gehaald (goalDays, voor de prestaties), zodra er vandaag
 * DAILY_GOAL herhaalvragen gemaakt zijn. Ongewijzigde toestand als dat al zo is of nog niet gehaald.
 */
export function withGoalDay(state, now = Date.now()) {
  const t = today(0, now);
  const list = state.goalDays ?? [];
  if (list.includes(t) || reviewedToday(state, now) < DAILY_GOAL) return state;
  return { ...state, goalDays: [...list, t].slice(-400) };
}

/** Hoeveel herhaalvragen er vandaag nog op het dagdoel staan (hooguit wat er klaarstaat). */
export const reviewLeft = (state, dueCount, now = Date.now()) => Math.max(0, Math.min(dueCount, DAILY_GOAL - reviewedToday(state, now)));

/**
 * Kiest n vragen uit de herhaalvragen (al op volgorde: oudste eerst) met afwisseling: om en om uit
 * verschillende onderwerpen, zodat er niet tien vragen over hetzelfde achter elkaar komen.
 * topicOf(entry) → onderwerp.
 */
export function pickReview(due, n, topicOf) {
  const groups = new Map();
  for (const e of due) {
    const t = topicOf(e) ?? '';
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(e);
  }
  const queues = [...groups.values()];
  const out = [];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  }
  return out;
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
