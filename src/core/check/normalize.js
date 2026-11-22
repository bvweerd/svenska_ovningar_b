// Normalisatie van antwoorden en uitbreiding van antwoordpatronen.

/**
 * Maakt een antwoord vergelijkbaar: Unicode-normalisatie, typografische tekens
 * gelijktrekken, leestekens weghalen, spaties samenvoegen en (standaard) kleine letters.
 * caseSensitive: hoofdletters tellen, behalve die van het eerste woord.
 */
export function normalize(input, { caseSensitive = false } = {}) {
  const s = String(input ?? '')
    .normalize('NFC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[.,!?;:"“”„«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Hoofdlettergevoelig gaat over woorden midden in de zin (dagen, maanden, talen). De hoofdletter
  // aan het begin telt niet: woordtegels beginnen altijd met een kleine letter.
  return foldVariants(caseSensitive ? s.charAt(0).toLocaleUpperCase('sv') + s.slice(1) : s.toLocaleLowerCase('sv'));
}

// Spellingsvarianten die allebei correct zijn (SAOL), zodat elk antwoordpatroon ze
// automatisch allebei goedkeurt: "i dag" = "idag", "sade" = "sa", "lade" = "la", "ned" = "ner".
const TIME_WORDS = 'dag|går|morgon|kväll|morse|natt|övermorgon|förrgår';
const TIME_RE = new RegExp(`(^| )([iI]) (${TIME_WORDS})(?= |$)`, 'gu');
const PRET_RE = /(^| )([sSlL])ade(?= |$)/gu;
const NED_RE = /(^| )([nN])ed(?= |$)/gu;

function foldVariants(s) {
  return s.replace(TIME_RE, '$1$2$3').replace(PRET_RE, '$1$2a').replace(NED_RE, '$1$2er');
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
