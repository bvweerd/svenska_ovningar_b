import { describe, it, expect } from 'vitest';
import { report, loadChapters, forms, tokens, swedishOf, strand } from '../scripts/content-report.mjs';
import { root, name } from '../scripts/sibling.mjs';

describe('rapport inhoud en didactiek', () => {
  it('herkent woordvormen uit de woordenlijst', () => {
    const verb = forms({ sv: 'att simma' });
    expect(verb.head).toBe('simma');
    expect(verb.stem).toBe('simm');
    const noun = forms({ sv: 'en resa', def: 'resan', pl: 'resor', plDef: 'resorna' });
    expect([...noun.exact]).toEqual(expect.arrayContaining(['resa', 'resan', 'resor', 'resorna']));
  });

  it('haalt alleen Zweeds uit een vraag, met alle varianten', () => {
    const sv = swedishOf({ type: 'translate', prompt: 'Ik zwem.', answers: ['Jag {simmar|badar}[ ofta].'] });
    expect(tokens(sv)).toEqual(['Jag', 'simmar', 'badar', 'ofta']);
  });

  it('deelt vragen in bij een strand', () => {
    const q = (item, ex = {}, section = 'oefeningen') => ({ item, parent: item, ex, section });
    expect(strand(q({ type: 'gap' }))).toBe('vorm');
    expect(strand(q({ type: 'mc' }, { text: 'Hej!' }))).toBe('input');
    expect(strand(q({ type: 'translate' }, { kind: 'situatie' }))).toBe('output');
  });

  it('maakt een rapport met alle onderdelen voor deze site', () => {
    const md = report({ site: name, chapters: loadChapters(root) });
    for (const h of ['## Aandachtspunten', '## Opbouw per hoofdstuk', '## Woordenschat', '## Teksten: bekende woorden', '## Grammatica', '## Kan-doen-uitspraken']) {
      expect(md).toContain(h);
    }
  });
});
