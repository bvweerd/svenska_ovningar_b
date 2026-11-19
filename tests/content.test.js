// Controleert alle oefenstof: structuur, en dat de nakijker de eigen antwoorden accepteert
// en de vastgelegde foute antwoorden afwijst.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { buildCourse } from '../src/build.js';
import { validateChapter } from '../src/validate.js';
import { gradeText, gradeOrder, clockSpec } from '../src/check/grade.js';
import { expand, normalize } from '../src/check/normalize.js';

const root = path.resolve(import.meta.dirname, '..', 'content');
const index = yaml.load(fs.readFileSync(path.join(root, 'index.yaml'), 'utf8'));
const files = fs.readdirSync(path.join(root, 'chapters')).filter((f) => f.endsWith('.yaml'));
const raw = files.map((f) => ({ file: f, data: yaml.load(fs.readFileSync(path.join(root, 'chapters', f), 'utf8')) }));
const course = buildCourse(index, raw.map((r) => r.data)).filter((c) => c.available);

function textSpecs(item) {
  switch (item.type) {
    case 'gap': return item.gaps.filter((g) => !g.options);
    case 'translate': return [item];
    case 'transform': return [item];
    case 'listen': return item.options ? [] : [{ ...item, answers: item.answers ?? [item.say] }];
    case 'table': return item.rows.flat().filter((c) => c && typeof c === 'object');
    case 'clock': return [clockSpec(item)];
    case 'truefalse': return item.correction ? [item.correction] : [];
    case 'findError': return [item];
    case 'steps': return item.steps.flatMap(textSpecs);
    default: return [];
  }
}
const allTopics = course.flatMap((c) => c.grammar.map((g) => g.id));
const allItems = (ex) => ex.items.flatMap((i) => (i.type === 'steps' ? [i, ...i.steps] : [i]));

it.runIf(index.levels)('elk hoofdstuk in index.yaml heeft een bekend niveau', () => {
  const ids = new Set(index.levels.map((l) => l.id));
  for (const c of index.chapters) expect(ids.has(c.level), `hoofdstuk ${c.chapter}`).toBe(true);
});

it('sorteren: elke categorie wordt gebruikt', () => {
  for (const ch of course) for (const ex of ch.exercises) for (const item of ex.items.filter((i) => i.type === 'sort')) {
    item.categories.forEach((_, c) => expect(item.items.some((x) => x.cat === c), `${ex.id}: categorie ${c}`).toBe(true));
  }
});

it('elk bestand hoort bij een hoofdstuk uit index.yaml', () => {
  const known = new Set(index.chapters.map((c) => c.chapter));
  for (const r of raw) expect(known.has(r.data.chapter), r.file).toBe(true);
});

it('een woord in meer hoofdstukken heeft overal dezelfde vertaling en vormen', () => {
  const first = new Map();
  for (const ch of course) for (const v of ch.vocab ?? []) {
    const key = v.sv.toLowerCase();
    const sig = JSON.stringify([v.nl, v.def ?? null, v.pl ?? null]);
    if (!first.has(key)) first.set(key, { ch: ch.chapter, sig });
    else if (first.get(key).sig !== sig) {
      // Een bewust andere betekenis mag, maar dan met dezelfde vormen.
      const [, def, pl] = JSON.parse(first.get(key).sig);
      expect([v.def ?? null, v.pl ?? null], `${v.sv}: hoofdstuk ${first.get(key).ch} en ${ch.chapter}`).toEqual([def, pl]);
    }
  }
});

for (const ch of course) {
  describe(`hoofdstuk ${ch.chapter}`, () => {
    it('grammatica-id’s zijn uniek over de hele cursus', () => {
      for (const g of ch.grammar) expect(allTopics.filter((t) => t === g.id).length, g.id).toBe(1);
    });

    it('heeft een geldige structuur', () => expect(validateChapter(ch, allTopics)).toEqual([]));

    it('accepteert alle eigen antwoorden', () => {
      for (const ex of ch.exercises) for (const item of allItems(ex)) for (const spec of textSpecs(item)) {
        for (const a of spec.answers) for (const v of expand(a)) {
          expect(gradeText(v, spec).correct, `${ex.id}: "${v}"`).toBe(true);
          expect(v.includes('|') || v.includes('{') || v.includes('['), `${ex.id}: patroon niet goed uitgeklapt: "${v}"`).toBe(false);
        }
      }
    });

    it('wijst alle vastgelegde fouten af', () => {
      for (const ex of ch.exercises) for (const item of allItems(ex)) for (const spec of textSpecs(item)) {
        for (const f of spec.feedback ?? []) for (const m of [].concat(f.match ?? [])) for (const v of expand(m)) {
          expect(gradeText(v, spec).correct, `${ex.id}: fout "${v}" wordt goed gerekend`).toBe(false);
          expect(f.tip, `${ex.id}: lege tip`).toBeTruthy();
        }
      }
    });

    it('zinsbouw: de tegels vormen precies een goed antwoord', () => {
      for (const ex of ch.exercises) for (const item of allItems(ex).filter((i) => i.type === 'order')) {
        const words = (s) => normalize(s).split(' ').sort().join(' ');
        const tiles = words([item.start, ...item.tokens].filter(Boolean).join(' '));
        for (const a of item.answers) expect(words(expand(a)[0]), `${ex.id}: ${a}`).toBe(tiles);
        expect(gradeOrder(item.tokens, item).correct !== undefined).toBe(true);
      }
    });

    it('zoek de fout: de zin zelf wordt niet goed gerekend', () => {
      for (const ex of ch.exercises) for (const item of allItems(ex).filter((i) => i.type === 'findError')) {
        expect(gradeText(item.sentence, item).correct, `${ex.id}: ${item.sentence}`).toBe(false);
      }
    });

    it('gap met keuzelijst: antwoord staat tussen de opties', () => {
      for (const ex of ch.exercises) for (const item of allItems(ex).filter((i) => i.type === 'gap')) {
        for (const g of item.gaps.filter((x) => x.options)) expect(g.options).toContain(g.answers[0]);
      }
    });
  });
}

// ---------- Opbouw (fase 1b van het verbeterplan, PLAN.md) ----------
// Vaste volgorde van de onderdelen. Onbekende id's zijn grammatica-onderdelen (B-site).
// A-site: woorden → oefeningen → luisteren → herhaling → woordenschat.
// B-site: woorden in „ord” → läsa → ord → grammatica → zoek de fout → lyssna → praktiskt → skriva → herhaling → woordenschat.
const SECTION_RANK = { woorden: 0, lasa: 1, ord: 2, oefeningen: 3, 'zoek-de-fout': 4, luisteren: 5, lyssna: 5, praktiskt: 6, skriva: 7, herhaling: 8, eindtoets: 8, woordenschat: 9 };
const GRAMMAR_RANK = 3;
// Binnen „oefeningen” (A-site): eerst de onderwerpen en gemengd, dan zoek de fout, dan lezen, dialoog, schrijven.
const exercisePhase = (ex) => {
  const types = new Set(ex.items.map((i) => i.type));
  if (ex.text && !ex.listen) return 2;
  if (types.size === 1 && types.has('findError')) return 1;
  if (types.size === 1 && types.has('dialogue')) return 3;
  if (types.size === 1 && types.has('free')) return 4;
  return 0;
};
const home = new Map(course.flatMap((c) => c.grammar.map((g) => [g.id, c.chapter])));

describe('opbouw van de hoofdstukken', () => {
  for (const ch of course) {
    it(`hoofdstuk ${ch.chapter}: onderdelen in de vaste volgorde`, () => {
      const ranks = ch.sections.map((s) => [s.id, SECTION_RANK[s.id] ?? GRAMMAR_RANK]);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i][1], `${ranks[i - 1][0]} hoort na ${ranks[i][0]}`).toBeGreaterThanOrEqual(ranks[i - 1][1]);
      }
    });

    it(`hoofdstuk ${ch.chapter}: oefeningen eerst, dan zoek de fout, lezen, dialoog en schrijven`, () => {
      for (const s of ch.sections.filter((x) => x.id === 'oefeningen')) {
        const phases = s.exercises.map((ex) => [ex.id, exercisePhase(ex)]);
        for (let i = 1; i < phases.length; i++) {
          expect(phases[i][1], `${phases[i][0]} staat na ${phases[i - 1][0]}`).toBeGreaterThanOrEqual(phases[i - 1][1]);
        }
      }
    });

    it(`hoofdstuk ${ch.chapter}: geen grammatica uit een later hoofdstuk`, () => {
      for (const ex of ch.exercises) for (const item of allItems(ex)) {
        const t = item.topic ?? ex.topic;
        if (home.has(t)) expect(home.get(t), `${ex.id}: topic ${t}`).toBeLessThanOrEqual(ch.chapter);
      }
    });

    it.runIf(ch.vocab?.length)(`hoofdstuk ${ch.chapter}: de eerste woordenoefening staat vooraan`, () => {
      const first = ch.sections.find((s) => s.id === 'woorden' || s.id === 'ord');
      expect(first?.exercises.some((ex) => ex.id === 'woorden-sv-nl')).toBe(true);
    });
  }
});
