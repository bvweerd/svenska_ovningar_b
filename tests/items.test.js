// Het register van vraagtypen (core/items/) en de renderers (ui/items/) horen bij elkaar.
import { describe, it, expect } from 'vitest';
import { ITEM_TYPES, answerPart, selfChecking, isGradable, typeName } from '../src/core/items/index.js';
import { RENDERERS } from '../src/ui/items/index.js';

describe('register van vraagtypen', () => {
  it('elk type heeft een renderer en andersom', () => {
    expect(Object.keys(RENDERERS).sort()).toEqual(Object.keys(ITEM_TYPES).sort());
  });

  it('elk type heeft een naam en een controle', () => {
    for (const t of Object.values(ITEM_TYPES)) {
      expect(typeof t.name, t.type).toBe('string');
      expect(typeof t.validate, t.type).toBe('function');
    }
  });

  it('antwoorddeel zonder eigen regel: type en antwoorden', () => {
    expect(answerPart({ type: 'translate', prompt: 'x', answers: ['a'] })).toEqual(['translate', ['a']]);
    expect(answerPart({ type: 'steps', steps: [{ type: 'mc', options: ['a', 'b'], answer: 1 }, { type: 'free' }] }))
      .toEqual(['steps', [['mc', 'b'], ['free']]]);
  });

  it('zelf nakijken en nakijkbaar', () => {
    expect(selfChecking({ type: 'mc' })).toBe(true);
    expect(selfChecking({ type: 'gap', gaps: [{ answers: ['a'] }] })).toBe(false);
    expect(selfChecking({ type: 'steps', steps: [{ type: 'listen', options: ['a'] }] })).toBe(true);
    expect(isGradable({ type: 'free' })).toBe(false);
    expect(isGradable({ type: 'gap' })).toBe(true);
    expect(typeName('findError')).toBe('zoek de fout');
  });
});

describe('hints verklappen het antwoord niet', () => {
  it('zinsbouw met een vast begin: geen volgend woord (dat verklapt de inversie)', async () => {
    const { hintFor } = await import('../src/core/items/index.js');
    const item = { type: 'order', start: 'På morgonen', tokens: ['dricker', 'Bram', 'kaffe'], answers: ['På morgonen dricker Bram kaffe.'] };
    expect(hintFor(item)).toBe(null);
    expect(hintFor({ ...item, help: 'Het werkwoord staat op de tweede plaats.' })).toBe('Het werkwoord staat op de tweede plaats.');
  });
  it('invullen: geen beginletters', async () => {
    const { hintFor } = await import('../src/core/items/index.js');
    expect(hintFor({ type: 'gap', text: 'Vi ___ (äta) pizza.', gaps: [{ answers: ['åt'] }] })).toBe(null);
  });
  it('woord vertalen: beginletters van het woord, niet het lidwoord', async () => {
    const { hintFor } = await import('../src/core/items/index.js');
    expect(hintFor({ type: 'translate', prompt: 'een ambulance', answers: ['en ambulans'] })).toBe('Het Zweedse woord begint met „am…”.');
    expect(hintFor({ type: 'translate', prompt: 'trots', answers: ['stolt'] })).toBe('Het Zweedse woord begint met „s…”.');
    // Een woord van 1–2 letters: alleen de lengte (de beginletter zou het antwoord bijna verklappen).
    expect(hintFor({ type: 'translate', prompt: 'wonen', answers: ['att bo'] })).toBe('Het Zweedse woord heeft twee letters.');
    expect(hintFor({ type: 'translate', prompt: 'eiland', answers: ['en ö'] })).toBe('Het Zweedse woord heeft één letter.');
    expect(hintFor({ type: 'translate', prompt: 'zich aankleden', answers: ['att klä på sig'] })).toBe('Het antwoord begint met „kl…”.');
    expect(hintFor({ type: 'translate', prompt: 'Ik woon in Utrecht.', answers: ['Jag bor i Utrecht.'] })).toBe('Het antwoord begint met „Jag …”.');
  });
  it('een help op oefeningniveau geldt voor elke vraag zonder eigen help', async () => {
    const { buildChapter } = await import('../src/core/content/build.js');
    const gaps = [{ answers: ['åt'] }];
    const ch = buildChapter({ chapter: 1, sections: [{ id: 's', exercises: [{ id: 'e', help: 'Regel.', items: [{ id: 1, type: 'gap', gaps }, { id: 2, type: 'gap', gaps, help: 'Eigen.' }, { id: 3, type: 'gap', gaps: [{ answers: ['a'], options: ['a', 'b'] }] }] }] }] });
    expect(ch.exercises[0].items.map((it) => it.help)).toEqual(['Regel.', 'Eigen.', undefined]);
  });
  it('anders de hint van de grammaticakaart bij het topic', async () => {
    const { buildChapter } = await import('../src/core/content/build.js');
    const cardHints = new Map([['starka-verb', 'De klinker verandert.']]);
    const ch = buildChapter({ chapter: 4, sections: [{ id: 's', exercises: [{ id: 'e', topic: 'starka-verb', items: [{ id: 1, type: 'gap', gaps: [{ answers: ['åt'] }] }, { id: 2, type: 'translate', prompt: 'Ik at.', answers: ['Jag åt.'] }] }] }] }, { cardHints });
    expect(ch.exercises[0].items.map((it) => it.help)).toEqual(['De klinker verandert.', undefined]);
  });
});
