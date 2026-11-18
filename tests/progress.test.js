import { describe, it, expect, beforeEach } from 'vitest';

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
    store.set('svensk-ovningar-b:progress:v1', JSON.stringify({ '1/oef': { score: 2, total: 2, best: 1, at: 'x' } }));
    expect(P.getResult(1, 'oef').best).toBe(1);
    expect(store.has('svensk-ovningar-b:progress:v1')).toBe(false);
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
    store.set('svensk-ovningar-b:progress:v2', JSON.stringify({
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
    const state = JSON.parse(store.get('svensk-ovningar-b:progress:v2'));
    expect(Object.keys(state.items)).toEqual(['1/oef/aaaa']);
    expect(state.srs).toEqual({});
    expect(state.ids).toBe(true);
    expect(P.migrateToIds([{ chapter: 1, exercises: [withIds] }])).toBe(null);
  });
});
