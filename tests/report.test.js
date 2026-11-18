import { describe, it, expect, vi } from 'vitest';
import { buildIssue, handle, neutralize, pickRepo } from '../worker/src/index.js';
import { reportPayload } from '../src/report.js';

const env = {
  GITHUB_REPO: 'eigenaar/repo',
  ALLOWED_ORIGINS: 'https://bvweerd.github.io, http://localhost:5173',
  ISSUE_LABELS: 'melding',
  GITHUB_TOKEN: 'geheim',
  TURNSTILE_SECRET: 'ts-geheim',
};

const payload = {
  message: 'Ook vem som is hier goed.',
  answer: 'vem som',
  page: 'https://bvweerd.github.io/svenska_ovningar_b/#/k/19/o/gram-vem',
  chapter: 19,
  exercise: 'gram-vem',
  exerciseTitle: 'Vem som of vem?',
  itemIndex: 3,
  shownNumber: 2,
  itemType: 'gap',
  item: '{"type":"gap"}',
  token: 'tok',
};

const request = (body, { origin = 'https://bvweerd.github.io', method = 'POST' } = {}) =>
  new Request('https://worker.example/', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

function fakeFetch({ human = true, githubOk = true } = {}) {
  return vi.fn(async (url) => {
    if (url.includes('turnstile')) return Response.json({ success: human });
    return githubOk ? Response.json({ number: 42 }, { status: 201 }) : new Response('nee', { status: 401 });
  });
}

describe('buildIssue', () => {
  it('maakt een titel met hoofdstuk, oefening en vraagnummer', () => {
    const { title, body } = buildIssue(payload);
    expect(title).toBe('Melding H19 · Vem som of vem? · items[3]: Ook vem som is hier goed.');
    expect(body).toContain('> Ook vem som is hier goed.');
    expect(body).toContain('`gram-vem`');
    expect(body).toContain('`items[3]`, nr. 2 op het scherm');
    expect(body).toContain('vem som');
  });
  it('weigert een lege melding', () => {
    expect(buildIssue({ ...payload, message: '  ' })).toBeNull();
    expect(buildIssue(null)).toBeNull();
  });
  it('pingt niemand en laat geen HTML door', () => {
    const { body } = buildIssue({ ...payload, message: 'Hoi @iemand <script>' });
    expect(body).not.toContain('@iemand');
    expect(body).not.toContain('<script>');
    expect(neutralize('@a')).toBe('@​a');
  });
  it('kan backticks in de vraag niet laten ontsnappen', () => {
    const { body } = buildIssue({ ...payload, item: 'a ``` b' });
    expect(body).toContain('````json\na ``` b\n````');
  });
  it('kort lange teksten in', () => {
    const { title, body } = buildIssue({ ...payload, message: 'x'.repeat(5000) });
    expect(title.length).toBeLessThanOrEqual(250);
    expect(body.length).toBeLessThan(5000);
  });
});

describe('pickRepo', () => {
  const multi = { GITHUB_REPO: 'bvweerd/svenska_ovningar_b, bvweerd/svenska_ovningar' };
  it('kiest een repo van de lijst', () => {
    expect(pickRepo('bvweerd/svenska_ovningar', multi)).toBe('bvweerd/svenska_ovningar');
    expect(pickRepo('BVWEERD/Svenska_Ovningar', multi)).toBe('bvweerd/svenska_ovningar');
  });
  it('valt terug op de eerste bij een onbekende of lege repo', () => {
    expect(pickRepo('iemand/anders', multi)).toBe('bvweerd/svenska_ovningar_b');
    expect(pickRepo(undefined, multi)).toBe('bvweerd/svenska_ovningar_b');
    expect(pickRepo('x/y', { GITHUB_REPO: 'eigenaar/repo' })).toBe('eigenaar/repo');
  });
});

describe('handle', () => {
  it('maakt het issue in de gevraagde repo als die is toegestaan', async () => {
    const f = fakeFetch();
    await handle(request({ ...payload, repo: 'eigenaar/a' }), { ...env, GITHUB_REPO: 'eigenaar/repo,eigenaar/a' }, f);
    expect(f.mock.calls[1][0]).toBe('https://api.github.com/repos/eigenaar/a/issues');
  });

  it('maakt een issue bij een geldige melding', async () => {
    const f = fakeFetch();
    const res = await handle(request(payload), env, f);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, number: 42 });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://bvweerd.github.io');
    const [url, init] = f.mock.calls[1];
    expect(url).toBe('https://api.github.com/repos/eigenaar/repo/issues');
    expect(init.headers.Authorization).toBe('Bearer geheim');
    expect(JSON.parse(init.body).labels).toEqual(['melding']);
  });
  it('weigert een onbekende origin zonder iets aan te roepen', async () => {
    const f = fakeFetch();
    const res = await handle(request(payload, { origin: 'https://evil.example' }), env, f);
    expect(res.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
  it('beantwoordt de CORS-preflight', async () => {
    const res = await handle(request(null, { method: 'OPTIONS' }), env, fakeFetch());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
  it('maakt geen issue als Turnstile nee zegt', async () => {
    const f = fakeFetch({ human: false });
    const res = await handle(request(payload), env, f);
    expect(res.status).toBe(403);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('meldt een fout van GitHub', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(request(payload), env, fakeFetch({ githubOk: false }));
    expect(res.status).toBe(502);
    spy.mockRestore();
  });
  it('weigert ongeldige JSON en lege meldingen', async () => {
    const bad = new Request('https://worker.example/', { method: 'POST', headers: { Origin: 'http://localhost:5173' }, body: '{' });
    expect((await handle(bad, env, fakeFetch())).status).toBe(400);
    expect((await handle(request({ ...payload, message: '' }), env, fakeFetch())).status).toBe(400);
  });
});

describe('reportPayload', () => {
  it('neemt de plaats van de vraag over', () => {
    const item = { type: 'gap', text: 'a ___' };
    const p = reportPayload({ item, ref: { ch: 19, ex: { id: 'x', title: 'X' }, idx: 0 }, number: 4, message: ' fout ', answer: 'b', token: 't', page: 'p' });
    expect(p).toMatchObject({ repo: 'bvweerd/svenska_ovningar_b', message: 'fout', shownNumber: 4, chapter: 19, exercise: 'x', exerciseTitle: 'X', itemIndex: 0, itemType: 'gap', token: 't' });
    expect(JSON.parse(p.item)).toEqual(item);
  });
  it('werkt ook zonder plaats (snelle rondes)', () => {
    const p = reportPayload({ item: { type: 'mc' }, message: 'x' });
    expect(p).toMatchObject({ chapter: null, exercise: null, itemIndex: null });
  });
});
