// Een antwoord vastleggen, rondes van een oefening en de voortgang per hoofdstuk. Puur: elke functie
// die iets verandert, krijgt de toestand en geeft een nieuwe terug.
import { isGradable } from '../items/index.js';
import { answerHash, exKey, itemId, itemKey, itemRecord, gradable } from './schema.js';
import { nextSrs, withDay } from './srs.js';

/** @param opts { outside: true } als de vraag buiten de oefening zelf gemaakt is (toets, mix, herhaling). */
export function recordItem(state, ch, ex, idx, status, { outside = false, now = Date.now() } = {}) {
  const key = itemKey(ch, ex, idx);
  const h = answerHash(ex.items[idx]);
  const srs = state.srs ?? {};
  const prev = srs[key]?.h === h ? srs[key] : null;
  const next = nextSrs(prev, status, now);
  return {
    ...state,
    items: { ...state.items, [key]: { s: status, at: now, h, ...(outside ? { x: 1 } : {}) } },
    srs: next ? { ...srs, [key]: { ...next, h } } : srs,
    days: withDay(state.days, now),
  };
}

/** De vraagnummers (idx) van de lopende ronde: alle vragen, of de gekozen deelverzameling (pick). */
function roundIndices(ex, rec) {
  const all = ex.items.map((_, idx) => idx);
  if (!rec?.pick) return all;
  const ids = new Set(rec.pick.map(String));
  return all.filter((idx) => ids.has(String(itemId(ex, idx))));
}

/** Welke vragen zijn in de lopende ronde al gedaan? inRound(idx): hoort deze vraag bij de ronde? */
export function runState(state, ch, ex) {
  const rec = state.ex[exKey(ch, ex.id)];
  const start = rec?.runStart;
  const indices = roundIndices(ex, rec);
  const inRound = new Set(indices);
  const done = new Map();
  if (start) {
    indices.forEach((idx) => {
      const r = itemRecord(state, ch, ex, idx);
      if (r && r.at >= start && !r.x) done.set(idx, r.s);
    });
  }
  return { started: !!start, done, total: indices.length, inRound: (idx) => inRound.has(idx) };
}

const mix = (a, rand) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Kiest de vragen voor een ronde van een lange oefening: eerst vragen die je nog nooit gemaakt
 * hebt, dan vragen die fout gingen of waarvan je het antwoord bekeek, dan de rest.
 * Binnen een groep willekeurig. Geeft vraagnummers (idx) terug, in de volgorde van de oefening.
 */
export function pickRound(state, ch, ex, size, rand = Math.random) {
  const groups = [[], [], []];
  ex.items.forEach((item, idx) => {
    if (!isGradable(item)) return;
    const r = itemRecord(state, ch, ex, idx);
    groups[!r ? 0 : r.s === 'wrong' || r.s === 'revealed' ? 1 : 2].push(idx);
  });
  // Alleen wat nieuw is of fout ging, ook als dat minder is dan een hele ronde. Pas als alles goed
  // is, wordt het een herhaalronde met vragen die je al kende.
  const due = [...mix(groups[0], rand), ...mix(groups[1], rand)];
  return (due.length ? due : mix(groups[2], rand)).slice(0, size).sort((a, b) => a - b);
}

/** Voortgang over een hele lange oefening (alle rondes): gehad, nog nieuw, laatst fout of bekeken. */
export function roundProgress(state, ch, ex) {
  const all = gradable(ex);
  let seen = 0;
  let wrong = 0;
  for (const { idx } of all) {
    const r = itemRecord(state, ch, ex, idx);
    if (!r) continue;
    seen += 1;
    if (r.s === 'wrong' || r.s === 'revealed') wrong += 1;
  }
  return { total: all.length, seen, fresh: all.length - seen, wrong };
}

/**
 * Vragen van een oefening die (nog) niet meetellen: nooit gemaakt (bijv. later toegevoegd, of bij een
 * woordenlijst nog niet aan de beurt geweest), of gemaakt toen het goede antwoord nog anders was.
 * Geeft vraagnummers (idx) terug. Dit zijn precies de vragen die in chapterProgress ontbreken.
 */
export function openItems(state, ch, ex) {
  return ex.items.map((_, idx) => idx).filter((idx) => !itemRecord(state, ch, ex, idx));
}

/** Start een nieuwe ronde; pick (vraagnummers) beperkt de ronde tot die vragen. */
export function startRun(state, ch, ex, pick = null, now = Date.now()) {
  const k = exKey(ch, ex.id);
  const { pick: _old, ...rest } = state.ex[k] ?? { best: 0 };
  const rec = { ...rest, runStart: now, at: now, ...(pick ? { pick: pick.map((idx) => itemId(ex, idx)) } : {}) };
  return { ...state, ex: { ...state.ex, [k]: rec } };
}

/** Sluit een ronde af. → { state, score, total } (score van deze ronde) */
export function completeRun(state, ch, ex, now = Date.now()) {
  const { done, inRound } = runState(state, ch, ex);
  const items = gradable(ex).filter(({ idx }) => inRound(idx));
  const score = items.filter(({ idx }) => done.get(idx) === 'good').length;
  const total = items.length;
  const k = exKey(ch, ex.id);
  const prev = state.ex[k] ?? { best: 0 };
  let rec;
  if (!prev.pick) {
    const ratio = total ? score / total : 1;
    rec = { best: Math.max(prev.best ?? 0, ratio), score, total, completedAt: now, at: now };
  } else {
    // Ronde van een lange oefening: pas afgerond als elke vraag een keer gemaakt is. De beste
    // score geldt dan voor de hele oefening (laatste poging per vraag), niet voor deze ronde.
    const all = gradable(ex);
    const records = all.map(({ idx }) => itemRecord(state, ch, ex, idx));
    const complete = records.every(Boolean);
    const whole = all.length ? records.filter((r) => r?.s === 'good').length / all.length : 1;
    const { pick: _round, runStart: _start, ...rest } = prev;
    rec = {
      ...rest,
      score,
      total,
      best: complete ? Math.max(prev.best ?? 0, whole) : prev.best ?? 0,
      at: now,
      ...(complete ? { completedAt: now } : {}),
    };
  }
  return { state: { ...state, ex: { ...state.ex, [k]: rec } }, score, total };
}

export const getResult = (state, ch, exId) => state.ex[exKey(ch, exId)] ?? null;

/** Voortgang van een hoofdstuk: afgeronde oefeningen en beantwoorde vragen. */
export function chapterProgress(state, chapter) {
  const exercises = chapter.exercises ?? [];
  let itemsDone = 0;
  let itemsTotal = 0;
  let completed = 0;
  for (const ex of exercises) {
    if (state.ex[exKey(chapter.chapter, ex.id)]?.completedAt) completed++;
    ex.items.forEach((_, idx) => {
      itemsTotal++;
      if (itemRecord(state, chapter.chapter, ex, idx)) itemsDone++;
    });
  }
  return { completed, exercises: exercises.length, itemsDone, itemsTotal };
}

/** Vragen die fout gingen of waarvan het antwoord bekeken is (laatste poging). */
export function weakItems(state, chapter) {
  const out = [];
  for (const ex of chapter.exercises ?? []) {
    ex.items.forEach((item, idx) => {
      const r = itemRecord(state, chapter.chapter, ex, idx);
      if (r && (r.s === 'wrong' || r.s === 'revealed')) out.push({ ex, idx, item });
    });
  }
  return out;
}

/** Heeft deze gebruiker al iets gemaakt (een vraag, flitskaart of dictee)? */
export function hasProgress(state) {
  return Object.keys(state.items ?? {}).length > 0 || Object.keys(state.cards ?? {}).length > 0 || Object.keys(state.dictee ?? {}).length > 0;
}
