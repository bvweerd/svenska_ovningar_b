import { describe, it, expect } from 'vitest';
import { normalize, expand, variants, displayAnswer } from '../src/core/check/normalize.js';
import { diagnose } from '../src/core/check/diagnose.js';
import { gradeText, gradeMulti, gradeMatch, gradeDialogue, gradeOrder, clockSpec } from '../src/core/check/grade.js';
import { swedishTime } from '../src/core/check/clock.js';
import { markdown } from '../src/ui/md.js';

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
    expect(normalize('Vi lade ned företaget')).toBe(normalize('Vi la ner företaget'));
    expect(normalize('nedan')).toBe('nedan');
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
  it('dialogue', () => expect(gradeDialogue([0, 2, 1], {}).tip).toMatch(/regel 2/));
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
  it('doorgestreept, ook binnen cursief', () => {
    expect(markdown('niet: *~~Igår har jag köpt~~*')).toContain('<em><del>Igår har jag köpt</del></em>');
    expect(markdown('niet: *~~Igår har jag köpt~~*')).not.toContain('~~');
  });
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
  it('alleen het echte onderwerp, geen woordensla (H30: „Om tio år kommer robotar[ att] vara …”)', () => {
    const s = { answers: ['Om tio år kommer robotar [att ]{vara|utgöra} en självklar del {av|i} vården.'] };
    expect(gradeText('Robotar kommer vara en självklar del av vården om tio år', s).correct).toBe(true);
    expect(gradeText('Robotar kommer att vara en självklar del av vården om tio år', s).correct).toBe(true);
    expect(gradeText('Robotar vara kommer en självklar del av vården om tio år', s).correct).toBe(false);
    expect(gradeText('Robotar att kommer vara en självklar del av vården om tio år', s).correct).toBe(false);
    const back = { answers: ['Robotar kommer [att ]vara en självklar del av vården om tio år.'] };
    expect(gradeText('Om tio år kommer robotar vara en självklar del av vården', back).correct).toBe(true);
    expect(gradeText('Om tio år vara robotar kommer en självklar del av vården', back).correct).toBe(false);
  });
  it('onderwerp van meer woorden', () => {
    const s = { answers: ['Idag läser min bror tidningen.'] };
    expect(gradeText('Min bror läser tidningen idag', s).correct).toBe(true);
    expect(gradeText('Min läser bror tidningen idag', s).correct).toBe(false);
    expect(gradeText('Min bror tidningen läser idag', s).correct).toBe(false);
    expect(gradeText('På lördag kommer de flesta gästerna', { answers: ['De flesta gästerna kommer på lördag.'] }).correct).toBe(true);
  });
  it('onderwerp met „och”, bezittelijk voornaamwoord of genitief', () => {
    const both = (a, b) => {
      expect(gradeText(a, { answers: [b] })).toMatchObject({ correct: true, moved: true });
      expect(gradeText(b, { answers: [a] })).toMatchObject({ correct: true, moved: true });
    };
    both('Fleur och Bram tittar på tv på kvällen.', 'På kvällen tittar Fleur och Bram på tv.');
    both('Erik och jag springer på lördag.', 'På lördag springer Erik och jag.');
    both('Jag och Erik springer på lördag.', 'På lördag springer jag och Erik.');
    both('Min syster kommer i morgon.', 'I morgon kommer min syster.');
    both('Mina föräldrar flyttade förra året.', 'Förra året flyttade mina föräldrar.');
    both('Olles fru kommer idag.', 'Idag kommer Olles fru.');
    both('Bram och hans fru åker till Gotland i sommar.', 'I sommar åker Bram och hans fru till Gotland.');
    both('Min syster och hennes man kommer på fredag.', 'På fredag kommer min syster och hennes man.');
    // Geen woordensla.
    expect(gradeText('Olles kommer fru idag', { answers: ['Idag kommer Olles fru.'] }).correct).toBe(false);
    expect(gradeText('Idag fru Olles kommer', { answers: ['Olles fru kommer idag.'] }).correct).toBe(false);
    expect(gradeText('Fleur och tittar Bram på tv på kvällen', { answers: ['På kvällen tittar Fleur och Bram på tv.'] }).correct).toBe(false);
    expect(gradeText('Nils fotboll spelar nu', { answers: ['Nu spelar Nils fotboll.'] }).correct).toBe(false);
    expect(gradeText('Nils spelar fotboll nu', { answers: ['Nu spelar Nils fotboll.'] }).correct).toBe(true);
  });
  it('gevallen uit de inhoud: var, telwoorden, till', () => {
    const ok = (a, b) => expect(gradeText(a, { answers: [b] }).correct).toBe(true);
    const no = (a, b) => expect(gradeText(a, { answers: [b] }).correct).toBe(false);
    ok('Det var soligt på lördagen', 'På lördagen var det soligt.');
    ok('I trettio år har hon bott i huset', 'Hon har bott i huset i trettio år.');
    ok('Till den 15 maj behöver du inte vänta', 'Du behöver inte vänta till den 15 maj.');
    no('Till torsdag kan du ringa Karin från måndag', 'Du kan ringa Karin från måndag till torsdag.');
    no('Till torsdag kan du ringa Karin måndag', 'Du kan ringa Karin måndag till torsdag.');
    no('Till 1177 ringde han först', 'Han ringde till 1177 först.');
    // Twee werkwoorden met „och” is geen onderwerp met „och”.
    no('Jag och äter duschar frukost på morgonen', 'På morgonen duschar jag och äter frukost.');
  });
  it('haalt de tijdsbepaling niet uit een bijzin (H15 zdmz: dit)', () => {
    const s = { answers: ['Jag {ska åka|åker} till Gotland, dit mina föräldrar flyttade {förra året|i fjol}.'] };
    expect(gradeText('Jag åker till Gotland, dit mina föräldrar flyttade förra året', s).correct).toBe(true);
    expect(gradeText('Förra året åker jag till Gotland, dit mina föräldrar flyttade', s).correct).toBe(false);
    expect(gradeText('I fjol åker jag till Gotland dit mina föräldrar flyttade', s).correct).toBe(false);
    // Ook zonder komma: dit, där, vars, när enz. beginnen een bijzin.
    for (const w of ['dit', 'där', 'vars', 'när', 'som', 'medan', 'innan', 'tills', 'fastän']) {
      expect(gradeText(`Igår ser jag huset ${w} hon bor`, { answers: [`Jag ser huset ${w} hon bor igår.`] }).correct).toBe(false);
    }
    // Aan het eind is dit/där een plaatsbepaling: dan mag het wel.
    expect(gradeText('Imorgon åker vi dit', { answers: ['Vi åker dit imorgon.'] }).correct).toBe(true);
    expect(gradeText('Vi har bott där i tre år', { answers: ['I tre år har vi bott där.'] }).correct).toBe(true);
    expect(gradeText('Idag stannar jag hemma så att jag kan vila', { answers: ['Jag stannar hemma så att jag kan vila idag.'] }).correct).toBe(false);
  });
  it('de tijdsbepaling slokt geen werkwoord of onderwerp op en laat geen voorzetsel achter', () => {
    const s = { answers: ['Varje kväll tittar Bram på tv.'] };
    expect(gradeText('Bram tittar på tv varje kväll', s).correct).toBe(true);
    expect(gradeText('Tv på varje kväll tittar Bram', s).correct).toBe(false);
    expect(gradeText('På Bram tv varje kväll tittar', s).correct).toBe(false);
    expect(gradeText('Ett år har de bott i Västerås i nästan', { answers: ['De har bott i Västerås i nästan ett år.'] }).correct).toBe(false);
    expect(gradeText('I nästan ett år har de bott i Västerås', { answers: ['De har bott i Västerås i nästan ett år.'] }).correct).toBe(true);
    expect(gradeText('Igår har jag haft feber sen', { answers: ['Jag har haft feber sen igår.'] }).correct).toBe(false);
    expect(gradeText('På middag blev jag bjuden', { answers: ['Jag blev bjuden på middag.'] }).correct).toBe(false);
    expect(gradeText('På fredagar slutar Bram klockan tre', { answers: ['Bram slutar klockan tre på fredagar.'] }).correct).toBe(true);
  });
  it('vragen en bijzinnen zonder att blijven zoals ze zijn', () => {
    expect(gradeText('Nu bor var ni', { answers: ['Var bor ni nu?'] }).correct).toBe(false);
    expect(gradeText('Idag Fleur jobbar hemma', { answers: ['Jobbar Fleur hemma idag?'] }).correct).toBe(false);
    expect(gradeText('Imorgon tror jag Olle kommer', { answers: ['Jag tror Olle kommer imorgon.'] }).correct).toBe(false);
    expect(gradeText('På torsdag hoppas jag jag mår bättre', { answers: ['Jag hoppas jag mår bättre på torsdag.'] }).correct).toBe(false);
  });
  it('een komma in het antwoord: geen verplaatsing', () => {
    expect(gradeText('På måndag ringer jag dig, om jag hinner', { answers: ['Jag ringer dig, om jag hinner på måndag.'] }).correct).toBe(false);
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
  it('opdracht begint met het onderwerp: tip zonder „begin met de tijdsbepaling”', () => {
    // Zoals H1 v2-kiezen-maken: „Schrijf de zin, beginnend met Jag”.
    const s = { answers: ['Jag dricker kaffe {idag|i dag}.'] };
    const r = gradeText('Idag dricker jag kaffe', s, { fixedOrder: true });
    expect(r).toMatchObject({ correct: false, retry: true, kind: 'order' });
    expect(r.tip).toContain('begin de zin zoals gevraagd');
    expect(r.tip).not.toContain('met de tijdsbepaling');
    const r2 = gradeText('På kvällen läser Wilma en bok', { answers: ['Wilma läser en bok på kvällen.'], fixedOrder: true });
    expect(r2.tip).toContain('begin de zin zoals gevraagd');
  });
  it('opdracht begint met de tijdsbepaling: de bestaande tip', () => {
    const r = gradeText('Wilma läser en bok på kvällen', { answers: ['På kvällen läser Wilma en bok.'] }, { fixedOrder: true });
    expect(r).toMatchObject({ correct: false, retry: true });
    expect(r.tip).toContain('begin de zin met de tijdsbepaling');
  });
  it('zonder vaste volgorde blijft het in beide richtingen goed', () => {
    expect(gradeText('Idag dricker jag kaffe', { answers: ['Jag dricker kaffe idag.'] }).correct).toBe(true);
    expect(gradeText('Jag dricker kaffe idag', { answers: ['Idag dricker jag kaffe.'] }).correct).toBe(true);
  });
});

describe('woordenlijst: meervoud en voorbeeldzin', async () => {
  const { vocabExercises, exampleGap } = await import('../src/core/content/build.js');
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
  it('lange lijsten krijgen rondes', () => expect(byId['woorden-sv-nl'].roundSize).toBe(10));
  it('tip bij de bepaalde vorm meervoud', () => {
    const v = [{ sv: 'en bil', nl: 'een auto', def: 'bilen', pl: 'bilar', plDef: 'bilarna' }];
    const it0 = vocabExercises(v, 1).find((e) => e.id === 'woorden-meervoud').items[0];
    expect(gradeText('bilarna', it0.gaps[0]).tip).toContain('bepaalde vorm meervoud');
  });
  it('haalt alle Nederlandse lidwoorden weg in de opdracht', () => {
    const v = [{ sv: 'en granne', nl: 'een buurman, een buurvrouw', def: 'grannen', pl: 'grannar' }];
    const it0 = vocabExercises(v, 1).find((e) => e.id === 'woorden-meervoud').items[0];
    expect(it0.text).toBe('en granne (buurman) → meervoud: ___');
  });
  it('nl→sv: tip bij de bepaalde vorm, en woorden zonder lidwoord (mass)', () => {
    const v = [
      { sv: 'en bil', nl: 'een auto', def: 'bilen' },
      { sv: 'en feber', nl: 'de koorts', def: 'febern', mass: true },
    ];
    const items = vocabExercises(v, 1).find((e) => e.id === 'woorden-nl-sv').items;
    expect(gradeText('bilen', items[0]).tip).toContain('bepaalde vorm');
    expect(gradeText('bil', items[0]).tip).toContain('lidwoord');
    expect(gradeText('febern', items[1]).correct).toBe(true);
    expect(gradeText('feber', items[1]).correct).toBe(true);
    expect(gradeText('en feber', items[1]).correct).toBe(true);
    expect(items[1].explain).toContain('en-woord');
  });
  it('nl→sv: bij „het weer” is ook „vädret” goed', () => {
    const v = [{ sv: 'ett väder', nl: 'het weer', def: 'vädret', mass: true }, { sv: 'en bror', nl: 'een broer', def: ['brodern', 'brorn'] }];
    const ex = vocabExercises(v, 1);
    const items = ex.find((e) => e.id === 'woorden-nl-sv').items;
    expect(gradeText('vädret', items[0]).correct).toBe(true);
    expect(gradeText('väder', items[0]).correct).toBe(true);
    expect(gradeText('brorn', items[1]).tip).toContain('bepaalde vorm');
    const step = ex.find((e) => e.id === 'woorden-en-ett').items[1].steps[1];
    expect(gradeText('brorn', step.gaps[0]).correct).toBe(true);
  });
  it('def mag een lijst zijn (knät of knäet)', () => {
    const knä = { sv: 'ett knä', nl: 'een knie', def: ['knät', 'knäet'], pl: 'knän' };
    const byKnä = Object.fromEntries(vocabExercises([knä], 1).map((e) => [e.id, e]));
    const step = byKnä['woorden-en-ett'].items[0].steps[1].gaps[0];
    expect(gradeText('knät', step).correct).toBe(true);
    expect(gradeText('knäet', step).correct).toBe(true);
    expect(gradeText('knäet', byKnä['woorden-meervoud'].items[0].gaps[0]).tip).toContain('bepaalde vorm');
  });
  it('voorbeeldzin moet precies één vet stuk hebben', () => {
    expect(exampleGap('Jag **tar** **bussen**.')).toBe(null);
    expect(exampleGap('Geen vet')).toBe(null);
  });
});

describe('mix en toets: niet alleen woordenschat', async () => {
  const { balancedSample } = await import('../src/app/content.js');
  const { shuffle } = await import('../src/core/content/build.js');
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

describe('vrij schrijven: hulp zonder oordeel', () => {
  it('somt woordenaantal en hulpwoorden op', async () => {
    const { freeHelp } = await import('../src/core/check/grade.js');
    expect(freeHelp({ minWords: 25, require: [{ word: 'heter', label: 'Je vertelt hoe je heet' }, { any: ['bor', 'bodde'] }] }))
      .toEqual(['Ongeveer 25 woorden', 'Je vertelt hoe je heet', 'Gebruik „bor”']);
    expect(freeHelp({})).toEqual([]);
  });
});

describe('hoofdlettergevoelig (issue #11)', () => {
  const spec = { answers: ['Vi ses på måndag.'], caseSensitive: true };
  it('de kleine letter van de woordtegels aan het begin telt niet', () => {
    expect(gradeText('vi ses på måndag', spec).correct).toBe(true);
    expect(gradeText('Vi ses på måndag.', spec).correct).toBe(true);
  });
  it('een hoofdletter midden in de zin telt wel', () => {
    expect(gradeText('vi ses på Måndag', spec).correct).toBe(false);
  });
});
