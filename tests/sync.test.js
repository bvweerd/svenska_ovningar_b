import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config.js', async (orig) => ({ ...(await orig()), SYNC_URL: 'https://worker.example/' }));

// Twee apparaten = twee localStorages; de module leest bij elke aanroep opnieuw uit de opslag.
const devices = { a: new Map(), b: new Map() };
let store = devices.a;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const P = await import('../src/app/progress.js');
const S = await import('../src/platform/sync.js');
S.bindProgress(P.progressSnapshot, P.mergeProgress);

/** Nep-Worker met dezelfde regels als worker/src/sync.js (volgnummer, 409 bij conflict). */
function fakeServer() {
  const db = new Map();
  const calls = [];
  const fetchImpl = vi.fn(async (url, opts = {}) => {
    const u = new URL(url);
    const key = `${u.pathname}|${u.searchParams.get('site')}`;
    const row = db.get(key);
    calls.push(opts.method ?? 'GET');
    if (!opts.method) {
      if (!row) return Response.json({ ok: true, rev: 0 });
      if (Number(u.searchParams.get('since')) === row.rev) return Response.json({ ok: true, rev: row.rev });
      return Response.json({ ok: true, rev: row.rev, data: JSON.parse(row.data) });
    }
    const body = JSON.parse(opts.body);
    if ((row?.rev ?? 0) !== body.rev) return Response.json({ ok: false, rev: row.rev, data: JSON.parse(row.data) }, { status: 409 });
    db.set(key, { rev: body.rev + 1, data: JSON.stringify(body.data) });
    return Response.json({ ok: true, rev: body.rev + 1 });
  });
  return { db, calls, fetchImpl };
}

const ex = { id: 'oef', items: [{ id: 'a', type: 'gap', gaps: [{ answers: ['x'] }] }, { id: 'b', type: 'gap', gaps: [{ answers: ['y'] }] }] };
// Een nieuw apparaat begint leeg (anders valt progress.js terug op de voortgang in het geheugen).
const on = (d) => {
  store = devices[d];
  if (!store.size) P.resetProgress();
};
const done = () => Object.keys(P.progressSnapshot().items).sort();

beforeEach(() => {
  devices.a.clear();
  devices.b.clear();
});

describe('synchroniseren', () => {
  it('codes: maken, normaliseren en tonen', () => {
    const c = S.newCode();
    expect(c).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{16}$/);
    expect(S.normalizeCode(S.formatCode(c).toUpperCase())).toBe(c);
    expect(S.normalizeCode('ABCD EFGH JKMN PQOI')).toBe('abcdefghjkmnpq01');
    expect(S.normalizeCode('te kort')).toBe(null);
    expect(S.linkFor('abcdefghjkmnpq01', 'https://x.example/')).toBe('https://x.example/#/koppel/abcd-efgh-jkmn-pq01');
  });

  it('zonder code gebeurt er niets', async () => {
    const srv = fakeServer();
    expect(await S.syncNow({ fetchImpl: srv.fetchImpl })).toBe(null);
    expect(srv.fetchImpl).not.toHaveBeenCalled();
  });

  it('twee apparaten wisselen voortgang uit zonder iets kwijt te raken', async () => {
    const srv = fakeServer();
    const code = S.newCode();
    on('a');
    S.setCode(code);
    P.recordItem(1, ex, 0, 'good');
    expect(await S.syncNow({ fetchImpl: srv.fetchImpl })).toEqual({ changed: false });

    on('b');
    S.setCode(code);
    P.recordItem(1, ex, 1, 'wrong');
    expect(await S.syncNow({ fetchImpl: srv.fetchImpl })).toEqual({ changed: true });
    expect(done()).toEqual(['1/oef/a', '1/oef/b']);

    on('a');
    expect(await S.syncNow({ fetchImpl: srv.fetchImpl })).toEqual({ changed: true });
    expect(done()).toEqual(['1/oef/a', '1/oef/b']);
    expect(S.lastSync()).toBeGreaterThan(0);
  });

  it('bij weggaan zonder wijzigingen: geen verzoek', async () => {
    const srv = fakeServer();
    on('a');
    S.setCode(S.newCode());
    P.recordItem(1, ex, 0, 'good');
    await S.syncNow({ fetchImpl: srv.fetchImpl });
    srv.calls.length = 0;
    await S.syncNow({ fetchImpl: srv.fetchImpl, onlyIfChanged: true });
    expect(srv.calls).toEqual([]);
    // Niets veranderd, wel een gewone sync: alleen ophalen (zonder gegevens), niet opslaan.
    await S.syncNow({ fetchImpl: srv.fetchImpl });
    expect(srv.calls).toEqual(['GET']);
  });

  it('voegt opnieuw samen als een ander apparaat net eerder opsloeg', async () => {
    const srv = fakeServer();
    const code = S.newCode();
    on('a');
    S.setCode(code);
    P.recordItem(1, ex, 0, 'good');
    const fromA = P.progressSnapshot();
    on('b');
    S.setCode(code);
    P.recordItem(1, ex, 1, 'good');
    // Tussen ophalen en opslaan van B slaat A op: B krijgt een 409, voegt samen en probeert opnieuw.
    let raced = false;
    const racing = async (url, opts) => {
      if (opts?.method === 'PUT' && !raced) {
        raced = true;
        await srv.fetchImpl(url, { method: 'PUT', body: JSON.stringify({ rev: 0, data: fromA }) });
      }
      return srv.fetchImpl(url, opts);
    };
    expect(await S.syncNow({ fetchImpl: racing })).toEqual({ changed: true });
    expect(done()).toEqual(['1/oef/a', '1/oef/b']);
    expect(srv.calls).toEqual(['GET', 'PUT', 'PUT', 'PUT']);
    const saved = JSON.parse([...srv.db.values()][0].data);
    expect(Object.keys(saved.items).sort()).toEqual(['1/oef/a', '1/oef/b']);
  });
});
