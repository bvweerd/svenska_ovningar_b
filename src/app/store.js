// De voortgang van de draaiende app: lezen, veranderen met een pure functie, en melden wie wil weten
// dat er iets veranderd is (subscribe). Opslag gaat via platform/storage.js.
//
// get() geeft de toestand in het geheugen. De opslag wordt alleen opnieuw gelezen als een ander tabblad
// hem veranderde (storage-event, zie storage.watch); kan de opslag dat niet melden (tests), dan wordt
// elke keer gelezen, maar de JSON alleen ontleed als de tekst anders is. Lukt opslaan niet (privévenster,
// vol), dan blijft de voortgang in het geheugen.
import { normalize, fromV1, VERSION } from '../core/progress/schema.js';

/**
 * @param storage  { read(key), write(key, value), remove(key), watch?(key, fn) }  (platform/storage.js)
 * @param key      opslagsleutel van de huidige versie
 * @param oldKey   sleutel van versie 1 (wordt één keer omgezet en dan verwijderd)
 */
export function createStore({ storage, key, oldKey }) {
  // De laatst bekende toestand, en de tekst in de opslag die daarbij hoort (dan hoeft get() niet opnieuw
  // te ontleden). Lukt opslaan niet, dan hoort de oude tekst bij de nieuwere toestand in het geheugen;
  // verandert een ander tabblad de opslag, dan geldt die weer.
  let state = normalize({});
  let cachedRaw = null;
  const listeners = new Set();
  // fresh: de toestand in het geheugen is bijgewerkt en niemand anders heeft geschreven.
  let fresh = false;
  const watching = storage.watch?.(key, () => { fresh = false; }) === true;

  function persist(next) {
    state = next;
    fresh = watching;
    const raw = JSON.stringify(next);
    cachedRaw = storage.write(key, raw) ? raw : storage.read(key);
  }

  function migrateV1() {
    try {
      const old = JSON.parse(storage.read(oldKey) ?? 'null');
      if (!old) return null;
      storage.remove(oldKey);
      return fromV1(old);
    } catch {
      return null;
    }
  }

  function get() {
    if (fresh) return state;
    try {
      const raw = storage.read(key);
      if (raw && raw === cachedRaw) {
        fresh = watching;
        return state;
      }
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.v === VERSION) {
          cachedRaw = raw;
          state = normalize(s);
          fresh = watching;
          return state;
        }
      }
      const migrated = oldKey ? migrateV1() : null;
      if (migrated) persist(migrated);
      fresh = watching;
      return state;
    } catch {
      return state;
    }
  }

  /**
   * Nieuwe toestand opslaan en melden. reason: 'local' (antwoord, instelling), 'sync', 'import' of 'reset'.
   */
  function set(next, reason = 'local') {
    const prev = state;
    persist(next);
    for (const fn of listeners) fn(next, { reason, prev });
    return next;
  }

  return {
    get,
    set,
    /** fn(state) → nieuwe toestand (pure functie uit core/progress). */
    update: (fn, reason) => set(fn(get()), reason),
    /** fn(state, { reason, prev }); geeft een functie terug om af te melden. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
