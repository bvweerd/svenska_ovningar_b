// Synchronisatie van voortgang tussen apparaten via de Cloudflare Worker (worker/src/sync.js).
//
// Een synccode (16 tekens, geen account) koppelt apparaten. De code staat in de opslag van de browser onder een
// sleutel die beide sites delen (zelfde domein): één keer koppelen geldt voor de A1–A2- én de B1–B2-site.
// Elke site bewaart wel zijn eigen voortgang. Samenvoegen gebeurt hier, met mergeStates (core/progress/merge.js).
import { SYNC_URL, STORAGE_PREFIX } from '../config.js';
import { hashItem } from '../core/hash.js';
import { read, write } from './storage.js';

// De voortgang zelf: main.js geeft mee hoe je hem leest en samenvoegt (bindProgress).
let progress = { snapshot: () => ({}), merge: () => false };
export function bindProgress(snapshot, merge) {
  progress = { snapshot, merge };
}
const progressSnapshot = () => progress.snapshot();
const mergeProgress = (data) => progress.merge(data);

const CODE_KEY = 'svensk-ovningar:sync-code';
const META_KEY = `${STORAGE_PREFIX}:sync`;
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export const syncConfigured = () => !!SYNC_URL;


/** Code zoals iemand hem intypt → 16 tekens, of null. Spaties, streepjes, hoofdletters en o/i/l mogen. */
export function normalizeCode(input) {
  const c = String(input ?? '').toLowerCase().replace(/[\s-]/g, '').replace(/o/g, '0').replace(/[il]/g, '1');
  return /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/.test(c) ? c : null;
}

export const formatCode = (c) => c.match(/.{4}/g).join('-');

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => ALPHABET[b % 32]).join('');
}

export const getCode = () => normalizeCode(read(CODE_KEY));

export function setCode(code) {
  write(CODE_KEY, code);
  write(META_KEY, null);
}

export function forgetCode() {
  setCode(null);
}

function meta() {
  try { return JSON.parse(read(META_KEY) ?? 'null') ?? {}; } catch { return {}; }
}

export const lastSync = () => meta().at ?? null;

/** Koppellink voor een ander apparaat: opent de site en vraagt of dat apparaat mee wil doen. */
export function linkFor(code, base = location.href.split('#')[0]) {
  return `${base}#/koppel/${formatCode(code)}`;
}

const url = (code, extra = '') => `${SYNC_URL.replace(/\/?$/, '/')}sync/${code}?site=${encodeURIComponent(STORAGE_PREFIX)}${extra}`;

let running = null;

/**
 * Haalt de voortgang van andere apparaten op, voegt samen en stuurt het resultaat terug.
 * @param opts.onlyIfChanged  niets doen als hier niets veranderd is sinds de vorige keer (bij weggaan)
 * @returns { changed } changed = er is hier iets bijgekomen; of null als synchroniseren niet aan staat
 */
export function syncNow(opts = {}) {
  if (!running) running = doSync(opts).finally(() => { running = null; });
  return running;
}

async function doSync({ onlyIfChanged = false, fetchImpl = globalThis.fetch } = {}) {
  const code = getCode();
  if (!syncConfigured() || !code) return null;
  const m = meta();
  if (onlyIfChanged && m.rev && hashItem(progressSnapshot()) === m.hash) return { changed: false };

  let res = await fetchImpl(url(code, m.rev ? `&since=${m.rev}` : ''), { cache: 'no-store' });
  let remote = await res.json();
  if (!res.ok) throw new Error(remote?.error ?? `HTTP ${res.status}`);
  let changed = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (remote.data) changed = mergeProgress(remote.data) || changed;
    const merged = progressSnapshot();
    const hash = hashItem(merged);
    const remoteHash = remote.data ? hashItem(remote.data) : remote.rev === m.rev ? m.hash : null;
    if (remote.rev && hash === remoteHash) {
      write(META_KEY, JSON.stringify({ rev: remote.rev, hash, at: Date.now() }));
      return { changed };
    }
    const body = JSON.stringify({ rev: remote.rev, data: merged });
    res = await fetchImpl(url(code), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: body.length < 60000,
    });
    const answer = await res.json();
    if (res.ok) {
      write(META_KEY, JSON.stringify({ rev: answer.rev, hash, at: Date.now() }));
      return { changed };
    }
    if (res.status !== 409) throw new Error(answer?.error ?? `HTTP ${res.status}`);
    remote = answer; // iemand anders was eerder: opnieuw samenvoegen
  }
  throw new Error('steeds een conflict');
}

/**
 * Synchroniseert vanzelf: bij het openen, bij weggaan (tabblad of app op de achtergrond),
 * bij weer online komen en hooguit eens per twee minuten bij het wisselen van pagina.
 * @param onChange  wordt aangeroepen als er voortgang van een ander apparaat is bijgekomen (optioneel;
 *                  de app luistert zelf naar de voortgang, zie main.js)
 */
export function initSync(onChange = () => {}) {
  if (!syncConfigured()) return;
  const run = (opts) => syncNow(opts).then((r) => { if (r?.changed) onChange(); }).catch(() => { /* offline: later opnieuw */ });
  run();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') run({ onlyIfChanged: true });
    else if (Date.now() - (lastSync() ?? 0) > 120000) run();
  });
  window.addEventListener('online', () => run());
  window.addEventListener('hashchange', () => {
    if (Date.now() - (lastSync() ?? 0) > 120000) run({ onlyIfChanged: true });
  });
}
