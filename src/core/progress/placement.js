// Instaptoets (plaatsingstoets) per hoofdstuk: wie de stof al kent, hoeft niet alles te doorlopen. Puur.
//
// - Een goed beantwoorde vraag gaat meteen naar doos PLACED_BOX (komt pas over een paar dagen terug).
// - Een onderwerp met minstens MIN_PER_TOPIC vragen in de toets, allemaal goed: de oefeningen over dat
//   onderwerp tellen als afgerond („overgeslagen”, placed: 1). Ze blijven gewoon te maken.
// - Kan-doen-vinkjes komen niet vanzelf: daarvoor moet nog steeds CANDO_SHARE van alle vragen beheerst zijn.
import { answerHash, exKey, itemKey } from './schema.js';
import { INTERVALS, today, withDay } from './srs.js';

export const PLACED_BOX = 3;
export const PLACEMENT_SIZE = 15;
const MIN_PER_TOPIC = 2;

const topicOf = (ex, item) => item.topic ?? ex.topic ?? 'woordenschat';

/**
 * @param results [{ ex, idx, ok }] de vragen uit de toets en of ze in één keer goed waren
 * → { state, passed: [topic], skipped: [ex] }
 */
export function applyPlacement(state, ch, results, now = Date.now()) {
  const items = { ...state.items };
  const srs = { ...(state.srs ?? {}) };
  const perTopic = new Map();
  for (const { ex, idx, ok } of results) {
    const item = ex.items[idx];
    const t = topicOf(ex, item);
    const p = perTopic.get(t) ?? { good: 0, total: 0 };
    p.total++;
    if (ok) p.good++;
    perTopic.set(t, p);
    if (!ok) continue;
    const key = itemKey(ch.chapter, ex, idx);
    const h = answerHash(item);
    items[key] = { s: 'good', at: now, h, x: 1 };
    srs[key] = { box: Math.max(srs[key]?.h === h ? srs[key].box : 0, PLACED_BOX), due: today(INTERVALS[PLACED_BOX], now), h };
  }
  const passed = [...perTopic].filter(([, p]) => p.total >= MIN_PER_TOPIC && p.good === p.total).map(([t]) => t);
  const set = new Set(passed);
  const ex = { ...state.ex };
  const skipped = ch.exercises.filter((e) => e.topic && set.has(e.topic) && !ex[exKey(ch.chapter, e.id)]?.completedAt);
  for (const e of skipped) ex[exKey(ch.chapter, e.id)] = { best: ex[exKey(ch.chapter, e.id)]?.best ?? 0, completedAt: now, at: now, placed: 1 };
  return { state: { ...state, items, srs, ex, days: withDay(state.days, now) }, passed, skipped };
}
