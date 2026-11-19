import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_PREFIX } from '../src/config.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const P = await import('../src/progress.js');

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
    expect(P.completeRun(1, ex)).toEqual({ score: 1, total: 2 });
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
    expect(P.nextSrs(null, 'good')).toEqual({ box: 1, due: P.today(1) });
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
    expect(P.dueItems(entries, P.today(1)).map((e) => e.idx)).toEqual([0, 1]);
    expect(P.srsStats(entries)[1]).toBe(2);
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
    expect(P.completeRun(1, long)).toEqual({ score: 1, total: 2 });
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
    expect(P.completeRun(1, long)).toEqual({ score: 2, total: 2 });
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
