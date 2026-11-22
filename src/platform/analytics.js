// Anonieme statistieken via GoatCounter: paginabezoeken en events (zoals goed/fout per vraag).
// Geen cookies en geen persoonsgegevens. Bezoekers kunnen het uitzetten op de pagina "Over".
import { GOATCOUNTER_CODE, PATH_PREFIX } from '../config.js';
import { read, write } from './storage.js';

const OPT_OUT_KEY = 'svensk-ovningar:analytics-opt-out';
let loaded = false;
const queue = [];

export const analyticsConfigured = () => !!GOATCOUNTER_CODE;

export const optedOut = () => read(OPT_OUT_KEY) === '1';

export function setOptOut(value) {
  write(OPT_OUT_KEY, value ? '1' : null);
  if (!value) initAnalytics();
}

const active = () => analyticsConfigured() && !optedOut();

function send(data) {
  try {
    window.goatcounter?.count?.(data);
  } catch {
    /* meten mag de site nooit breken */
  }
}

export function initAnalytics() {
  if (!active() || loaded || document.querySelector('script[data-goatcounter]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', `https://${GOATCOUNTER_CODE}.goatcounter.com/count`);
  s.setAttribute('data-goatcounter-settings', JSON.stringify({ no_onload: true }));
  s.onload = () => {
    loaded = true;
    queue.splice(0).forEach(send);
  };
  document.head.append(s);
}

function push(data) {
  if (!active()) return;
  if (loaded) send(data);
  else if (queue.length < 50) queue.push(data);
}

/** Paginabezoek. path zonder # en zonder query, bijvoorbeeld "/k/1/o/presens-invullen". */
export function trackPage(path, title) {
  push({ path: `${PATH_PREFIX}${path}`, title });
}

/** Event, bijvoorbeeld "vraag/1/presens-invullen/3/fout". */
export function trackEvent(path, title) {
  push({ path: `${PATH_PREFIX}/${path}`, title, event: true });
}

/** Korte omschrijving van een vraag voor in het dashboard. */
export function itemSummary(item) {
  const raw = item.prompt ?? item.text ?? item.statement ?? item.sentence ?? item.time ?? item.steps?.[0]?.prompt ?? item.steps?.[0]?.text ?? item.type;
  const s = String(raw).replace(/\*\*|\*|___/g, '…').replace(/\s+/g, ' ').trim();
  return s.length > 70 ? `${s.slice(0, 67)}…` : s;
}

export const STATUS_LABEL = { good: 'goed', wrong: 'fout', revealed: 'bekeken', free: 'geschreven' };

export const scoreBucket = (ratio) => (ratio >= 0.8 ? '80-100' : ratio >= 0.6 ? '60-79' : ratio >= 0.4 ? '40-59' : '0-39');
