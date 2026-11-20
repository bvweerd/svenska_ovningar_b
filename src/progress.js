// Voortgang in localStorage: per vraag én per oefening.
//
// state = {
//   v: 2,
//   items: { "<hoofdstuk>/<oefening>/<vraag-id>": { s: 'good'|'wrong'|'revealed'|'free', at, h, x? } },
//   ex:    { "<hoofdstuk>/<oefening>": { best, score, total, completedAt?, runStart?, pick? } },
//   last:  { href, title, at },
//   cards: { "<hoofdstuk>/<sv|nl>/<Zweeds woord>": 'known'|'unknown' }   (flitskaarten, per richting)
//   dictee: { "<gesproken tekst>": 'good'|'wrong' }
//   t:     { "c/<flitskaartsleutel>" | "d/<gesproken tekst>": tijdstip }   (voor samenvoegen, zie mergeStates)
// }
// - 'good' = in één keer goed, 'wrong' = goed na fouten, 'revealed' = antwoord bekeken.
// - Elke vraag heeft een vaste id (content/…yaml, of het Zweedse woord bij woordenschat), zodat
//   invoegen, verwijderen of verschuiven van vragen de voortgang niet raakt. Zonder id: de plek in de lijst.
// - h is een hash van de goede antwoorden; verandert wat goed is, dan telt het oude resultaat niet meer.
//   Een andere tip, uitleg of vraagformulering laat de voortgang staan.
// - ids: true betekent dat oude voortgang (op plek) is omgezet naar ids (zie migrateToIds).
// - Een "ronde" van een oefening begint bij runStart; vragen met at >= runStart zijn in deze ronde gedaan.
// - pick: bij een lange oefening (roundSize) de vraag-id's van deze ronde; zonder pick telt de hele oefening.
// - at bij ex: laatste wijziging, zodat samenvoegen (import, synchronisatie) de nieuwste ronde kiest.
//   x: 1 = gemaakt buiten de oefening (toets, mix, herhaling, flitskaarten): telt wel als voortgang,
//   maar niet als gedaan in de lopende ronde van de oefening.

import { STORAGE_PREFIX } from './config.js';

export const KEY = `${STORAGE_PREFIX}:progress:v2`;
const OLD_KEY = `${STORAGE_PREFIX}:progress:v1`;
const empty = () => ({ v: 2, items: {}, ex: {}, last: null, srs: {}, days: [], tests: {}, games: {}, prefs: {}, cards: {}, dictee: {}, t: {} });
let memory = empty();
// Laatst gelezen of geschreven opslag: zo wordt de JSON niet bij elke aanroep opnieuw ontleed.
let cachedRaw = null;
let cachedState = null;

function migrate() {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? 'null');
    if (!old) return null;
    const state = empty();
    for (const [k, r] of Object.entries(old)) {
      state.ex[k] = { best: r.best ?? 0, score: r.score, total: r.total, completedAt: r.at };
    }
    localStorage.removeItem(OLD_KEY);
    return state;
  } catch {
    return null;
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw === cachedRaw) return cachedState;
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.v === 2) {
        cachedRaw = raw;
        cachedState = { ...empty(), ...s };
        return cachedState;
      }
    }
    const migrated = migrate();
    if (migrated) {
      save(migrated);
      return migrated;
    }
    return memory;
  } catch {
    return memory;
  }
}

function save(state) {
  memory = state;
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedState = state;
  } catch {
    /* geen opslag beschikbaar: alleen in het geheugen */
  }
}

export function hashItem(item) {
  const s = JSON.stringify(item);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Het deel van een vraag dat bepaalt wat goed is. */
function answerPart(item) {
  if (!item || typeof item !== 'object') return item ?? null;
  const cells = (rows) => (rows ?? []).map((r) => r.map((c) => (c && typeof c === 'object' ? c.answers : c)));
  switch (item.type) {
    case 'mc': return ['mc', item.options?.[item.answer]];
    case 'multi': return ['multi', (item.answers ?? []).map((i) => item.options?.[i]).sort()];
    case 'gap': return ['gap', (item.gaps ?? []).map((g) => g.answers)];
    case 'table': return ['table', cells(item.rows)];
    case 'truefalse': return ['truefalse', item.statement, item.answer, item.correction?.answers ?? null];
    case 'findError': return ['findError', item.sentence, item.wrong, item.answers];
    case 'match': return ['match', item.pairs];
    case 'dialogue': return ['dialogue', item.lines];
    case 'sort': return ['sort', item.categories, (item.items ?? []).map((x) => [x.text, x.cat])];
    case 'clock': return ['clock', item.time];
    case 'listen': return ['listen', item.say, item.options ? item.options[item.answer] : item.answers ?? null];
    case 'steps': return ['steps', (item.steps ?? []).map(answerPart)];
    case 'free': return ['free'];
    default: return [item.type, item.answers ?? null];
  }
}

/** Vingerafdruk van de goede antwoorden van een vraag (per vraag-object onthouden: de inhoud verandert niet). */
const hashes = new WeakMap();
export function answerHash(item) {
  if (!item || typeof item !== 'object') return hashItem(answerPart(item));
  if (!hashes.has(item)) hashes.set(item, hashItem(answerPart(item)));
  return hashes.get(item);
}

const exKey = (ch, exId) => `${ch}/${exId}`;
const itemId = (ex, idx) => ex.items[idx]?.id ?? idx;
const itemKey = (ch, ex, idx) => `${ch}/${ex.id}/${itemId(ex, idx)}`;
const gradable = (ex) => ex.items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.type !== 'free');

/** Status van één vraag, of null als die (nog) niet of in een oudere versie gemaakt is. */
function itemRecord(state, ch, ex, idx) {
  const r = state.items[itemKey(ch, ex, idx)];
  return r && r.h === answerHash(ex.items[idx]) ? r : null;
}

// ---------- Herhaling met intervallen (Leitner-dozen) ----------
/** Aantal dagen tot de volgende herhaling, per doos. */
export const INTERVALS = [0, 1, 2, 4, 7, 14, 30, 60];
const MAX_BOX = INTERVALS.length - 1;

/** Lokale datum als 'JJJJ-MM-DD'. */
export function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Volgende stand van een vraag: in één keer goed → doos hoger; anders terug naar doos 1 (morgen). */
export function nextSrs(prev, status) {
  if (status === 'free') return prev ?? null;
  const box = status === 'good' ? Math.min((prev?.box ?? 0) + 1, MAX_BOX) : 1;
  return { box, due: today(INTERVALS[box]) };
}

function markDay(state) {
  const t = today();
  state.days = state.days ?? [];
  if (state.days[state.days.length - 1] !== t) state.days = [...state.days.filter((d) => d !== t), t].slice(-400);
}

/** @param opts { outside: true } als de vraag buiten de oefening zelf gemaakt is (toets, mix, herhaling). */
export function recordItem(ch, ex, idx, status, { outside = false } = {}) {
  const state = load();
  const key = itemKey(ch, ex, idx);
  const h = answerHash(ex.items[idx]);
  state.items[key] = { s: status, at: Date.now(), h, ...(outside ? { x: 1 } : {}) };
  state.srs = state.srs ?? {};
  const prev = state.srs[key]?.h === h ? state.srs[key] : null;
  const next = nextSrs(prev, status);
  if (next) state.srs[key] = { ...next, h };
  markDay(state);
  save(state);
}

/**
 * Vragen die vandaag (of eerder) herhaald moeten worden.
 * @param entries [{ chapter, ex, idx, item }]
 */
export function dueItems(entries, date = today()) {
  const srs = load().srs ?? {};
  return entries
    .map((e) => ({ ...e, rec: srs[itemKey(e.chapter.chapter, e.ex, e.idx)] }))
    .filter((e) => e.rec && e.rec.h === answerHash(e.item) && e.rec.due <= date)
    .sort((a, b) => (a.rec.due < b.rec.due ? -1 : a.rec.due > b.rec.due ? 1 : a.rec.box - b.rec.box));
}

/** Hoeveel vragen zitten in welke doos (alleen bekende, actuele vragen). */
export function srsStats(entries) {
  const srs = load().srs ?? {};
  const boxes = Array(INTERVALS.length).fill(0);
  for (const e of entries) {
    const r = srs[itemKey(e.chapter.chapter, e.ex, e.idx)];
    if (r && r.h === answerHash(e.item)) boxes[r.box]++;
  }
  return boxes;
}

/** Aantal dagen op rij geoefend (tot en met vandaag of gisteren). */
export function streak() {
  const days = new Set(load().days ?? []);
  let n = 0;
  let offset = days.has(today()) ? 0 : -1;
  while (days.has(today(offset))) {
    n++;
    offset--;
  }
  return { days: n, today: days.has(today()) };
}

// ---------- Kan-doen-uitspraken ----------
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
 * Stand van de kan-doen-uitspraken van een hoofdstuk, afgeleid uit de herhaaldozen.
 * De leerling beoordeelt niets zelf: een uitspraak is behaald als CANDO_SHARE van zijn vragen
 * in doos CANDO_BOX of hoger staat. → [{ text, total, seen, known, share, done }]
 */
export function canDoStatus(ch) {
  const srs = load().srs ?? {};
  const state = load();
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
 * Uitspraken die nu behaald zijn maar nog niet eerder gemeld; die worden meteen als gemeld onthouden.
 * → [{ nr, text }] (nr vanaf 1)
 */
export function newCanDo(ch) {
  const state = load();
  const seen = new Set(state.prefs?.canDoSeen ?? []);
  const fresh = canDoStatus(ch)
    .map((s, i) => ({ ...s, nr: i + 1 }))
    .filter((s) => s.done && !seen.has(`${ch.chapter}/${s.nr}`));
  if (fresh.length) {
    const latest = load();
    latest.prefs = { ...(latest.prefs ?? {}), canDoSeen: [...seen, ...fresh.map((s) => `${ch.chapter}/${s.nr}`)] };
    save(latest);
  }
  return fresh.map(({ nr, text }) => ({ nr, text }));
}

// ---------- Toetsen, spelletjes en instellingen ----------
export function saveTest(ch, score, total, perTopic) {
  const state = load();
  const prev = state.tests?.[ch];
  const ratio = total ? score / total : 0;
  state.tests = { ...(state.tests ?? {}), [ch]: { best: Math.max(prev?.best ?? 0, ratio), last: ratio, perTopic, at: Date.now() } };
  markDay(state);
  save(state);
}

export function getTest(ch) {
  return load().tests?.[ch] ?? null;
}

/** Slaat een spelscore op; geeft terug of het een nieuw record is. */
export function saveGame(id, score) {
  const state = load();
  const prev = state.games?.[id]?.best ?? 0;
  state.games = { ...(state.games ?? {}), [id]: { best: Math.max(prev, score), last: score, at: Date.now() } };
  markDay(state);
  save(state);
  return score > prev;
}

export function getGame(id) {
  return load().games?.[id] ?? null;
}

/** Heeft deze gebruiker al iets gemaakt (een vraag, flitskaart of dictee)? */
export function hasProgress() {
  const s = load();
  return Object.keys(s.items ?? {}).length > 0 || Object.keys(s.cards ?? {}).length > 0 || Object.keys(s.dictee ?? {}).length > 0;
}

export function getPref(key, fallback) {
  return load().prefs?.[key] ?? fallback;
}

export function setPref(key, value) {
  const state = load();
  state.prefs = { ...(state.prefs ?? {}), [key]: value };
  save(state);
}

/** De vraagnummers (idx) van de lopende ronde: alle vragen, of de gekozen deelverzameling (pick). */
function roundIndices(ex, rec) {
  const all = ex.items.map((_, idx) => idx);
  if (!rec?.pick) return all;
  const ids = new Set(rec.pick.map(String));
  return all.filter((idx) => ids.has(String(itemId(ex, idx))));
}

/** Welke vragen zijn in de lopende ronde al gedaan? inRound(idx): hoort deze vraag bij de ronde? */
export function runState(ch, ex) {
  const state = load();
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

/**
 * Kiest de vragen voor een ronde van een lange oefening: eerst vragen die je nog nooit gemaakt
 * hebt, dan vragen die fout gingen of waarvan je het antwoord bekeek, dan de rest.
 * Binnen een groep willekeurig. Geeft vraagnummers (idx) terug, in de volgorde van de oefening.
 */
export function pickRound(ch, ex, size, rand = Math.random) {
  const state = load();
  const groups = [[], [], []];
  ex.items.forEach((item, idx) => {
    if (item.type === 'free') return;
    const r = itemRecord(state, ch, ex, idx);
    groups[!r ? 0 : r.s === 'wrong' || r.s === 'revealed' ? 1 : 2].push(idx);
  });
  const mix = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // Alleen wat nieuw is of fout ging, ook als dat minder is dan een hele ronde. Pas als alles goed
  // is, wordt het een herhaalronde met vragen die je al kende.
  const due = [...mix(groups[0]), ...mix(groups[1])];
  return (due.length ? due : mix(groups[2])).slice(0, size).sort((a, b) => a - b);
}

/** Voortgang over een hele lange oefening (alle rondes): gehad, nog nieuw, laatst fout of bekeken. */
export function roundProgress(ch, ex) {
  const state = load();
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

/** Start een nieuwe ronde; pick (vraagnummers) beperkt de ronde tot die vragen. */
export function startRun(ch, ex, pick = null) {
  const state = load();
  const k = exKey(ch, ex.id);
  const { pick: _old, ...rest } = state.ex[k] ?? { best: 0 };
  state.ex[k] = { ...rest, runStart: Date.now(), at: Date.now(), ...(pick ? { pick: pick.map((idx) => itemId(ex, idx)) } : {}) };
  save(state);
}

/** Sluit een ronde af en geeft de score van die ronde terug. */
export function completeRun(ch, ex) {
  const { done, inRound } = runState(ch, ex);
  const items = gradable(ex).filter(({ idx }) => inRound(idx));
  const score = items.filter(({ idx }) => done.get(idx) === 'good').length;
  const total = items.length;
  const state = load();
  const k = exKey(ch, ex.id);
  const prev = state.ex[k] ?? { best: 0 };
  if (!prev.pick) {
    const ratio = total ? score / total : 1;
    state.ex[k] = { best: Math.max(prev.best ?? 0, ratio), score, total, completedAt: Date.now(), at: Date.now() };
  } else {
    // Ronde van een lange oefening: pas afgerond als elke vraag een keer gemaakt is. De beste
    // score geldt dan voor de hele oefening (laatste poging per vraag), niet voor deze ronde.
    const all = gradable(ex);
    const records = all.map(({ idx }) => itemRecord(state, ch, ex, idx));
    const complete = records.every(Boolean);
    const whole = all.length ? records.filter((r) => r?.s === 'good').length / all.length : 1;
    const { pick: _round, runStart: _start, ...rest } = prev;
    state.ex[k] = {
      ...rest,
      score,
      total,
      best: complete ? Math.max(prev.best ?? 0, whole) : prev.best ?? 0,
      at: Date.now(),
      ...(complete ? { completedAt: Date.now() } : {}),
    };
  }
  save(state);
  return { score, total };
}

export function getResult(ch, exId) {
  return load().ex[exKey(ch, exId)] ?? null;
}

/** Voortgang van een hoofdstuk: afgeronde oefeningen en beantwoorde vragen. */
export function chapterProgress(chapter) {
  const state = load();
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
export function weakItems(chapter) {
  const state = load();
  const out = [];
  for (const ex of chapter.exercises ?? []) {
    ex.items.forEach((item, idx) => {
      const r = itemRecord(state, chapter.chapter, ex, idx);
      if (r && (r.s === 'wrong' || r.s === 'revealed')) out.push({ ex, idx, item });
    });
  }
  return out;
}

export function setLast(href, title) {
  const state = load();
  state.last = { href, title, at: Date.now() };
  save(state);
}

export function getLast() {
  return load().last;
}

export function resetProgress() {
  save({ ...empty(), ids: true });
}

/**
 * Zet oude voortgang (opgeslagen op de plek van een vraag) om naar vraag-id's.
 * Werkt voor vragen die nog dezelfde inhoud hebben als toen ze gemaakt werden.
 * Draait één keer; daarna staat ids: true in de opslag.
 * @returns het aantal omgezette vragen, of null als er niets te doen was
 */
export function migrateToIds(chapters) {
  const state = load();
  if (state.ids) return null;
  const items = {};
  const srs = {};
  let moved = 0;
  for (const ch of chapters) {
    for (const ex of ch.exercises ?? []) {
      ex.items.forEach((item, idx) => {
        const oldKey = `${ch.chapter}/${ex.id}/${idx}`;
        const newKey = itemKey(ch.chapter, ex, idx);
        const { id, ...withoutId } = item;
        const oldHash = hashItem(withoutId);
        const h = answerHash(item);
        const r = state.items[oldKey];
        if (r && r.h === oldHash) {
          items[newKey] = { ...r, h };
          moved++;
        }
        const q = state.srs?.[oldKey];
        if (q && q.h === oldHash) srs[newKey] = { ...q, h };
      });
    }
  }
  state.items = items;
  state.srs = srs;
  state.ids = true;
  save(state);
  return moved;
}

export function exportProgress() {
  return JSON.stringify(load(), null, 2);
}

/** Kopie van de hele voortgang (voor synchronisatie). */
export function progressSnapshot() {
  return JSON.parse(JSON.stringify(load()));
}

/** Controleert een export (tekst of object) en geeft de voortgang terug. Gooit een fout bij een ongeldig bestand. */
export function parseProgress(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const optional = (x) => x === undefined || x === null || isObj(x);
  if (!isObj(data) || data.v !== 2 || !isObj(data.items) || !isObj(data.ex)
    || !optional(data.srs) || !optional(data.tests) || !optional(data.games) || !optional(data.prefs)
    || !optional(data.cards) || !optional(data.dictee) || !optional(data.t)
    || (data.days !== undefined && !Array.isArray(data.days))) {
    throw new Error('Dit is geen geldig voortgangsbestand.');
  }
  return { ...empty(), ...data };
}

/**
 * Voegt andere voortgang samen met die van dit apparaat en slaat het resultaat op.
 * Geeft true als er op dit apparaat iets veranderd is.
 */
export function mergeProgress(input) {
  const local = load();
  const merged = mergeStates(local, parseProgress(input));
  const changed = JSON.stringify(merged) !== JSON.stringify(local);
  if (changed) save(merged);
  return changed;
}

/** Importeert een export en voegt die samen met wat er al staat. Gooit een fout bij een ongeldig bestand. */
export function importProgress(text) {
  return mergeProgress(text);
}

// ---------- Samenvoegen (import en synchronisatie) ----------
function stamp(state, key) {
  state.t = { ...(state.t ?? {}), [key]: Date.now() };
}

/** De nieuwste van twee records; bij gelijke tijd een vaste keuze, zodat beide kanten hetzelfde kiezen. */
function newest(x, y, time) {
  const tx = time(x);
  const ty = time(y);
  if (tx !== ty) return ty > tx ? y : x;
  return JSON.stringify(y) > JSON.stringify(x) ? y : x;
}

function mergeMap(a, b, pick) {
  const out = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = k in out ? pick(out[k], v, k) : v;
  return out;
}

const atOf = (r) => r?.at ?? 0;
const exTime = (r) => r?.at ?? Math.max(r?.completedAt ?? 0, r?.runStart ?? 0);

/**
 * Voegt twee voortgangen samen zonder iets kwijt te raken. a is dit apparaat, b de andere kant.
 * - Per vraag telt de laatst gemaakte poging; de Leitner-doos hoort bij die poging.
 * - Per oefening, toets en spel: de nieuwste ronde, met de hoogste beste score van beide.
 * - Flitskaarten en dictee: het nieuwste oordeel. Oefendagen: allebei.
 * - Instellingen (stem, invoer, enz.) horen bij het apparaat: die van a blijven staan, b vult alleen aan.
 */
export function mergeStates(a, b) {
  a = { ...empty(), ...a };
  b = { ...empty(), ...b };
  const items = mergeMap(a.items, b.items, (x, y) => newest(x, y, atOf));
  const srs = mergeMap(a.srs, b.srs, (x, y, k) => {
    if (items[k] === b.items[k] && items[k] !== a.items[k]) return y;
    if (items[k] === a.items[k] && items[k] !== b.items[k]) return x;
    return newest(x, y, () => 0);
  });
  const best = (x, y, time) => ({ ...newest(x, y, time), best: Math.max(x?.best ?? 0, y?.best ?? 0) });
  const t = mergeMap(a.t, b.t, (x, y) => Math.max(x ?? 0, y ?? 0));
  const byStamp = (prefix) => (x, y, k) => {
    const ta = a.t?.[prefix + k] ?? 0;
    const tb = b.t?.[prefix + k] ?? 0;
    if (ta !== tb) return tb > ta ? y : x;
    return x;
  };
  const prefs = mergeMap(a.prefs, b.prefs, (x, y) => (Array.isArray(x) && Array.isArray(y) ? [...new Set([...x, ...y])] : x));
  return {
    ...b,
    ...a,
    v: 2,
    ids: !!(a.ids || b.ids) || undefined,
    items,
    srs,
    ex: mergeMap(a.ex, b.ex, (x, y) => best(x, y, exTime)),
    tests: mergeMap(a.tests, b.tests, (x, y) => best(x, y, atOf)),
    games: mergeMap(a.games, b.games, (x, y) => best(x, y, atOf)),
    last: a.last && b.last ? newest(a.last, b.last, atOf) : a.last ?? b.last ?? null,
    days: [...new Set([...(a.days ?? []), ...(b.days ?? [])])].sort().slice(-400),
    prefs,
    cards: mergeMap(a.cards, b.cards, byStamp('c/')),
    dictee: mergeMap(a.dictee, b.dictee, byStamp('d/')),
    t,
  };
}

// ---------- Flitskaarten en dictee: eigen geheugen, los van de oefeningen ----------
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

/** Zelfbeoordeling bij een flitskaart: alleen de eerste beoordeling per stapel telt (zie viewFlashcards). */
export function rateCard(ch, dir, sv, known) {
  const state = load();
  state.cards = { ...(state.cards ?? {}), [cardKey(ch, dir, sv)]: known ? 'known' : 'unknown' };
  stamp(state, `c/${cardKey(ch, dir, sv)}`);
  markDay(state);
  save(state);
}

/** Woorden (Zweeds) voor de volgende stapel flitskaarten. */
export function pickCards(ch, dir, words, size, rand = Math.random) {
  const cards = load().cards ?? {};
  return pickDue(words, (sv) => cards[cardKey(ch, dir, sv)], size, 'unknown', rand);
}

export function cardProgress(ch, dir, words) {
  const cards = load().cards ?? {};
  const st = words.map((sv) => cards[cardKey(ch, dir, sv)]);
  const known = st.filter((x) => x === 'known').length;
  const unknown = st.filter((x) => x === 'unknown').length;
  return { total: words.length, known, unknown, fresh: words.length - known - unknown };
}

export function recordDictation(say, good) {
  const state = load();
  state.dictee = { ...(state.dictee ?? {}), [say]: good ? 'good' : 'wrong' };
  stamp(state, `d/${say}`);
  markDay(state);
  save(state);
}

/** Zinnen of woorden voor een dictee: eerst nieuw, dan fout. */
export function pickDictation(says, size, rand = Math.random) {
  const d = load().dictee ?? {};
  return pickDue(says, (k) => d[k], size, 'wrong', rand);
}

export function dictationProgress(says) {
  const d = load().dictee ?? {};
  const st = says.map((k) => d[k]);
  return { total: says.length, seen: st.filter(Boolean).length, wrong: st.filter((x) => x === 'wrong').length };
}
