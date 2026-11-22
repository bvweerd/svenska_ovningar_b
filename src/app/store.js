// De voortgang van de draaiende app: lezen, veranderen met een pure functie, en melden wie wil weten
// dat er iets veranderd is (subscribe). Opslag gaat via platform/storage.js.
//
// get() leest de opslag elke keer opnieuw (een ander tabblad kan hem veranderd hebben), maar ontleedt
// de JSON alleen als de tekst anders is dan de vorige keer. Lukt opslaan niet (privévenster, vol),
// dan blijft de voortgang in het geheugen.
import { normalize, fromV1 } from '../core/progress/schema.js';

/**
 * @param storage  { read(key), write(key, value), remove(key) }  (platform/storage.js)
 * @param key      opslagsleutel van de huidige versie
 * @param oldKey   sleutel van versie 1 (wordt één keer omgezet en dan verwijderd)
 */
export function createStore({ storage, key, oldKey }) {
  let memory = normalize({});
  let cachedRaw = null;
  let cachedState = null;
  const listeners = new Set();

  function persist(state) {
    memory = state;
    const raw = JSON.stringify(state);
    if (storage.write(key, raw)) {
      cachedRaw = raw;
      cachedState = state;
    } else {
      // Opslaan mislukt (bijv. opslag vol) terwijl lezen nog werkt: de oude tekst in de opslag hoort nu
      // bij de nieuwere toestand in het geheugen, anders geeft get() de oude terug en raakt elk
      // antwoord kwijt. Verandert een ander tabblad de opslag, dan geldt die weer.
      cachedRaw = storage.read(key);
      cachedState = state;
    }
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
      if (raw && raw === cachedRaw) return cachedState;
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.v === 2) {
          cachedRaw = raw;
          cachedState = normalize(s);
          return cachedState;
        }
      }
      const migrated = oldKey ? migrateV1() : null;
      if (migrated) {
        persist(migrated);
        return migrated;
      }
      return memory;
    } catch {
      return memory;
    }
  }

  /**
   * Nieuwe toestand opslaan en melden. reason: 'local' (antwoord, instelling), 'sync', 'import' of 'reset'.
   */
  function set(state, reason = 'local') {
    const prev = get();
    persist(state);
    for (const fn of listeners) fn(state, { reason, prev });
    return state;
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
