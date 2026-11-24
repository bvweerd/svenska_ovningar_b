import { describe, it, expect } from 'vitest';
import { report, loadChapters, forms, tokens, swedishOf, strand } from '../scripts/content-report.mjs';
import { root, name } from '../scripts/sibling.mjs';
import { verantwoording } from '../scripts/verantwoording.mjs';

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

  it('maakt de gegevens voor de pagina Verantwoording', () => {
    const d = verantwoording(loadChapters(root));
    expect(d.totals.chapters).toBe(d.chapters.length);
    expect(d.totals.questions).toBe(d.chapters.reduce((n, c) => n + c.qs, 0));
    const s = d.totals.strands;
    expect(s.input + s.output + s.vorm).toBe(d.totals.questions);
    for (const c of d.chapters) {
      expect(c.used).toBeLessThanOrEqual(c.vocab);
      expect(c.feedback).toBeLessThanOrEqual(c.produce);
    }
    // Geen Markdown in de aandachtspunten: de pagina toont gewone tekst.
    for (const a of d.attention) expect(a.text).not.toMatch(/`|\*\*/);
  });
});
