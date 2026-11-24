// Samenvoegen van twee voortgangen (import en synchronisatie). Puur.
import { empty, VERSION } from './schema.js';

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
 * - Flitskaarten en dictee: het nieuwste oordeel. Oefendagen en dagen met het dagdoel: allebei.
 * - Instellingen (stem, invoer, enz.) horen bij het apparaat: die van a blijven staan, b vult alleen aan.
 * - Badges: allebei, met het vroegste tijdstip.
 */
export function mergeStates(a, b, now = Date.now()) {
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
    v: VERSION,
    ids: !!(a.ids || b.ids) || undefined,
    items,
    srs,
    ex: mergeMap(a.ex, b.ex, (x, y) => best(x, y, exTime)),
    tests: mergeMap(a.tests, b.tests, (x, y) => best(x, y, atOf)),
    games: mergeMap(a.games, b.games, (x, y) => best(x, y, atOf)),
    // Een tijdstip ver in de toekomst (klok van een apparaat loopt voor) zou altijd winnen: dan telt dat niet.
    last: a.last && b.last ? newest(a.last, b.last, (r) => (atOf(r) > now + 3600000 ? 0 : atOf(r))) : a.last ?? b.last ?? null,
    days: [...new Set([...(a.days ?? []), ...(b.days ?? [])])].sort().slice(-400),
    goalDays: [...new Set([...(a.goalDays ?? []), ...(b.goalDays ?? [])])].sort().slice(-400),
    prefs,
    cards: mergeMap(a.cards, b.cards, byStamp('c/')),
    dictee: mergeMap(a.dictee, b.dictee, byStamp('d/')),
    t,
    badges: mergeMap(a.badges, b.badges, (x, y) => Math.min(x ?? Infinity, y ?? Infinity)),
  };
}
