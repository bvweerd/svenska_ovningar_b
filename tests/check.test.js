import { describe, it, expect } from 'vitest';
import { normalize, expand, variants, displayAnswer } from '../src/check/normalize.js';
import { diagnose } from '../src/check/diagnose.js';
import { gradeText, gradeMulti, gradeMatch, gradeDialogue, gradeOrder, clockSpec } from '../src/check/grade.js';
import { swedishTime } from '../src/check/clock.js';
import { markdown } from '../src/md.js';

describe('normalize', () => {
  it('negeert hoofdletters, leestekens en spaties', () => {
    expect(normalize('  Jag  heter Bram! ')).toBe('jag heter bram');
    expect(normalize('Nej, jag talar inte finska.')).toBe('nej jag talar inte finska');
  });
  it('houdt å, ä en ö', () => expect(normalize('ÄPPLET')).toBe('äpplet'));
});

describe('expand', () => {
  it('optioneel en keuze', () => {
    expect(expand('[Nej, ]han {talar|pratar}').sort()).toEqual(['Nej, han pratar', 'Nej, han talar', 'han pratar', 'han talar']);
  });
  it('toont de volledigste variant', () => expect(displayAnswer(['[Nej, ]han kommer.'])).toBe('Nej, han kommer.'));
});

describe('diagnose', () => {
  const d = (input, answers, ctx) => diagnose(normalize(input), variants(answers), ctx);
  it('herkent fout op å/ä/ö', () => expect(d('ar', ['är']).kind).toBe('diacritic'));
  it('herkent woordvolgorde (V2)', () => expect(d('Idag Fleur jobbar hemma', ['Idag jobbar Fleur hemma']).kind).toBe('order'));
  it('geeft vraag-tip bij topic vragen', () => expect(d('du talar svenska', ['talar du svenska'], { topic: 'vragen' }).tip).toMatch(/vraag/));
  it('herkent verkeerde plaats van inte', () => expect(d('jag inte talar finska', ['jag talar inte finska']).kind).toBe('inte'));
  it('herkent verkeerde uitgang', () => expect(d('köpar', ['köper']).kind).toBe('ending'));
  it('herkent en/ett-uitgang', () => expect(d('huset', ['husen']).kind).toBe('gender'));
  it('herkent en/ett-lidwoord', () => expect(d('en hus', ['ett hus']).kind).toBe('gender'));
  it('herkent vergeten lidwoord', () => expect(d('bil', ['en bil']).kind).toBe('article'));
  it('herkent een ontbrekend woord in een zin', () => expect(d('jag talar finska', ['jag talar inte finska']).kind).toBe('missing'));
  it('herkent een spelfout', () => expect(d('tidnig', ['tidning']).kind).toBe('spelling'));
  it('ontbrekende uitgang is geen spelfout', () => expect(d('huse', ['huset']).kind).not.toBe('spelling'));
  it('geeft niets bij totaal ander antwoord', () => expect(d('hund', ['katt'])).toBeNull());
});

describe('gradeText', () => {
  it('accepteert varianten', () => {
    expect(gradeText('nej vi pratar inte finska', { answers: ['[Nej, ]vi {talar|pratar} inte finska.'] }).correct).toBe(true);
  });
  it('gebruikt eigen feedback vóór algemene analyse', () => {
    const r = gradeText('läsar', { answers: ['läser'], feedback: [{ match: 'läsar', tip: 'groep 2' }] });
    expect(r).toMatchObject({ correct: false, kind: 'feedback', tip: 'groep 2' });
  });
  it('meldt lege invoer', () => expect(gradeText(' ', { answers: ['x'] }).empty).toBe(true));
});

describe('andere vraagtypen', () => {
  it('multi met deelscore-tip', () => {
    expect(gradeMulti([0, 1], { answers: [0, 2] }).tip).toMatch(/1 van je keuzes is niet goed en je mist er nog 1/);
    expect(gradeMulti([2, 0], { answers: [0, 2] }).correct).toBe(true);
  });
  it('match', () => {
    expect(gradeMatch([0, 1], { pairs: [[1, 2], [3, 4]] }).correct).toBe(true);
    expect(gradeMatch([1, 0], { pairs: [[1, 2], [3, 4]] }).fields).toEqual([false, false]);
  });
  it('dialogue', () => expect(gradeDialogue([0, 2, 1], {}).tip).toMatch(/Regel 2/));
  it('order met vast begin', () => {
    const item = { start: 'Idag', tokens: ['jobbar', 'jag'], answers: ['Idag jobbar jag.'] };
    expect(gradeOrder(['jobbar', 'jag'], item).correct).toBe(true);
    expect(gradeOrder(['jag', 'jobbar'], item).kind).toBe('order');
  });
});

describe('klok', () => {
  it.each([
    ['07:30', 'halv åtta'], ['08:55', 'fem i nio'], ['03:15', 'kvart över tre'], ['06:40', 'tjugo i sju'],
    ['09:00', 'nio'], ['01:35', 'fem över halv två'], ['04:25', 'fem i halv fem'], ['12:30', 'halv ett'], ['13:00', 'ett'],
  ])('%s → %s', (t, s) => expect(swedishTime(t)[0]).toBe(s));
  it('accepteert met en zonder "klockan är"', () => {
    const spec = clockSpec({ time: '07:30' });
    expect(gradeText('Klockan är halv åtta.', spec).correct).toBe(true);
    expect(gradeText('halv åtta', spec).correct).toBe(true);
  });
  it('geeft tip bij halv + verkeerd uur', () => {
    expect(gradeText('halv sju', clockSpec({ time: '07:30' })).kind).toBe('feedback');
  });
});

describe('markdown', () => {
  it('escapet html', () => expect(markdown('<b>x</b>')).not.toContain('<b>'));
  it('tabellen', () => expect(markdown('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<td>1</td>'));
});
