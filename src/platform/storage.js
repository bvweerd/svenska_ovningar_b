// De enige plek die localStorage aanraakt. In een privévenster, bij volle opslag of zonder
// toestemming gooit de browser fouten; die worden hier opgevangen: lezen geeft dan null,
// schrijven doet niets (de aanroeper houdt de waarde dan alleen in het geheugen).
// localStorage wordt bij elke aanroep opnieuw opgezocht, zodat tests hem kunnen vervangen.

const ls = () => globalThis.localStorage;

/** Waarde als tekst, of null. */
export function read(key) {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Schrijft tekst; null of undefined verwijdert de sleutel. true als het gelukt is. */
export function write(key, value) {
  try {
    if (value === null || value === undefined) ls().removeItem(key);
    else ls().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const remove = (key) => write(key, null);

/** JSON-waarde, of fallback als er niets (geldigs) staat. */
export function readJson(key, fallback = null) {
  const raw = read(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export const writeJson = (key, value) => write(key, value === null || value === undefined ? null : JSON.stringify(value));
