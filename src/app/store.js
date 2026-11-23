// De voortgang van de draaiende app: lezen, veranderen met een pure functie, en melden wie wil weten
// dat er iets veranderd is (subscribe). Opslag gaat via platform/storage.js.
//
// get() leest de opslag elke keer opnieuw (een ander tabblad kan hem veranderd hebben), maar ontleedt
// de JSON alleen als de tekst anders is dan de vorige keer. Lukt opslaan niet (privévenster, vol),
// dan blijft de voortgang in het geheugen.
import { normalize, fromV1, VERSION } from '../core/progress/schema.js';

/**
 * @param storage  { read(key), write(key, value), remove(key) }  (platform/storage.js)
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

  function persist(next) {
    state = next;
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
    try {
      const raw = storage.read(key);
      if (raw && raw === cachedRaw) return state;
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.v === VERSION) {
          cachedRaw = raw;
          state = normalize(s);
          return state;
        }
      }
      const migrated = oldKey ? migrateV1() : null;
      if (migrated) persist(migrated);
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
