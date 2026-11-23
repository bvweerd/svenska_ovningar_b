// @vitest-environment happy-dom
// Componenten die alleen werken met een Worker (meldingen, synchroniseren): met een nep-Worker (fetch) en
// een nep-Turnstile. De echte Worker heeft zijn eigen tests (worker/ in de B-repo).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { externalScripts } from './helpers/external-scripts.js';

vi.mock('../src/config.js', async (orig) => ({
  ...(await orig()), SYNC_URL: 'https://worker.example/', REPORT_URL: 'https://worker.example/report', TURNSTILE_SITEKEY: 'sitekey',
}));

const { reportButton, feedbackButton, currentAnswer, reportPayload } = await import('../src/ui/components/report.js');
const { syncSection, viewLink } = await import('../src/ui/views/sync.js');
const { getCode, setCode } = await import('../src/platform/sync.js');
const { h } = await import('../src/ui/dom.js');

const tick = () => new Promise((r) => setTimeout(r, 0));
const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

/** Nep-Worker: /report en /sync/<code> (volgnummer per code, zoals worker/src/sync.js). */
function fakeWorker({ reportOk = true } = {}) {
  const db = new Map();
  const calls = [];
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method ?? 'GET', body: opts.body });
    const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (String(url).endsWith('/report')) return reportOk ? json(201, { ok: true, number: 7 }) : json(502, { ok: false, error: 'github' });
    const code = String(url).match(/sync\/([^?]+)/)[1];
    const row = db.get(code);
    if ((opts.method ?? 'GET') === 'GET') return json(200, row ? { ok: true, ...row } : { ok: true, rev: 0 });
    const body = JSON.parse(opts.body);
    if ((row?.rev ?? 0) !== body.rev) return json(409, { ok: false, error: 'conflict', ...row });
    const next = { rev: body.rev + 1, data: body.data };
    db.set(code, next);
    return json(200, { ok: true, rev: next.rev });
  });
  return { db, calls };
}

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  window.turnstile = {
    render: (_el, opts) => { setTimeout(() => opts.callback('token-123'), 0); return 1; },
    reset: vi.fn(),
    remove: vi.fn(),
  };
});

describe('Fout gezien?', () => {
  const item = { id: 'ab12', type: 'translate', prompt: 'Ik heet Bram.', answers: ['Jag heter Bram.'] };
  const ref = { ch: 1, ex: { id: 'vertalen', title: 'Vertaal' }, idx: 0 };

  it('neemt het antwoord van de leerling mee', () => {
    const card = h('article', {}, h('input', { type: 'text', value: 'Jag heter Bram' }),
      h('div', { class: 'chips line' }, h('button', { class: 'chip' }, 'Jag'), h('button', { class: 'chip' }, 'heter')),
      h('label', {}, h('input', { type: 'radio', checked: true }), 'Rätt'));
    expect(currentAnswer(card)).toBe('Jag heter | Jag heter Bram | Rätt');
    expect(reportPayload({ item, ref, number: 3, message: ' x ', answer: 'a', token: 't', page: 'p' }))
      .toMatchObject({ itemId: 'ab12', chapter: 1, exercise: 'vertalen', shownNumber: 3, message: 'x', token: 't' });
  });

  it('formulier: te kort, dan versturen na de controle tegen spam', async () => {
    const { calls } = fakeWorker();
    const card = h('article', {}, h('input', { type: 'text', value: 'Jag heter' }));
    const btn = reportButton(item, ref, 3, () => card);
    document.body.append(btn);
    btn.click();
    const dlg = document.querySelector('dialog.report-dialog');
    expect(dlg.textContent).toContain('Vertaal, vraag 3');
    expect(dlg.textContent).toContain('Jag heter');
    const form = dlg.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(dlg.querySelector('.report-status').textContent).toContain('Schrijf kort');
    dlg.querySelector('textarea').value = 'De vertaling klopt niet.';
    await tick();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    await tick();
    expect(calls.at(-1).url).toContain('/report');
    expect(JSON.parse(calls.at(-1).body)).toMatchObject({ itemId: 'ab12', token: 'token-123', message: 'De vertaling klopt niet.' });
    expect(dlg.textContent).toContain('Bedankt');
    button(dlg, 'Sluiten').click();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('Worker geeft een fout: melding en opnieuw proberen kan', async () => {
    fakeWorker({ reportOk: false });
    const btn = feedbackButton();
    document.body.append(btn);
    btn.click();
    const dlg = document.querySelector('dialog.report-dialog');
    expect(dlg.textContent).toContain('Feedback of een probleem melden');
    dlg.querySelector('textarea').value = 'Iets werkt niet.';
    await tick();
    dlg.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    await tick();
    expect(dlg.querySelector('.report-status').textContent).toContain('niet gelukt (github)');
    expect(window.turnstile.reset).toHaveBeenCalled();
    button(dlg, 'Annuleren').click();
  });

  it('Turnstile laadt niet: dat staat in het formulier', async () => {
    delete window.turnstile;
    const btn = feedbackButton();
    document.body.append(btn);
    btn.click();
    const s = externalScripts.find((x) => x.src.includes('turnstile'));
    s.onerror();
    await tick();
    expect(document.querySelector('.report-status').textContent).toContain('kon niet laden');
  });
});

describe('Synchroniseren', () => {
  it('aanzetten, synchroniseren, link kopiëren en ontkoppelen', async () => {
    const { calls } = fakeWorker();
    const [, box] = syncSection();
    document.body.append(box);
    button(box, 'Synchroniseren aanzetten').click();
    await tick();
    await tick();
    expect(getCode()).toMatch(/^[0-9a-z]{16}$/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(true);
    expect(box.textContent).toContain('Synchroniseren staat aan');

    button(box, 'Nu synchroniseren').click();
    await tick();
    await tick();
    expect(box.textContent).toContain('Gesynchroniseerd');

    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });
    button(box, 'Kopieer koppellink').click();
    await tick();
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('#/koppel/');

    window.confirm = () => true;
    button(box, 'Ontkoppelen').click();
    expect(getCode()).toBeNull();
    expect(box.textContent).toContain('Ontkoppeld');
  });

  it('koppelen met een code van een ander apparaat', async () => {
    fakeWorker();
    const [, box] = syncSection();
    document.body.append(box);
    const input = box.querySelector('input[type="text"]');
    input.value = 'geen code';
    button(box, 'Koppelen').click();
    expect(box.textContent).toContain('geen geldige code');
    input.value = 'abcd-efgh-jkmn-pqrs';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await tick();
    await tick();
    expect(getCode()).toBe('abcdefghjkmnpqrs');
    expect(box.textContent).toContain('Gekoppeld en gesynchroniseerd');
  });

  it('Worker onbereikbaar: de app zegt het en probeert het later', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); });
    setCode('abcdefghjkmnpqrs');
    const [, box] = syncSection();
    document.body.append(box);
    button(box, 'Nu synchroniseren').click();
    await tick();
    expect(box.textContent).toContain('lukt nu niet (offline)');
  });

  it('koppellink: geldig, ongeldig', async () => {
    fakeWorker();
    expect(viewLink('onzin').textContent).toContain('werkt niet');
    const page = viewLink('abcd-efgh-jkmn-pqrs');
    document.body.append(page);
    expect(page.textContent).toContain('Apparaat koppelen');
    const yes = [...page.querySelectorAll('button')][0];
    yes.click();
    await tick();
    await tick();
    expect(getCode()).toBe('abcdefghjkmnpqrs');
  });
});
