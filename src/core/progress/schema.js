// Vorm van de voortgang, sleutels en antwoordhash. Puur: geen opslag.
//
// state = {
//   v: 2,
//   items: { "<hoofdstuk>/<oefening>/<vraag-id>": { s: 'good'|'wrong'|'revealed'|'free', at, h, x? } },
//   ex:    { "<hoofdstuk>/<oefening>": { best, score, total, completedAt?, runStart?, pick?, at? } },
//   srs:   { "<vraagsleutel>": { box, due, h } }      (Leitner-dozen, zie srs.js)
//   last:  { href, title, at },
//   days:  ['JJJJ-MM-DD', …]                          (oefendagen, voor de reeks)
//   tests, games: { id: { best, last, at, perTopic? } }
//   prefs: { … }                                      (instellingen en meldingen die al getoond zijn)
//   cards: { "<hoofdstuk>/<sv|nl>/<Zweeds woord>": 'known'|'unknown' }   (flitskaarten, per richting)
//   dictee: { "<gesproken tekst>": 'good'|'wrong' }
//   t:     { "c/<flitskaartsleutel>" | "d/<gesproken tekst>": tijdstip }   (voor samenvoegen, zie merge.js)
//   ids:   true als oude voortgang (op plek) is omgezet naar vraag-id's
// }
// - 'good' = in één keer goed, 'wrong' = goed na fouten, 'revealed' = antwoord bekeken.
// - Elke vraag heeft een vaste id (content/…yaml, of het Zweedse woord bij woordenschat), zodat
//   invoegen, verwijderen of verschuiven van vragen de voortgang niet raakt. Zonder id: de plek in de lijst.
// - h is een hash van de goede antwoorden; verandert wat goed is, dan telt het oude resultaat niet meer.
//   Een andere tip, uitleg of vraagformulering laat de voortgang staan.
// - Een "ronde" van een oefening begint bij runStart; vragen met at >= runStart zijn in deze ronde gedaan.
// - pick: bij een lange oefening (roundSize) de vraag-id's van deze ronde; zonder pick telt de hele oefening.
// - at bij ex: laatste wijziging, zodat samenvoegen (import, synchronisatie) de nieuwste ronde kiest.
// - x: 1 = gemaakt buiten de oefening (toets, mix, herhaling): telt wel als voortgang,
//   maar niet als gedaan in de lopende ronde van de oefening.
import { hashItem } from '../hash.js';
import { answerPart, isGradable } from '../items/index.js';

export const VERSION = 2;

export const empty = () => ({ v: 2, items: {}, ex: {}, last: null, srs: {}, days: [], tests: {}, games: {}, prefs: {}, cards: {}, dictee: {}, t: {} });

/** Vult ontbrekende onderdelen aan (oudere of gedeeltelijke voortgang). */
export const normalize = (s) => ({ ...empty(), ...s });

/** Vingerafdruk van de goede antwoorden van een vraag (per vraag-object onthouden: de inhoud verandert niet). */
const hashes = new WeakMap();
export function answerHash(item) {
  if (!item || typeof item !== 'object') return hashItem(answerPart(item));
  if (!hashes.has(item)) hashes.set(item, hashItem(answerPart(item)));
  return hashes.get(item);
}

export const exKey = (ch, exId) => `${ch}/${exId}`;
export const itemId = (ex, idx) => ex.items[idx]?.id ?? idx;
export const itemKey = (ch, ex, idx) => `${ch}/${ex.id}/${itemId(ex, idx)}`;
export const gradable = (ex) => ex.items.map((it, idx) => ({ it, idx })).filter(({ it }) => isGradable(it));

/** Status van één vraag, of null als die (nog) niet of in een oudere versie gemaakt is. */
export function itemRecord(state, ch, ex, idx) {
  const r = state.items[itemKey(ch, ex, idx)];
  return r && r.h === answerHash(ex.items[idx]) ? r : null;
}

/** Oude opslag (v1: alleen per oefening) → v2. */
export function fromV1(old) {
  const state = empty();
  for (const [k, r] of Object.entries(old ?? {})) {
    state.ex[k] = { best: r.best ?? 0, score: r.score, total: r.total, completedAt: r.at };
  }
  return state;
}

/**
 * Zet oude voortgang (opgeslagen op de plek van een vraag) om naar vraag-id's.
 * Werkt voor vragen die nog dezelfde inhoud hebben als toen ze gemaakt werden.
 * → { state, moved } (state ongewijzigd en moved null als het al gedaan was)
 */
export function migrateToIds(state, chapters) {
  if (state.ids) return { state, moved: null };
  const items = {};
  const srs = {};
  let moved = 0;
  for (const ch of chapters) {
    for (const ex of ch.exercises ?? []) {
      ex.items.forEach((item, idx) => {
        const oldKey = `${ch.chapter}/${ex.id}/${idx}`;
        const newKey = itemKey(ch.chapter, ex, idx);
        const { id: _id, ...withoutId } = item;
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
  return { state: { ...state, items, srs, ids: true }, moved };
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
  return normalize(data);
}
