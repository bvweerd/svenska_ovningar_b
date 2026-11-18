// Voortgang in localStorage: per vraag én per oefening.
//
// state = {
//   v: 2,
//   items: { "<hoofdstuk>/<oefening>/<vraag-id>": { s: 'good'|'wrong'|'revealed'|'free', at, h } },
//   ex:    { "<hoofdstuk>/<oefening>": { best, score, total, completedAt?, runStart? } },
//   last:  { href, title, at }
// }
// - 'good' = in één keer goed, 'wrong' = goed na fouten, 'revealed' = antwoord bekeken.
// - Elke vraag heeft een vaste id (content/…yaml, of het Zweedse woord bij woordenschat), zodat
//   invoegen, verwijderen of verschuiven van vragen de voortgang niet raakt. Zonder id: de plek in de lijst.
// - h is een hash van de goede antwoorden; verandert wat goed is, dan telt het oude resultaat niet meer.
//   Een andere tip, uitleg of vraagformulering laat de voortgang staan.
// - ids: true betekent dat oude voortgang (op plek) is omgezet naar ids (zie migrateToIds).
// - Een "ronde" van een oefening begint bij runStart; vragen met at >= runStart zijn in deze ronde gedaan.

const KEY = 'svensk-ovningar-b:progress:v2';
const OLD_KEY = 'svensk-ovningar-b:progress:v1';
const empty = () => ({ v: 2, items: {}, ex: {}, last: null, srs: {}, days: [], tests: {}, games: {}, prefs: {} });
let memory = empty();

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
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.v === 2) return { ...empty(), ...s };
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
    localStorage.setItem(KEY, JSON.stringify(state));
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

/** Vingerafdruk van de goede antwoorden van een vraag. */
export const answerHash = (item) => hashItem(answerPart(item));

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

export function recordItem(ch, ex, idx, status) {
  const state = load();
  const key = itemKey(ch, ex, idx);
  const h = answerHash(ex.items[idx]);
  state.items[key] = { s: status, at: Date.now(), h };
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

export function getPref(key, fallback) {
  return load().prefs?.[key] ?? fallback;
}

export function setPref(key, value) {
  const state = load();
  state.prefs = { ...(state.prefs ?? {}), [key]: value };
  save(state);
}

/** Welke vragen zijn in de lopende ronde al gedaan? */
export function runState(ch, ex) {
  const state = load();
  const rec = state.ex[exKey(ch, ex.id)];
  const start = rec?.runStart;
  const done = new Map();
  if (start) {
    ex.items.forEach((_, idx) => {
      const r = itemRecord(state, ch, ex, idx);
      if (r && r.at >= start) done.set(idx, r.s);
    });
  }
  return { started: !!start, done, total: ex.items.length };
}

export function startRun(ch, ex) {
  const state = load();
  const k = exKey(ch, ex.id);
  state.ex[k] = { ...(state.ex[k] ?? { best: 0 }), runStart: Date.now() };
  save(state);
}

/** Sluit een ronde af en geeft de score van die ronde terug. */
export function completeRun(ch, ex) {
  const { done } = runState(ch, ex);
  const items = gradable(ex);
  const score = items.filter(({ idx }) => done.get(idx) === 'good').length;
  const total = items.length;
  const state = load();
  const k = exKey(ch, ex.id);
  const prev = state.ex[k] ?? { best: 0 };
  const ratio = total ? score / total : 1;
  state.ex[k] = { best: Math.max(prev.best ?? 0, ratio), score, total, completedAt: Date.now() };
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

/** Importeert een export. Gooit een fout bij een ongeldig bestand. */
export function importProgress(text) {
  const data = JSON.parse(text);
  if (data?.v !== 2 || typeof data.items !== 'object' || typeof data.ex !== 'object') {
    throw new Error('Dit is geen geldig voortgangsbestand.');
  }
  save({ ...empty(), ...data });
}
