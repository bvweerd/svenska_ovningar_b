// Kan-doen-uitspraken: afgeleid uit de herhaaldozen; de leerling beoordeelt niets zelf. Puur.
import { answerHash, itemKey, itemRecord, gradable } from './schema.js';

/** Vanaf deze doos telt een vraag als beheerst (drie keer achter elkaar in één keer goed). */
export const CANDO_BOX = 3;
/** Zoveel van de vragen over de onderwerpen van een uitspraak moeten beheerst zijn voor een vinkje. */
export const CANDO_SHARE = 0.8;

/** Het onderwerp van een vraag: eigen topic, anders dat van de oefening. */
const topicOf = (ex, item) => item.topic ?? ex.topic;

/** Alle nakijkbare vragen van een hoofdstuk over deze onderwerpen. */
export function canDoItems(ch, topics) {
  const set = new Set(topics);
  return ch.exercises.flatMap((ex) => gradable(ex).filter(({ it }) => set.has(topicOf(ex, it))).map(({ it, idx }) => ({ ex, item: it, idx })));
}

/**
 * Stand van de kan-doen-uitspraken van een hoofdstuk. Een uitspraak is behaald als CANDO_SHARE van
 * zijn vragen in doos CANDO_BOX of hoger staat. → [{ text, total, seen, known, share, done }]
 */
export function canDoStatus(state, ch) {
  const srs = state.srs ?? {};
  return (ch.canDo ?? []).map(({ text, topics }) => {
    const list = canDoItems(ch, topics);
    // seen: minstens één keer gemaakt (goed of fout); known: beheerst (doos CANDO_BOX of hoger).
    const seen = list.filter(({ ex, idx }) => itemRecord(state, ch.chapter, ex, idx)).length;
    const known = list.filter(({ ex, item, idx }) => {
      const r = srs[itemKey(ch.chapter, ex, idx)];
      return r && r.h === answerHash(item) && r.box >= CANDO_BOX;
    }).length;
    const share = list.length ? known / list.length : 0;
    return { text, total: list.length, seen, known, share, done: list.length > 0 && share >= CANDO_SHARE };
  });
}

/**
 * Uitspraken die nu behaald zijn maar nog niet eerder gemeld; die worden in de nieuwe toestand als
 * gemeld onthouden. → { state, fresh: [{ nr, text }] } (nr vanaf 1)
 */
export function newCanDo(state, ch) {
  const seen = new Set(state.prefs?.canDoSeen ?? []);
  const fresh = canDoStatus(state, ch)
    .map((s, i) => ({ ...s, nr: i + 1 }))
    .filter((s) => s.done && !seen.has(`${ch.chapter}/${s.nr}`));
  const next = fresh.length
    ? { ...state, prefs: { ...(state.prefs ?? {}), canDoSeen: [...seen, ...fresh.map((s) => `${ch.chapter}/${s.nr}`)] } }
    : state;
  return { state: next, fresh: fresh.map(({ nr, text }) => ({ nr, text })) };
}
