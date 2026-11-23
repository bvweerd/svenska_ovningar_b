// De voortgang voor de rest van de app: dezelfde functies als altijd, nu als dunne laag over de
// store (app/store.js) en de pure functies in core/progress/. Een functie die iets verandert, roept
// store.update aan; wie wil weten dat er iets veranderd is, gebruikt progressStore.subscribe.
import { STORAGE_PREFIX } from '../config.js';
import * as storage from '../platform/storage.js';
import { hashItem } from '../core/hash.js';
import { createStore } from './store.js';
import * as schema from '../core/progress/schema.js';
import * as srs from '../core/progress/srs.js';
import * as rec from '../core/progress/record.js';
import * as cando from '../core/progress/cando.js';
import * as extras from '../core/progress/extras.js';
import { mergeStates } from '../core/progress/merge.js';

export const KEY = `${STORAGE_PREFIX}:progress:v2`;
export const progressStore = createStore({ storage, key: KEY, oldKey: `${STORAGE_PREFIX}:progress:v1` });
const load = () => progressStore.get();
const update = (fn, reason) => progressStore.update(fn, reason);

export { hashItem, mergeStates };
export const { answerHash, parseProgress } = schema;
export const { INTERVALS, DAILY_GOAL, today, nextSrs, pickReview } = srs;
export const { CANDO_BOX, CANDO_SHARE, canDoItems } = cando;

// ---------- Vragen en rondes ----------
/** @param opts { outside: true } als de vraag buiten de oefening zelf gemaakt is (toets, mix, herhaling). */
export const recordItem = (ch, ex, idx, status, opts) => void update((s) => rec.recordItem(s, ch, ex, idx, status, opts));
export const runState = (ch, ex) => rec.runState(load(), ch, ex);
export const pickRound = (ch, ex, size, rand) => rec.pickRound(load(), ch, ex, size, rand);
export const roundProgress = (ch, ex) => rec.roundProgress(load(), ch, ex);
export const openItems = (ch, ex) => rec.openItems(load(), ch, ex);
export const startRun = (ch, ex, pick = null) => void update((s) => rec.startRun(s, ch, ex, pick));
/** Lopende ronde van een oefening (begint zo nodig een nieuwe). → { run, partial } */
export function prepareRun(ch, ex, opts) {
  const before = load();
  const out = rec.prepareRun(before, ch, ex, opts);
  if (out.state !== before) progressStore.set(out.state);
  return { run: out.run, partial: out.partial };
}
export const { isRoundBased } = rec;
export function completeRun(ch, ex) {
  const out = rec.completeRun(load(), ch, ex);
  progressStore.set(out.state);
  return { score: out.score, total: out.total, firstTry: out.firstTry };
}
export const getResult = (ch, exId) => rec.getResult(load(), ch, exId);
export const chapterProgress = (chapter) => rec.chapterProgress(load(), chapter);
export const weakItems = (chapter) => rec.weakItems(load(), chapter);
export const hasProgress = () => rec.hasProgress(load());

// ---------- Herhaling ----------
export const dueItems = (entries, date) => srs.dueItems(load(), entries, date);
export const srsStats = (entries) => srs.srsStats(load(), entries);
export const streak = () => srs.streak(load());
/** Herhaalvragen die vandaag al gedaan zijn, en er één bij tellen. */
export const reviewedToday = () => srs.reviewedToday(load());
/** Hoeveel herhaalvragen er vandaag nog op het dagdoel staan (hooguit DAILY_GOAL). */
export const reviewLeft = (dueCount) => srs.reviewLeft(load(), dueCount);

// ---------- Kan-doen ----------
export const canDoStatus = (ch) => cando.canDoStatus(load(), ch);
/** Nieuw behaalde uitspraken (worden meteen als gemeld onthouden). → [{ nr, text }] */
export function newCanDo(ch) {
  const out = cando.newCanDo(load(), ch);
  if (out.fresh.length) progressStore.set(out.state);
  return out.fresh;
}

// ---------- Toetsen, spelletjes, instellingen ----------
export const saveTest = (ch, score, total, perTopic) => void update((s) => extras.saveTest(s, ch, score, total, perTopic));
export const getTest = (ch) => extras.getTest(load(), ch);
/** Slaat een spelscore op; geeft terug of het een nieuw record is. */
export function saveGame(id, score) {
  const out = extras.saveGame(load(), id, score);
  progressStore.set(out.state);
  return out.record;
}
export const getGame = (id) => extras.getGame(load(), id);
export const getPref = (key, fallback) => extras.getPref(load(), key, fallback);
export const setPref = (key, value) => void update((s) => extras.setPref(s, key, value));
export const setLast = (href, title) => void update((s) => extras.setLast(s, href, title));
export const getLast = () => load().last;

// ---------- Flitskaarten en dictee ----------
export const rateCard = (ch, dir, sv, known) => void update((s) => extras.rateCard(s, ch, dir, sv, known));
export const pickCards = (ch, dir, words, size, rand) => extras.pickCards(load(), ch, dir, words, size, rand);
export const cardProgress = (ch, dir, words) => extras.cardProgress(load(), ch, dir, words);
export const recordDictation = (say, good) => void update((s) => extras.recordDictation(s, say, good));
export const pickDictation = (says, size, rand) => extras.pickDictation(load(), says, size, rand);
export const dictationProgress = (says) => extras.dictationProgress(load(), says);

// ---------- Wissen, omzetten, exporteren, samenvoegen ----------
export const resetProgress = () => void progressStore.set({ ...schema.empty(), ids: true }, 'reset');

/** Oude voortgang (op plek) eenmalig omzetten naar vraag-id's. → aantal omgezet, of null. */
export function migrateToIds(chapters) {
  const out = schema.migrateToIds(load(), chapters);
  if (out.moved !== null) progressStore.set(out.state);
  return out.moved;
}

export const exportProgress = () => JSON.stringify(load(), null, 2);
/** Kopie van de hele voortgang (voor synchronisatie). */
export const progressSnapshot = () => JSON.parse(JSON.stringify(load()));

/**
 * Voegt andere voortgang samen met die van dit apparaat en slaat het resultaat op.
 * Geeft true als er op dit apparaat iets veranderd is.
 */
export function mergeProgress(input, reason = 'sync') {
  const local = load();
  const merged = mergeStates(local, parseProgress(input));
  const changed = JSON.stringify(merged) !== JSON.stringify(local);
  if (changed) progressStore.set(merged, reason);
  return changed;
}

/** Importeert een export en voegt die samen met wat er al staat. Gooit een fout bij een ongeldig bestand. */
export const importProgress = (text) => mergeProgress(text, 'import');
