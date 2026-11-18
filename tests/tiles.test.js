import { describe, it, expect, beforeEach } from 'vitest';
import { answerTiles, distractorTiles, isSentence, setKnownWords } from '../src/render/tiles.js';

describe('woordtegels', () => {
  beforeEach(() => setKnownWords(['jag', 'mötet', 'det'], ['Anna']));
  it('maakt tegels van het eerste antwoord, zonder leestekens', () => {
    expect(answerTiles(['Mötet hölls {i går|igår} klockan tre.'])).toEqual(['mötet', 'hölls', 'i', 'går', 'klockan', 'tre']);
  });
  it('houdt namen met een hoofdletter', () => {
    expect(answerTiles(['Anna sa att hon var trött.'])[0]).toBe('Anna');
  });
  it('afleiders komen uit feedback en bronzin, niet uit het antwoord', () => {
    const d = distractorTiles({ answers: ['Mötet hölls i går.'], feedback: [{ match: 'Mötet hålls i går.', tip: 'x' }] }, { source: 'Mötet hålls i går.' });
    expect(d).toEqual(['hålls']);
  });
  it('maximaal drie afleiders', () => {
    const d = distractorTiles({ answers: ['ett två tre.'] }, { source: 'fyra fem sex sju åtta' });
    expect(d.length).toBe(3);
  });
  it('korte antwoorden zijn geen zin', () => {
    expect(isSentence(['förra året'])).toBe(false);
    expect(isSentence(['Jag har ingen bil.'])).toBe(true);
  });
});
