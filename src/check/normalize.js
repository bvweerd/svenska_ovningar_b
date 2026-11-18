// Normalisatie van antwoorden en uitbreiding van antwoordpatronen.

/**
 * Maakt een antwoord vergelijkbaar: Unicode-normalisatie, typografische tekens
 * gelijktrekken, leestekens weghalen, spaties samenvoegen en (standaard) kleine letters.
 */
export function normalize(input, { caseSensitive = false } = {}) {
  const s = String(input ?? '')
    .normalize('NFC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[.,!?;:"“”„«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return caseSensitive ? s : s.toLocaleLowerCase('sv');
}

/**
 * Breidt een patroon uit tot alle varianten.
 *   [tekst]  → optioneel
 *   {a|b}    → keuze
 * Voorbeeld: "[Nej, ]han {talar|pratar} inte" → 4 varianten.
 */
export function expand(pattern) {
  const m = String(pattern).match(/\[([^[\]{}]*)\]|\{([^{}[\]]*)\}/);
  if (!m) return [String(pattern)];
  const before = pattern.slice(0, m.index);
  const after = pattern.slice(m.index + m[0].length);
  const options = m[1] !== undefined ? [m[1], ''] : m[2].split('|');
  return options.flatMap((o) => expand(before + o + after));
}

/** Alle genormaliseerde varianten van een lijst antwoordpatronen. */
export function variants(answers, opts) {
  const list = [].concat(answers ?? []);
  return [...new Set(list.flatMap((a) => expand(a)).map((a) => normalize(a, opts)))];
}

/** Het antwoord zoals het aan de gebruiker getoond wordt (eerste, volledigste variant). */
export function displayAnswer(answers) {
  const first = [].concat(answers ?? [])[0];
  return first === undefined ? '' : expand(String(first))[0].replace(/\s+/g, ' ').trim();
}

export const tokens = (s) => s.split(' ').filter(Boolean);
