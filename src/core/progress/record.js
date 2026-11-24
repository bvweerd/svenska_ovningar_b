// Een antwoord vastleggen, rondes van een oefening en de voortgang per hoofdstuk. Puur: elke functie
// die iets verandert, krijgt de toestand en geeft een nieuwe terug.
import { isGradable } from '../items/index.js';
import { shuffle } from '../content/build.js';
import { answerHash, exKey, itemId, itemKey, itemRecord, gradable } from './schema.js';
import { nextSrs, withDay, withGoalDay } from './srs.js';

/**
 * @param opts.outside  true als de vraag buiten de oefening zelf gemaakt is (toets, mix, herhaling)
 * @param opts.review   true als de vraag in de dagelijkse herhaling gemaakt is (r: 1, telt voor het dagdoel)
 * @param opts.share    bij een vraag met meer vakjes of stappen die niet in één keer goed was: het deel dat bij de
 *                      eerste poging goed was (0–1), ook als een stap bekeken is. Telt naar rato mee in de score (p).
 */
export function recordItem(state, ch, ex, idx, status, { outside = false, review = false, share, now = Date.now() } = {}) {
  const key = itemKey(ch, ex, idx);
  const h = answerHash(ex.items[idx]);
  const srs = state.srs ?? {};
  const prev = srs[key]?.h === h ? srs[key] : null;
  const next = nextSrs(prev, status, now);
  const out = {
    ...state,
    items: { ...state.items, [key]: { s: status, at: now, h, ...(outside ? { x: 1 } : {}), ...(review ? { r: 1 } : {}), ...((status === 'wrong' || status === 'revealed') && share > 0 ? { p: Math.round(share * 100) / 100 } : {}) } },
    srs: next ? { ...srs, [key]: { ...next, h } } : srs,
    days: withDay(state.days, now),
  };
  return review ? withGoalDay(out, now) : out;
}

/** De vraagnummers (idx) van de lopende ronde: alle vragen, of de gekozen deelverzameling (pick). */
function roundIndices(ex, rec) {
  const all = ex.items.map((_, idx) => idx);
  if (!rec?.pick) return all;
  const ids = new Set(rec.pick.map(String));
  return all.filter((idx) => ids.has(String(itemId(ex, idx))));
}

/** Punten voor één vraag: 1 als hij in één keer goed was, anders het deel dat de eerste keer goed was. */
const points = (r) => (r?.s === 'good' ? 1 : r?.p ?? 0);

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
  return { started: !!start, done, total: indices.length, inRound: (idx) => inRound.has(idx), points: (idx) => (done.has(idx) ? points(itemRecord(state, ch, ex, idx)) : 0) };
}

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
  const due = [...shuffle(groups[0], rand), ...shuffle(groups[1], rand)];
  return (due.length ? due : shuffle(groups[2], rand)).slice(0, size).sort((a, b) => a - b);
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

/** Een lange oefening die in rondes gaat (woordenlijst met roundSize). */
export const isRoundBased = (ex) => !!ex.roundSize && ex.items.length > ex.roundSize;

/**
 * Zorgt dat er een lopende ronde is en geeft die terug. Een nieuwe ronde begint als er nog geen is, als
 * de vorige af is, of bij restart. Welke vragen: bij een lange oefening een ronde (pickRound); bij een
 * al afgeronde oefening met nieuwe of gewijzigde vragen alleen die; anders alles.
 * → { state, run, partial }
 */
export function prepareRun(state, ch, ex, { restart = false, rand = Math.random, now = Date.now() } = {}) {
  let run = runState(state, ch, ex);
  const partial = isRoundBased(ex);
  if (restart || !run.started || run.done.size >= run.total) {
    const openOnly = !partial && !restart && getResult(state, ch, ex.id)?.completedAt ? openItems(state, ch, ex) : [];
    state = startRun(state, ch, ex, partial ? pickRound(state, ch, ex, ex.roundSize, rand) : openOnly.length ? openOnly : null, now);
    run = runState(state, ch, ex);
  }
  return { state, run, partial };
}

/** Sluit een ronde af. → { state, score, total, firstTry } (score van deze ronde, met deelpunten; firstTry: vragen in één keer goed) */
export function completeRun(state, ch, ex, now = Date.now()) {
  const run = runState(state, ch, ex);
  const items = gradable(ex).filter(({ idx }) => run.inRound(idx));
  // Score met deelpunten voor vragen met meer vakjes; op twee decimalen.
  const score = Math.round(items.reduce((n, { idx }) => n + run.points(idx), 0) * 100) / 100;
  const total = items.length;
  const firstTry = items.filter(({ idx }) => run.done.get(idx) === 'good').length;
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
    const whole = all.length ? records.reduce((n, r) => n + points(r), 0) / all.length : 1;
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
  return { state: { ...state, ex: { ...state.ex, [k]: rec } }, score, total, firstTry };
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

/**
 * Is een oefening af? Afgerond, of bij een lange oefening in rondes (woordenschat): na één ronde.
 * Die oefen je verder in rondes en in de herhaling, zonder eerst de hele lijst af te maken.
 */
export function exerciseDone(state, ch, ex) {
  if (getResult(state, ch.chapter, ex.id)?.completedAt) return true;
  return isRoundBased(ex) && roundProgress(state, ch.chapter, ex).seen >= ex.roundSize;
}

/** Alle oefeningen van een (open) hoofdstuk af? */
export const chapterDone = (state, c) => c.available && c.exercises?.length > 0 && c.exercises.every((e) => exerciseDone(state, c, e));

/** Heeft deze gebruiker al iets gemaakt (een vraag, flitskaart of dictee)? */
export function hasProgress(state) {
  return Object.keys(state.items ?? {}).length > 0 || Object.keys(state.cards ?? {}).length > 0 || Object.keys(state.dictee ?? {}).length > 0;
}
