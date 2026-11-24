// Hulpjes om van een vraag de goede Zweedse zin te maken (om voor te lezen).

/** Haakjes met hints, opmaak en dubbele spaties weg. */
export const stripHints = (s) => String(s)
  .replace(/\s*\([^)]*\)/g, '')
  .replace(/\*\*|\*/g, '')
  .replace(/\s+([.,!?])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// "**stanna** (blijven): Vi ___ hemma." → "Vi ___ hemma."
export const cutLabel = (s) => {
  const blank = s.indexOf('___');
  const colon = s.lastIndexOf(': ', blank < 0 ? s.length : blank);
  return colon >= 0 ? s.slice(colon + 2) : s;
};
