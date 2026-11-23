import { describe, it, expect } from 'vitest';
import { loadChapters } from '../scripts/content-report.mjs';
import { root } from '../scripts/sibling.mjs';
import { swedishTexts, unknownWords, loadAllowed, misspelled, hasHunspell } from '../scripts/spelling.mjs';

// In CI is hunspell er altijd (test.yml installeert het); daar faalt de test als het ontbreekt.
describe.runIf(hasHunspell() || process.env.CI)('spelling van het Zweeds (hunspell sv_SE + content/stavning.txt)', () => {
  const chapters = loadChapters(root);

  it('elk woord staat in het woordenboek of in de lijst met goedgekeurde woorden', () => {
    const bad = unknownWords(chapters, loadAllowed());
    const lines = [...bad].map(([w, where]) => `${w}  (${[...where].slice(0, 3).join('; ')})`);
    expect(lines, 'Tikfout? Verbeter hem. Goed woord? Zet het in content/stavning.txt (npm run spelling -- --write).').toEqual([]);
  });

  it('de lijst bevat geen woorden die het woordenboek al kent of die nergens meer voorkomen', () => {
    const allowed = [...loadAllowed()];
    const known = misspelled(allowed);
    const used = new Set(chapters.flatMap((ch) => swedishTexts(ch)).flatMap(([, t]) => (t.match(/\p{L}+/gu) ?? []).map((w) => w.toLowerCase())));
    const extra = allowed.filter((w) => !known.has(w) || !used.has(w));
    expect(extra).toEqual([]);
  });

  it('herkent een tikfout en laat de foute zin van „Zoek de fout” en Nederlands tussen haakjes met rust', () => {
    const ch = {
      chapter: 1,
      vocab: [{ sv: 'en lampa', def: 'lampan', ex: 'Vi köper en **lampa**.' }],
      sections: [{ id: 'x', exercises: [{ id: 'e', items: [
        { id: 'a', type: 'translate', answers: ['Jag {heter|är} Bram.', 'Jag bor i Sveriqe.'] },
        { id: 'b', type: 'gap', text: 'en lampa → ___ (de lamp)', gaps: [{ answers: ['lampan'] }] },
        { id: 'c', type: 'findError', sentence: 'Bram läsar en tidning.', answers: ['Bram läser en tidning.'] },
      ] }] }],
    };
    expect([...unknownWords([ch], new Set(['bram'])).keys()]).toEqual(['Sveriqe']);
  });
});
