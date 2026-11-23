import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_PREFIX } from '../src/config.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const P = await import('../src/app/progress.js');

const ex = {
  id: 'oef',
  items: [
    { type: 'gap', text: 'a ___', gaps: [{ answers: ['x'] }] },
    { type: 'gap', text: 'b ___', gaps: [{ answers: ['y'] }] },
    { type: 'free', prompt: 'schrijf' },
  ],
};
const chapter = { chapter: 1, exercises: [ex] };

beforeEach(() => {
  store.clear();
  P.resetProgress();
});

describe('voortgang', () => {
  it('bewaart een halve oefening en gaat daar verder', () => {
    P.startRun(1, ex);
    P.recordItem(1, ex, 0, 'good');
    const run = P.runState(1, ex);
    expect(run.started).toBe(true);
    expect([...run.done.keys()]).toEqual([0]);
    expect(P.chapterProgress(chapter)).toMatchObject({ itemsDone: 1, itemsTotal: 3, completed: 0 });
  });

  it('rondt af met score over de hele ronde (zonder schrijfopdracht)', () => {
    P.startRun(1, ex);
    P.recordItem(1, ex, 0, 'good');
    P.recordItem(1, ex, 1, 'wrong');
    P.recordItem(1, ex, 2, 'free');
    expect(P.completeRun(1, ex)).toEqual({ score: 1, total: 2, firstTry: 1 });
    expect(P.getResult(1, 'oef').best).toBe(0.5);
    expect(P.runState(1, ex).started).toBe(false);
  });

  it('houdt de beste score bij', () => {
    for (const s of ['good', 'wrong']) {
      P.startRun(1, ex);
      P.recordItem(1, ex, 0, 'good');
      P.recordItem(1, ex, 1, s);
      P.completeRun(1, ex);
    }
    expect(P.getResult(1, 'oef').best).toBe(1);
  });

  it('foutenlijst: fout erin, in één keer goed eruit', () => {
    P.recordItem(1, ex, 1, 'revealed');
    expect(P.weakItems(chapter).map((w) => w.idx)).toEqual([1]);
    P.recordItem(1, ex, 1, 'good');
    expect(P.weakItems(chapter)).toEqual([]);
  });

  it('negeert resultaten als de goede antwoorden veranderd zijn', () => {
    P.recordItem(1, ex, 0, 'wrong');
    const changed = { ...ex, items: [{ ...ex.items[0], gaps: [{ answers: ['z'] }] }, ex.items[1], ex.items[2]] };
    expect(P.weakItems({ chapter: 1, exercises: [changed] })).toEqual([]);
  });

  it('houdt resultaten bij een andere vraagtekst of tip', () => {
    P.recordItem(1, ex, 0, 'wrong');
    const changed = { ...ex, items: [{ ...ex.items[0], text: 'anders ___', tip: 'nieuw' }, ex.items[1], ex.items[2]] };
    expect(P.weakItems({ chapter: 1, exercises: [changed] }).length).toBe(1);
  });


  it('export en import', () => {
    P.recordItem(1, ex, 0, 'good');
    const dump = P.exportProgress();
    P.resetProgress();
    expect(P.chapterProgress(chapter).itemsDone).toBe(0);
    P.importProgress(dump);
    expect(P.chapterProgress(chapter).itemsDone).toBe(1);
    expect(() => P.importProgress('{"foo":1}')).toThrow();
  });

  it('neemt oude voortgang (v1) over', () => {
    store.clear();
    store.set(`${STORAGE_PREFIX}:progress:v1`, JSON.stringify({ '1/oef': { score: 2, total: 2, best: 1, at: 'x' } }));
    expect(P.getResult(1, 'oef').best).toBe(1);
    expect(store.has(`${STORAGE_PREFIX}:progress:v1`)).toBe(false);
  });

  it('herhaling: goed in één keer → doos hoger, fout → morgen terug', () => {
    expect(P.nextSrs(null, 'good')).toEqual({ box: 2, due: P.today(2) });
    expect(P.nextSrs({ box: 3 }, 'good')).toEqual({ box: 4, due: P.today(7) });
    expect(P.nextSrs({ box: 5 }, 'wrong')).toEqual({ box: 1, due: P.today(1) });
    expect(P.nextSrs({ box: 7 }, 'good').box).toBe(7);
    expect(P.nextSrs({ box: 2, due: 'x' }, 'free')).toEqual({ box: 2, due: 'x' });
  });

  it('herhaling: alleen vragen waarvan de datum verstreken is', () => {
    P.recordItem(1, ex, 0, 'good');
    P.recordItem(1, ex, 1, 'wrong');
    const entries = [0, 1].map((idx) => ({ chapter, ex, idx, item: ex.items[idx] }));
    expect(P.dueItems(entries)).toEqual([]);
    expect(P.dueItems(entries, P.today(1)).map((e) => e.idx)).toEqual([1]);
    expect(P.dueItems(entries, P.today(2)).map((e) => e.idx)).toEqual([1, 0]);
    expect(P.srsStats(entries).slice(1, 3)).toEqual([1, 1]);
  });

  it('telt dagen op rij', () => {
    expect(P.streak()).toEqual({ days: 0, today: false });
    P.recordItem(1, ex, 0, 'good');
    expect(P.streak()).toEqual({ days: 1, today: true });
  });

  it('spelrecords en toetsscores', () => {
    expect(P.saveGame('x', 5)).toBe(true);
    expect(P.saveGame('x', 3)).toBe(false);
    expect(P.getGame('x').best).toBe(5);
    P.saveTest(1, 15, 20, {});
    P.saveTest(1, 10, 20, {});
    expect(P.getTest(1)).toMatchObject({ best: 0.75, last: 0.5 });
  });
});

describe('vraag-id', () => {
  const withIds = {
    id: 'oef',
    items: [
      { id: 'aaaa', type: 'gap', text: 'a ___', gaps: [{ answers: ['x'] }] },
      { id: 'bbbb', type: 'gap', text: 'b ___', gaps: [{ answers: ['y'] }] },
    ],
  };

  it('voortgang blijft staan als er een vraag vóór wordt ingevoegd', () => {
    P.recordItem(1, withIds, 1, 'good');
    const inserted = { ...withIds, items: [{ id: 'nieuw', type: 'gap', text: 'n ___', gaps: [{ answers: ['n'] }] }, ...withIds.items] };
    expect(P.chapterProgress({ chapter: 1, exercises: [inserted] }).itemsDone).toBe(1);
    expect(P.runState(1, inserted).total).toBe(3);
  });

  it('zet oude voortgang op plek om naar ids', () => {
    // Oude opslag: sleutel met index, hash van de hele vraag zonder id.
    const { id: _a, ...first } = withIds.items[0];
    const { id: _b, ...second } = withIds.items[1];
    store.set(`${STORAGE_PREFIX}:progress:v2`, JSON.stringify({
      v: 2,
      items: {
        '1/oef/0': { s: 'good', at: 1, h: P.hashItem(first) },
        '1/oef/1': { s: 'wrong', at: 1, h: 'verouderd' },
      },
      ex: {},
      srs: { '1/oef/0': { box: 2, due: '2099-01-01', h: P.hashItem(second) } },
    }));
    const moved = P.migrateToIds([{ chapter: 1, exercises: [withIds] }]);
    expect(moved).toBe(1);
    const state = JSON.parse(store.get(`${STORAGE_PREFIX}:progress:v2`));
    expect(Object.keys(state.items)).toEqual(['1/oef/aaaa']);
    expect(state.srs).toEqual({});
    expect(state.ids).toBe(true);
    expect(P.migrateToIds([{ chapter: 1, exercises: [withIds] }])).toBe(null);
  });
});

describe('vragen buiten de oefening', () => {
  beforeEach(() => store.clear());
  it('tellen niet als gedaan in de lopende ronde, wel als voortgang', () => {
    P.resetProgress();
    P.startRun(1, ex);
    P.recordItem(1, ex, 0, 'good', { outside: true });
    expect(P.runState(1, ex).done.size).toBe(0);
    expect(P.chapterProgress({ chapter: 1, exercises: [ex] }).itemsDone).toBe(1);
    P.recordItem(1, ex, 0, 'good');
    expect(P.runState(1, ex).done.size).toBe(1);
  });
  it('importeren weigert een bestand met lege of foute onderdelen', () => {
    expect(() => P.importProgress(JSON.stringify({ v: 2, items: null, ex: {} }))).toThrow();
    expect(() => P.importProgress(JSON.stringify({ v: 2, items: {}, ex: {}, srs: [] }))).toThrow();
    expect(() => P.importProgress(JSON.stringify({ v: 2, items: {}, ex: {}, days: 'x' }))).toThrow();
    expect(() => P.importProgress(JSON.stringify({ v: 2, items: {}, ex: {} }))).not.toThrow();
  });
});

describe('rondes bij een lange oefening', () => {
  const long = { id: 'lang', items: Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, type: 'gap', text: `${i} ___`, gaps: [{ answers: [`x${i}`] }] })) };
  beforeEach(() => { store.clear(); P.resetProgress(); });
  it('kiest eerst nieuwe, dan foute vragen', () => {
    P.recordItem(1, long, 0, 'good');
    P.recordItem(1, long, 1, 'wrong');
    P.recordItem(1, long, 2, 'good');
    P.recordItem(1, long, 3, 'good');
    expect(P.pickRound(1, long, 3)).toEqual([1, 4, 5]);
  });
  it('vult een ronde niet aan met vragen die al goed zijn', () => {
    for (let i = 0; i < 5; i++) P.recordItem(1, long, i, 'good');
    expect(P.pickRound(1, long, 3)).toEqual([5]);
    P.recordItem(1, long, 5, 'good');
    expect(P.pickRound(1, long, 3)).toHaveLength(3);
  });
  it('houdt bij hoeveel woorden je over alle rondes hebt gehad', () => {
    expect(P.roundProgress(1, long)).toEqual({ total: 6, seen: 0, fresh: 6, wrong: 0 });
    P.recordItem(1, long, 0, 'good');
    P.recordItem(1, long, 1, 'wrong');
    expect(P.roundProgress(1, long)).toEqual({ total: 6, seen: 2, fresh: 4, wrong: 1 });
    for (let i = 1; i < 6; i++) P.recordItem(1, long, i, 'good');
    expect(P.roundProgress(1, long)).toEqual({ total: 6, seen: 6, fresh: 0, wrong: 0 });
  });
  it('de ronde telt alleen de gekozen vragen en de voortgang blijft bewaard', () => {
    P.startRun(1, long, [4, 5]);
    let run = P.runState(1, long);
    expect(run.total).toBe(2);
    expect(run.inRound(4)).toBe(true);
    expect(run.inRound(0)).toBe(false);
    P.recordItem(1, long, 4, 'good');
    P.recordItem(1, long, 5, 'wrong');
    run = P.runState(1, long);
    expect(run.done.size).toBe(2);
    expect(P.completeRun(1, long)).toEqual({ score: 1, total: 2, firstTry: 1 });
    P.startRun(1, long);
    expect(P.runState(1, long).total).toBe(6);
  });
});

describe('ronde afronden bij een lange oefening', () => {
  const long = { id: 'lang2', items: Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, type: 'gap', text: `${i} ___`, gaps: [{ answers: [`y${i}`] }] })) };
  const ch = { chapter: 1, exercises: [long] };
  beforeEach(() => { store.clear(); P.resetProgress(); });
  it('is pas afgerond als elke vraag een keer gemaakt is', () => {
    P.startRun(1, long, [0, 1]);
    P.recordItem(1, long, 0, 'good');
    P.recordItem(1, long, 1, 'good');
    expect(P.completeRun(1, long)).toEqual({ score: 2, total: 2, firstTry: 2 });
    expect(P.getResult(1, 'lang2').completedAt).toBeUndefined();
    expect(P.chapterProgress(ch).completed).toBe(0);
    P.startRun(1, long, [2, 3]);
    P.recordItem(1, long, 2, 'good');
    P.recordItem(1, long, 3, 'wrong');
    P.completeRun(1, long);
    const res = P.getResult(1, 'lang2');
    expect(res.completedAt).toBeTruthy();
    expect(res.best).toBe(0.75); // 3 van de 4 woorden in één keer goed, over de hele oefening
    expect(res.pick).toBeUndefined();
  });
});

describe('flitskaarten en dictee', () => {
  beforeEach(() => { store.clear(); P.resetProgress(); });
  const words = ['en bil', 'ett hus', 'en katt', 'en hund'];
  it('stapels: eerst nieuw, dan nog niet gekend, dan herhaling', () => {
    P.rateCard(1, 'sv', 'en bil', true);
    P.rateCard(1, 'sv', 'ett hus', false);
    expect(P.pickCards(1, 'sv', words, 10).sort()).toEqual(['en hund', 'en katt', 'ett hus']);
    expect(P.cardProgress(1, 'sv', words)).toEqual({ total: 4, known: 1, unknown: 1, fresh: 2 });
    expect(P.cardProgress(1, 'nl', words).fresh).toBe(4);
    for (const w of words) P.rateCard(1, 'sv', w, true);
    expect(P.pickCards(1, 'sv', words, 2)).toHaveLength(2);
    expect(P.cardProgress(1, 'sv', words)).toEqual({ total: 4, known: 4, unknown: 0, fresh: 0 });
  });
  it('flitskaarten tellen niet als antwoord in een oefening', () => {
    P.rateCard(1, 'sv', 'en bil', true);
    expect(Object.keys(JSON.parse(store.get(P.KEY)).items)).toHaveLength(0);
  });
  it('dictee: eerst nieuw, dan fout', () => {
    const says = ['Hej.', 'Tack.', 'Hej då.'];
    P.recordDictation('Hej.', true);
    P.recordDictation('Tack.', false);
    expect(P.pickDictation(says, 1)).toEqual(['Hej då.']);
    expect(P.pickDictation(says, 5).sort()).toEqual(['Hej då.', 'Tack.']);
    expect(P.dictationProgress(says)).toEqual({ total: 3, seen: 2, wrong: 1 });
  });
});

describe('kan-doen-uitspraken', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: `k${i}`, type: 'gap', text: `${i} ___`, gaps: [{ answers: [`a${i}`] }] }));
  const oef = { id: 'kd', topic: 'presens', items: [...items, { id: 'vrij', type: 'free', prompt: 'schrijf' }] };
  const ch = { chapter: 7, exercises: [oef], canDo: [{ text: 'Ik kan het', topics: ['presens'] }] };
  const goodTimes = (n, upTo = items.length) => {
    for (let r = 0; r < n; r++) for (let i = 0; i < upTo; i++) P.recordItem(7, oef, i, 'good');
  };

  it('telt alleen nakijkbare vragen over de onderwerpen', () => {
    expect(P.canDoStatus(ch)).toEqual([{ text: 'Ik kan het', total: 5, seen: 0, known: 0, share: 0, done: false }]);
    P.recordItem(7, oef, 0, 'wrong');
    expect(P.canDoStatus(ch)[0]).toMatchObject({ seen: 1, known: 0 });
  });

  it('behaald pas als 80% van de vragen in doos 3 of hoger staat', () => {
    goodTimes(1); // de eerste keer goed: doos 2
    expect(P.canDoStatus(ch)[0].done).toBe(false);
    goodTimes(1, 3); // 3 van 5 in doos 3: 60%
    expect(P.canDoStatus(ch)[0]).toMatchObject({ known: 3, done: false });
    goodTimes(1, 4); // vraag 4 nu ook in doos 3: 4 van 5 = 80%
    expect(P.canDoStatus(ch)[0]).toMatchObject({ known: 4, done: true });
  });

  it('een fout zet een vraag terug', () => {
    goodTimes(3);
    P.recordItem(7, oef, 0, 'wrong');
    P.recordItem(7, oef, 1, 'revealed');
    expect(P.canDoStatus(ch)[0]).toMatchObject({ known: 3, done: false });
  });

  it('newCanDo meldt een behaalde uitspraak één keer', () => {
    expect(P.newCanDo(ch)).toEqual([]);
    goodTimes(3);
    expect(P.newCanDo(ch)).toEqual([{ nr: 1, text: 'Ik kan het' }]);
    expect(P.newCanDo(ch)).toEqual([]);
  });
});

describe('samenvoegen (import en synchronisatie)', () => {
  const st = (over) => ({ v: 2, items: {}, ex: {}, last: null, srs: {}, days: [], tests: {}, games: {}, prefs: {}, cards: {}, dictee: {}, t: {}, ...over });

  it('houdt per vraag de laatste poging, met de doos die daarbij hoort', () => {
    const a = st({
      items: { '1/oef/a': { s: 'good', at: 100, h: 'x' }, '1/oef/b': { s: 'wrong', at: 300, h: 'x' } },
      srs: { '1/oef/a': { box: 3, due: '2026-01-01', h: 'x' }, '1/oef/b': { box: 1, due: '2026-01-02', h: 'x' } },
    });
    const b = st({
      items: { '1/oef/a': { s: 'wrong', at: 200, h: 'x' }, '1/oef/b': { s: 'good', at: 250, h: 'x' }, '1/oef/c': { s: 'good', at: 1, h: 'x' } },
      srs: { '1/oef/a': { box: 1, due: '2026-02-01', h: 'x' }, '1/oef/b': { box: 4, due: '2026-03-01', h: 'x' }, '1/oef/c': { box: 1, due: '2026-01-05', h: 'x' } },
    });
    const m = P.mergeStates(a, b);
    expect(m.items['1/oef/a'].s).toBe('wrong');
    expect(m.srs['1/oef/a'].box).toBe(1);
    expect(m.items['1/oef/b'].s).toBe('wrong');
    expect(m.srs['1/oef/b'].box).toBe(1);
    expect(m.items['1/oef/c'].s).toBe('good');
    expect(m.srs['1/oef/c']).toBeTruthy();
  });

  it('geeft in beide richtingen hetzelfde resultaat voor oefeningen', () => {
    const a = st({ ex: { '1/oef': { best: 0.9, score: 5, total: 10, completedAt: 100, at: 100 } }, days: ['2026-01-01', '2026-01-03'] });
    const b = st({ ex: { '1/oef': { best: 0.5, runStart: 200, at: 200 }, '1/twee': { best: 1, at: 5 } }, days: ['2026-01-02'] });
    const ab = P.mergeStates(a, b);
    const ba = P.mergeStates(b, a);
    expect(ab.ex).toEqual(ba.ex);
    expect(ab.ex['1/oef']).toEqual({ best: 0.9, runStart: 200, at: 200 });
    expect(ab.days).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('flitskaarten en dictee: het nieuwste oordeel telt', () => {
    const a = st({ cards: { '1/sv/hej': 'unknown', '1/sv/tack': 'known' }, t: { 'c/1/sv/hej': 10, 'c/1/sv/tack': 50 } });
    const b = st({ cards: { '1/sv/hej': 'known', '1/sv/tack': 'unknown' }, t: { 'c/1/sv/hej': 20, 'c/1/sv/tack': 40 } });
    const m = P.mergeStates(a, b);
    expect(m.cards).toEqual({ '1/sv/hej': 'known', '1/sv/tack': 'known' });
    expect(m.t['c/1/sv/hej']).toBe(20);
  });

  it('instellingen van dit apparaat blijven staan, lijsten worden samengevoegd', () => {
    const m = P.mergeStates(
      st({ prefs: { voice: 'a', canDoSeen: ['1-1'] } }),
      st({ prefs: { voice: 'b', verbs: { x: 1 }, canDoSeen: ['2-1'] } }),
    );
    expect(m.prefs).toEqual({ voice: 'a', verbs: { x: 1 }, canDoSeen: ['1-1', '2-1'] });
  });

  it('importeren voegt samen in plaats van te overschrijven', () => {
    P.recordItem(1, ex, 0, 'good');
    const other = st({ items: { '1/oef/x': { s: 'good', at: 1, h: 'h' } } });
    expect(P.importProgress(JSON.stringify(other))).toBe(true);
    const all = P.progressSnapshot();
    expect(Object.keys(all.items).sort()).toEqual(['1/oef/0', '1/oef/x']);
    expect(P.importProgress(JSON.stringify(other))).toBe(false);
  });

  it('een flitskaart krijgt een tijdstip', () => {
    P.rateCard(1, 'sv', 'hej', true);
    expect(P.progressSnapshot().t['c/1/sv/hej']).toBeGreaterThan(0);
  });
});

describe('open vragen', () => {
  it('telt nooit gemaakte en gewijzigde vragen', () => {
    expect(P.openItems(1, ex)).toEqual([0, 1, 2]);
    P.recordItem(1, ex, 0, 'good');
    P.recordItem(1, ex, 2, 'free');
    expect(P.openItems(1, ex)).toEqual([1]);
    // Ander goed antwoord bij vraag 0: telt niet meer mee.
    const changed = { ...ex, items: [{ ...ex.items[0], gaps: [{ answers: ['z'] }] }, ex.items[1], ex.items[2]] };
    expect(P.openItems(1, changed)).toEqual([0, 1]);
  });
});

describe('deelpunten bij vragen met meer vakjes (issue #6)', () => {
  it('een tabel met 7 van 10 goed telt als 0,7 in de score', async () => {
    const R = await import('../src/core/progress/record.js');
    const { empty } = await import('../src/core/progress/schema.js');
    const ex = { id: 't', items: [{ id: 'a', type: 'table', columns: ['x', 'y'], rows: [['a', { answers: ['b'] }]] }] };
    let s = R.startRun(empty(), 2, ex, null, 1);
    s = R.recordItem(s, 2, ex, 0, 'wrong', { share: 0.7, now: 2 });
    expect(s.items['2/t/a'].p).toBe(0.7);
    const out = R.completeRun(s, 2, ex, 3);
    expect(out.score).toBe(0.7);
    expect(out.firstTry).toBe(0); // deelpunten: niet „in één keer goed”
    expect(out.state.ex['2/t'].best).toBe(0.7);
  });
});

describe('dagdoel herhaling (afgeleid uit de antwoorden)', () => {
  it('telt alleen herhaalantwoorden van vandaag', async () => {
    const R = await import('../src/core/progress/record.js');
    const S = await import('../src/core/progress/srs.js');
    const { empty } = await import('../src/core/progress/schema.js');
    const exr = { id: 'h', items: [{ id: 'a', type: 'translate', prompt: 'x', answers: ['y'] }, { id: 'b', type: 'translate', prompt: 'x', answers: ['z'] }] };
    const now = Date.now();
    let s = R.recordItem(empty(), 1, exr, 0, 'good', { outside: true, review: true, now });
    s = R.recordItem(s, 1, exr, 1, 'good', { outside: true, now }); // mix, geen herhaling
    expect(S.reviewedToday(s, now)).toBe(1);
    expect(S.reviewedToday(s, now + 2 * 86400000)).toBe(0);
    expect(S.reviewLeft(s, 50, now)).toBe(S.DAILY_GOAL - 1);
    expect(S.reviewLeft(s, 3, now)).toBe(3);
  });
});

describe('prepareRun (ronde beginnen)', () => {
  it('lange oefening: een ronde; afgerond met een nieuwe vraag: alleen die', async () => {
    const R = await import('../src/core/progress/record.js');
    const { empty } = await import('../src/core/progress/schema.js');
    const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, type: 'translate', prompt: 'x', answers: [`a${i}`] }));
    const lang = { id: 'l', roundSize: 3, items: mk(7) };
    const a = R.prepareRun(empty(), 1, lang, { now: 1 });
    expect(a.partial).toBe(true);
    expect(a.run.total).toBe(3);
    const kort = { id: 'k', items: mk(2) };
    let s = R.prepareRun(empty(), 1, kort, { now: 1 }).state;
    s = R.recordItem(s, 1, kort, 0, 'good', { now: 2 });
    s = R.recordItem(s, 1, kort, 1, 'good', { now: 2 });
    s = R.completeRun(s, 1, kort, 3).state;
    const erbij = { id: 'k', items: [...kort.items, { id: 'nieuw', type: 'translate', prompt: 'x', answers: ['n'] }] };
    const b = R.prepareRun(s, 1, erbij, { now: 4 });
    expect(b.run.total).toBe(1);
    expect(b.run.inRound(2)).toBe(true);
    // Lopende ronde: niets nieuws beginnen.
    expect(R.prepareRun(b.state, 1, erbij, { now: 5 }).state).toBe(b.state);
  });
});
