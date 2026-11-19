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
  it('stelt i dag/idag, sade/sa en lade/la gelijk', () => {
    expect(normalize('I dag jobbar jag')).toBe(normalize('Idag jobbar jag'));
    expect(normalize('Vi ses i morgon!')).toBe(normalize('Vi ses imorgon'));
    expect(normalize('Hon sade nej')).toBe(normalize('Hon sa nej'));
    expect(normalize('Han lade boken där')).toBe(normalize('Han la boken där'));
    expect(normalize('i dagens tidning')).toBe('i dagens tidning');
    expect(gradeText('I går var jag sjuk.', { answers: ['Igår var jag sjuk.'] }).correct).toBe(true);
  });
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

describe('tijdsbepaling vooraan of achteraan', () => {
  const spec = { answers: ['{På kvällen|På kvällarna} tittar Bram på {tv|teve}.'] };
  it('keurt de tijdsbepaling achteraan goed, met een opmerking', () => {
    const r = gradeText('Bram tittar på tv på kvällen.', spec);
    expect(r).toMatchObject({ correct: true, moved: true });
    expect(r.note).toContain('På kvällen tittar Bram på tv.');
  });
  it('keurt de tijdsbepaling vooraan goed als het model hem achteraan heeft', () => {
    expect(gradeText('I dag har jag inte tid.', { answers: ['Jag har inte tid idag.'] }).correct).toBe(true);
    expect(gradeText('På lördag åker vi till Göteborg.', { answers: ['Vi åker till Göteborg på lördag.'] }).correct).toBe(true);
  });
  it('houdt „inte” op zijn plek', () => {
    const s = { answers: ['På kvällen tittar Bram inte på tv.'] };
    expect(gradeText('Bram tittar inte på tv på kvällen', s).correct).toBe(true);
    expect(gradeText('Bram inte tittar på tv på kvällen', s).correct).toBe(false);
  });
  it('geen inversie vergeten en geen andere zinsdelen naar voren', () => {
    expect(gradeText('I dag jag har inte tid', { answers: ['Jag har inte tid idag.'] }).correct).toBe(false);
    expect(gradeText('På bussen väntar jag', { answers: ['Jag väntar på bussen.'] }).correct).toBe(false);
    expect(gradeText('På tv tittar Bram på kvällen', spec).correct).toBe(false);
  });
  it('laat samengestelde zinnen met rust', () => {
    expect(gradeText('Jag vet att han kommer på måndag på måndag', { answers: ['Jag vet att han kommer på måndag.'] }).correct).toBe(false);
    expect(gradeText('På måndag vet jag att han kommer', { answers: ['Jag vet att han kommer på måndag.'] }).correct).toBe(false);
  });
  it('vastgelegde fouten gaan voor', () => {
    const s = { answers: ['På kvällen tittar Bram på tv.'], feedback: [{ match: ['Bram tittar på tv på kvällen'], tip: 'Begin met de tijdsbepaling.' }] };
    expect(gradeText('Bram tittar på tv på kvällen', s)).toMatchObject({ correct: false, tip: 'Begin met de tijdsbepaling.' });
  });
});

describe('vaste volgorde (fixedOrder)', () => {
  const spec = { answers: ['På kvällen tittar Bram på tv.'] };
  it('andere goede volgorde: geen fout, wel de opdracht volgen', () => {
    const r = gradeText('Bram tittar på tv på kvällen', spec, { fixedOrder: true });
    expect(r).toMatchObject({ correct: false, retry: true });
    expect(r.tip).toContain('tijdsbepaling');
    expect(gradeText('Bram tittar på tv på kvällen', { ...spec, fixedOrder: true })).toMatchObject({ retry: true });
  });
  it('de gevraagde volgorde blijft goed', () => {
    expect(gradeText('På kvällen tittar Bram på tv', spec, { fixedOrder: true }).correct).toBe(true);
  });
});

describe('woordenlijst: meervoud en voorbeeldzin', async () => {
  const { vocabExercises, exampleGap } = await import('../src/build.js');
  const vocab = [
    { sv: 'en buss', nl: 'een bus', def: 'bussen', pl: 'bussar', ex: 'Jag tar **bussen** till jobbet.', exNl: 'Ik neem de bus naar mijn werk.' },
    { sv: 'ett hus', nl: 'een huis', def: 'huset', pl: 'hus' },
    { sv: 'att springa', nl: 'rennen', ex: 'Hon **springer** varje morgon.', exNl: 'Zij rent elke ochtend.' },
  ];
  const exs = vocabExercises(vocab, 1, { pluralTopic: 'plural' });
  const byId = Object.fromEntries(exs.map((e) => [e.id, e]));
  it('maakt een meervoudsoefening met tips', () => {
    const it0 = byId['woorden-meervoud'].items[0];
    expect(byId['woorden-meervoud'].topic).toBe('plural');
    expect(gradeText('bussar', it0.gaps[0]).correct).toBe(true);
    expect(gradeText('bussen', it0.gaps[0]).tip).toContain('bepaalde vorm');
    expect(gradeText('buss', it0.gaps[0]).tip).toContain('enkelvoud');
  });
  it('„hus” blijft goed als meervoud gelijk is aan enkelvoud', () => {
    const it1 = byId['woorden-meervoud'].items[1];
    expect(gradeText('hus', it1.gaps[0]).correct).toBe(true);
  });
  it('maakt invulzinnen van de voorbeeldzinnen', () => {
    const items = byId['woorden-in-zin'].items;
    expect(items.map((i) => i.text)).toEqual(['Jag tar ___ till jobbet.', 'Hon ___ varje morgon.']);
    expect(gradeText('springer', items[1].gaps[0]).correct).toBe(true);
  });
  it('lange lijsten krijgen rondes', () => expect(byId['woorden-sv-nl'].roundSize).toBe(15));
  it('voorbeeldzin moet precies één vet stuk hebben', () => {
    expect(exampleGap('Jag **tar** **bussen**.')).toBe(null);
    expect(exampleGap('Geen vet')).toBe(null);
  });
});

describe('mix en toets: niet alleen woordenschat', async () => {
  const { balancedSample } = await import('../src/content.js');
  const { shuffle } = await import('../src/build.js');
  const entries = [
    ...Array.from({ length: 90 }, (_, i) => ({ ex: { generated: true }, i })),
    ...Array.from({ length: 30 }, (_, i) => ({ ex: {}, i: 100 + i })),
  ];
  it('hooguit een derde gegenereerde woordvragen', () => {
    const s = balancedSample(entries, 20, shuffle);
    expect(s).toHaveLength(20);
    expect(s.filter((e) => e.ex.generated).length).toBeLessThanOrEqual(6);
  });
  it('vult aan met woordvragen als er te weinig andere vragen zijn', () => {
    const s = balancedSample(entries.filter((e) => e.ex.generated || e.i < 105), 20, shuffle);
    expect(s).toHaveLength(20);
  });
});
