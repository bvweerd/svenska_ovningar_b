import { describe, it, expect } from 'vitest';
import { handle } from './src/index.js';

/** Nep-D1 die precies de drie query's van sync.js begrijpt. */
function fakeDb() {
  const rows = new Map();
  const db = {
    rows,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            const [id, site] = args;
            return rows.get(`${id}|${site}`) ?? null;
          },
          async run() {
            if (sql.startsWith('INSERT')) {
              const [id, site, data, updated] = args;
              const k = `${id}|${site}`;
              if (rows.has(k)) return { meta: { changes: 0 } };
              rows.set(k, { rev: 1, data, updated });
              return { meta: { changes: 1 } };
            }
            const [data, updated, id, site, rev] = args;
            const row = rows.get(`${id}|${site}`);
            if (!row || row.rev !== rev) return { meta: { changes: 0 } };
            rows.set(`${id}|${site}`, { rev: rev + 1, data, updated });
            return { meta: { changes: 1 } };
          },
        }),
      };
    },
  };
  return db;
}

const CODE = 'abcd-efgh-jkmn-pq12';
const env = (db = fakeDb()) => ({ ALLOWED_ORIGINS: 'https://bvweerd.github.io', SYNC_SITES: 'svensk-ovningar,svensk-ovningar-b', DB: db });
const req = (method, { code = CODE, site = 'svensk-ovningar-b', since, body, origin = 'https://bvweerd.github.io' } = {}) =>
  new Request(`https://worker.example/sync/${code}?site=${site}${since !== undefined ? `&since=${since}` : ''}`, {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const data = (n) => ({ v: 2, items: { [`1/a/${n}`]: { s: 'good', at: n } }, ex: {} });

describe('synchronisatie in de Worker', () => {
  it('slaat op, geeft terug en verhoogt het volgnummer', async () => {
    const e = env();
    let r = await handle(req('GET'), e);
    expect(await r.json()).toEqual({ ok: true, rev: 0 });
    r = await handle(req('PUT', { body: { rev: 0, data: data(1) } }), e);
    expect(await r.json()).toEqual({ ok: true, rev: 1 });
    r = await handle(req('GET'), e);
    expect(await r.json()).toEqual({ ok: true, rev: 1, data: data(1) });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://bvweerd.github.io');
    r = await handle(req('GET', { since: 1 }), e);
    expect(await r.json()).toEqual({ ok: true, rev: 1 });
    r = await handle(req('PUT', { body: { rev: 1, data: data(2) } }), e);
    expect(await r.json()).toEqual({ ok: true, rev: 2 });
  });

  it('geeft bij een verouderd volgnummer de huidige stand terug', async () => {
    const e = env();
    await handle(req('PUT', { body: { rev: 0, data: data(1) } }), e);
    let r = await handle(req('PUT', { body: { rev: 0, data: data(9) } }), e);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ rev: 1, data: data(1) });
    await handle(req('PUT', { body: { rev: 1, data: data(2) } }), e);
    r = await handle(req('PUT', { body: { rev: 1, data: data(3) } }), e);
    expect(r.status).toBe(409);
    expect((await r.json()).rev).toBe(2);
  });

  it('bewaart de code niet zelf, en houdt sites en codes uit elkaar', async () => {
    const e = env();
    await handle(req('PUT', { body: { rev: 0, data: data(1) } }), e);
    expect([...e.DB.rows.keys()].join()).not.toContain('abcd');
    expect(await (await handle(req('GET', { site: 'svensk-ovningar' }), e)).json()).toEqual({ ok: true, rev: 0 });
    expect(await (await handle(req('GET', { code: 'abcdefghjkmnpq13' }), e)).json()).toEqual({ ok: true, rev: 0 });
    // Hoofdletters en streepjes maken niet uit.
    expect((await (await handle(req('GET', { code: 'ABCDEFGHJKMNPQ12' }), e)).json()).rev).toBe(1);
  });

  it('weigert foute codes, sites, gegevens en origins', async () => {
    const e = env();
    expect((await handle(req('GET', { code: 'kort' }), e)).status).toBe(400);
    expect((await handle(req('GET', { code: 'abcdefghijklmnop' }), e)).status).toBe(400); // i en l horen niet in het alfabet
    expect((await handle(req('GET', { site: 'andere' }), e)).status).toBe(400);
    expect((await handle(req('PUT', { body: { rev: 0, data: { v: 1 } } }), e)).status).toBe(400);
    expect((await handle(req('PUT', { body: { rev: -1, data: data(1) } }), e)).status).toBe(400);
    expect((await handle(req('DELETE'), e)).status).toBe(405);
    expect((await handle(req('GET', { origin: 'https://kwaad.example' }), e)).status).toBe(403);
    const big = { ...data(1), pad: 'x'.repeat(1_000_001) };
    expect((await handle(req('PUT', { body: { rev: 0, data: big } }), e)).status).toBe(413);
  });

  it('zonder database: 503', async () => {
    const e = { ...env(), DB: undefined };
    expect((await handle(req('GET'), e)).status).toBe(503);
  });
});
