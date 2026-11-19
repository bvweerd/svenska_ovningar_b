import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { verbItem, naiveForms, pretOptions, pickVerbItem, TENSES, KINDS } from '../src/verbs.js';
import { gradeText } from '../src/check/grade.js';

const verbs = yaml.load(fs.readFileSync(path.resolve(import.meta.dirname, '../content/verbs.yaml'), 'utf8')).verbs;

describe('werkwoordenlijst', () => {
  it('heeft voor elk werkwoord alle vormen en een geldige soort', () => {
    for (const v of verbs) {
      for (const k of ['inf', 'nl', 'kind', 'pres', 'pret', 'sup']) expect(v[k], `${v.inf}.${k}`).toBeTruthy();
      expect(Object.keys(KINDS)).toContain(v.kind);
      // Partikelwerkwoorden: elke vorm eindigt op hetzelfde partikel als de infinitief.
      if (v.kind === 'partikel') {
        const rest = v.inf.slice(v.inf.indexOf(' '));
        for (const t of Object.keys(TENSES)) for (const f of [].concat(v[t] ?? [])) expect(f.endsWith(rest), `${v.inf} ${t} ${f}`).toBe(true);
      }
    }
    expect(new Set(verbs.map((v) => v.inf)).size).toBe(verbs.length);
  });

  it('regelmatige werkwoorden volgen hun patroon', () => {
    for (const v of verbs.filter((x) => x.kind === 'ar')) {
      expect(v.pret, v.inf).toBe(`${v.inf.slice(0, -1)}ade`);
      expect(v.sup, v.inf).toBe(`${v.inf.slice(0, -1)}at`);
    }
    for (const v of verbs.filter((x) => x.kind === 'kort')) expect(v.pret, v.inf).toBe(`${v.inf}dde`);
  });
});

describe('vragen', () => {
  it('elke vraag accepteert de goede vorm en wijst gangbare fouten af', () => {
    for (const v of verbs) for (const t of Object.keys(TENSES)) {
      if (!v[t]) continue;
      const item = verbItem(v, t);
      const spec = item.gaps[0];
      for (const f of [].concat(v[t])) expect(gradeText(f, spec).correct, `${v.inf} ${t} ${f}`).toBe(true);
      for (const fb of spec.feedback) for (const m of fb.match) expect(gradeText(m, spec).correct, `${v.inf} ${t} fout ${m}`).toBe(false);
    }
  });

  it('supinum mag met of zonder har', () => {
    const spec = verbItem(verbs.find((v) => v.inf === 'skriva'), 'sup').gaps[0];
    expect(gradeText('har skrivit', spec).correct).toBe(true);
    expect(gradeText('skrivit', spec).correct).toBe(true);
  });

  it('herkent een vorm van een andere tijd', () => {
    const spec = verbItem(verbs.find((v) => v.inf === 'äta'), 'pret').gaps[0];
    expect(gradeText('ätit', spec).tip).toMatch(/supinum/);
    expect(gradeText('ätade', spec).tip).toMatch(/sterk/);
  });

  it('kiest alleen uit de gekozen soorten en tijden', () => {
    for (let i = 0; i < 50; i++) {
      const q = pickVerbItem(verbs, { tenses: ['pret'], kinds: ['sterk'] });
      expect(q.verb.kind).toBe('sterk');
      expect(q.tense).toBe('pret');
    }
    expect(pickVerbItem(verbs, { tenses: [], kinds: ['ar'] })).toBeNull();
  });

  it('partikelwerkwoord: tip bij een vergeten partikel en bij een verkeerd vervoegd werkwoord', () => {
    const ta = { inf: 'ta upp', nl: 'oppakken', kind: 'partikel', pres: 'tar upp', pret: 'tog upp', sup: 'tagit upp', imp: 'ta upp' };
    const spec = verbItem(ta, 'pret').gaps[0];
    expect(gradeText('tog upp', spec).correct).toBe(true);
    expect(gradeText('tog', spec).tip).toMatch(/Vergeet „upp”/);
    expect(gradeText('tade upp', spec).tip).toMatch(/partikelwerkwoord/);
    const sup = verbItem(ta, 'sup').gaps[0];
    expect(gradeText('har tagit upp', sup).correct).toBe(true);
    expect(gradeText('har tagit', sup).tip).toMatch(/Vergeet/);
  });

  it('spel: drie verschillende opties met de goede erbij', () => {
    for (const v of verbs) {
      const { correct, options } = pretOptions(v);
      expect(options).toContain(correct);
      expect(new Set(options).size).toBe(options.length);
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
    expect(naiveForms(verbs.find((v) => v.inf === 'jobba'), 'pret')).not.toContain('jobbade');
  });
});
