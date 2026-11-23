import { describe, it, expect } from 'vitest';
import { createStore } from '../src/app/store.js';
import { recordItem } from '../src/core/progress/record.js';
import { empty } from '../src/core/progress/schema.js';

function memoryStorage(fail = false) {
  const data = new Map();
  return {
    data,
    read: (k) => (data.has(k) ? data.get(k) : null),
    write: (k, v) => {
      if (fail) return false;
      if (v === null) data.delete(k);
      else data.set(k, v);
      return true;
    },
    remove(k) { return this.write(k, null); },
  };
}

const ex = { id: 'o', items: [{ id: 'a', type: 'translate', prompt: 'x', answers: ['y'] }] };

describe('store', () => {
  it('slaat op, leest terug en meldt veranderingen met een reden', () => {
    const storage = memoryStorage();
    const store = createStore({ storage, key: 'k' });
    const seen = [];
    store.subscribe((s, { reason, prev }) => seen.push([reason, Object.keys(prev.items).length, Object.keys(s.items).length]));
    store.update((s) => recordItem(s, 13, ex, 0, 'good', { now: 1 }));
    expect(JSON.parse(storage.read('k')).items['13/o/a'].s).toBe('good');
    expect(store.get().items['13/o/a'].at).toBe(1);
    store.set(empty(), 'sync');
    expect(seen).toEqual([['local', 0, 1], ['sync', 1, 0]]);
  });

  it('ziet een verandering van een ander tabblad', () => {
    const storage = memoryStorage();
    const store = createStore({ storage, key: 'k' });
    store.set(empty());
    storage.write('k', JSON.stringify({ ...empty(), last: { href: '#/x' } }));
    expect(store.get().last.href).toBe('#/x');
  });

  it('zonder opslag blijft de voortgang in het geheugen', () => {
    const store = createStore({ storage: memoryStorage(true), key: 'k' });
    store.update((s) => recordItem(s, 13, ex, 0, 'wrong'));
    expect(store.get().items['13/o/a'].s).toBe('wrong');
  });

  it('zet versie 1 één keer om', () => {
    const storage = memoryStorage();
    storage.write('old', JSON.stringify({ '13/o': { best: 0.5, score: 1, total: 2, at: 5 } }));
    const store = createStore({ storage, key: 'k', oldKey: 'old' });
    expect(store.get().ex['13/o']).toEqual({ best: 0.5, score: 1, total: 2, completedAt: 5 });
    expect(storage.read('old')).toBe(null);
  });

  it('leest de opslag pas opnieuw als een ander tabblad schreef', () => {
    const storage = memoryStorage();
    let reads = 0;
    let changed = null;
    const read = storage.read;
    storage.read = (k) => { reads++; return read(k); };
    storage.watch = (_k, fn) => { changed = fn; return true; };
    const store = createStore({ storage, key: 'k' });
    store.set(empty());
    reads = 0;
    store.get();
    store.get();
    expect(reads).toBe(0);
    storage.write('k', JSON.stringify({ ...empty(), last: { href: '#/y' } }));
    expect(store.get().last).toBe(null); // nog niet gemeld
    changed();
    expect(store.get().last.href).toBe('#/y');
  });
});
