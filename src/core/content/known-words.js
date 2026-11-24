// Woorden uit de oefenstof (voor de woordtegels: welke woorden een kleine letter krijgen).
import { expand } from '../check/normalize.js';

// Woorden uit de oefenstof: met kleine letter midden in een zin, en namen (hoofdletter midden in een zin).
export function knownWords(course) {
  const out = new Set();
  const names = new Set();
  const add = (pattern) => {
    const ws = expand(String(pattern))[0].split(/\s+/).slice(1);
    for (const w of ws) {
      const clean = w.replace(/[^\p{L}-]/gu, '');
      if (clean && clean === clean.toLowerCase()) out.add(clean);
      else if (clean) names.add(clean);
    }
  };
  const visit = (item) => {
    for (const a of item.answers ?? []) add(a);
    for (const a of item.correction?.answers ?? []) add(a);
    for (const g of item.gaps ?? []) for (const a of g.answers ?? []) add(a);
    (item.steps ?? []).forEach(visit);
  };
  for (const ch of course) for (const ex of ch.exercises ?? []) ex.items.forEach(visit);
  return [out, names];
}
