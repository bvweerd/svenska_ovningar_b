// Toetsen, snelle rondes, instellingen, „verder waar je was”, flitskaarten en dictee. Puur.
import { withDay } from './srs.js';

export function saveTest(state, ch, score, total, perTopic, now = Date.now()) {
  const prev = state.tests?.[ch];
  const ratio = total ? score / total : 0;
  const tests = { ...(state.tests ?? {}), [ch]: { best: Math.max(prev?.best ?? 0, ratio), last: ratio, perTopic, at: now } };
  return { ...state, tests, days: withDay(state.days, now) };
}

export const getTest = (state, ch) => state.tests?.[ch] ?? null;

/** Spelscore opslaan. → { state, record } (record: nieuw record?) */
export function saveGame(state, id, score, now = Date.now()) {
  const prev = state.games?.[id]?.best ?? 0;
  const games = { ...(state.games ?? {}), [id]: { best: Math.max(prev, score), last: score, at: now } };
  return { state: { ...state, games, days: withDay(state.days, now) }, record: score > prev };
}

export const getGame = (state, id) => state.games?.[id] ?? null;

export const getPref = (state, key, fallback) => state.prefs?.[key] ?? fallback;
export const setPref = (state, key, value) => ({ ...state, prefs: { ...(state.prefs ?? {}), [key]: value } });

export const setLast = (state, href, title, now = Date.now()) => ({ ...state, last: { href, title, at: now } });

/** Tijdstip bij een flitskaart- of dicteesleutel, zodat samenvoegen het nieuwste oordeel kiest. */
const stamp = (state, key, now) => ({ ...(state.t ?? {}), [key]: now });

const mixed = (a, rand) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
/** Eerst wat nieuw is, dan wat fout ging; pas als dat op is een herhaling van wat al goed was. */
function pickDue(keys, statusOf, size, bad, rand) {
  const fresh = keys.filter((k) => !statusOf(k));
  const wrong = keys.filter((k) => statusOf(k) === bad);
  const due = [...mixed(fresh, rand), ...mixed(wrong, rand)];
  return (due.length ? due : mixed(keys, rand)).slice(0, size);
}

const cardKey = (ch, dir, sv) => `${ch}/${dir}/${sv}`;

/** Oordeel bij een flitskaart: alleen de eerste beoordeling per stapel telt (zie de flitskaarten). */
export function rateCard(state, ch, dir, sv, known, now = Date.now()) {
  const k = cardKey(ch, dir, sv);
  return {
    ...state,
    cards: { ...(state.cards ?? {}), [k]: known ? 'known' : 'unknown' },
    t: stamp(state, `c/${k}`, now),
    days: withDay(state.days, now),
  };
}

/** Woorden (Zweeds) voor de volgende stapel flitskaarten. */
export function pickCards(state, ch, dir, words, size, rand = Math.random) {
  const cards = state.cards ?? {};
  return pickDue(words, (sv) => cards[cardKey(ch, dir, sv)], size, 'unknown', rand);
}

export function cardProgress(state, ch, dir, words) {
  const cards = state.cards ?? {};
  const st = words.map((sv) => cards[cardKey(ch, dir, sv)]);
  const known = st.filter((x) => x === 'known').length;
  const unknown = st.filter((x) => x === 'unknown').length;
  return { total: words.length, known, unknown, fresh: words.length - known - unknown };
}

export function recordDictation(state, say, good, now = Date.now()) {
  return {
    ...state,
    dictee: { ...(state.dictee ?? {}), [say]: good ? 'good' : 'wrong' },
    t: stamp(state, `d/${say}`, now),
    days: withDay(state.days, now),
  };
}

/** Zinnen of woorden voor een dictee: eerst nieuw, dan fout. */
export function pickDictation(state, says, size, rand = Math.random) {
  const d = state.dictee ?? {};
  return pickDue(says, (k) => d[k], size, 'wrong', rand);
}

export function dictationProgress(state, says) {
  const d = state.dictee ?? {};
  const st = says.map((k) => d[k]);
  return { total: says.length, seen: st.filter(Boolean).length, wrong: st.filter((x) => x === 'wrong').length };
}
