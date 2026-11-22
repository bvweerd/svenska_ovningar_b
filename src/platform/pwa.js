// De site als app: service worker (offline, updates), installeren en blijvende opslag.
// Het manifest en sw.js worden bij de build gemaakt door scripts/pwa.mjs.

let installPrompt = null;
// Waar: deze pagina heeft op „Bijwerken” geklikt en moet na de wissel opnieuw laden.
let updateRequested = false;
// Wie een nieuwe versie aanbiedt (ui/components/pwa.js); krijgt de wachtende service worker.
let onUpdate = () => {};
// Wie wil weten of „Installeren” kan (de pagina Over, het advies op de startpagina).
const installListeners = new Set();
const onInstallChange = () => installListeners.forEach((fn) => fn());

/** Kan de browser zelf het installatievenster tonen (Chrome, Edge)? */
export const canPromptInstall = () => !!installPrompt;
/** fn wordt aangeroepen als dat verandert; geeft een functie terug om af te melden. */
export function watchInstall(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}
/** Toont het installatievenster van de browser; true als de gebruiker installeerde. */
export async function promptInstall() {
  if (!installPrompt) return false;
  const p = installPrompt;
  installPrompt = null;
  p.prompt();
  const choice = await p.userChoice.catch(() => null);
  onInstallChange();
  return choice?.outcome === 'accepted';
}

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** @param opts.onUpdate(worker)  er staat een nieuwe versie klaar (toon een melding, roep dan applyUpdate aan) */
export function initPwa({ onUpdate: notify } = {}) {
  if (notify) onUpdate = notify;
  // Chrome en Edge: eigen knop „Installeren” op de pagina Over.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    onInstallChange();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    onInstallChange();
  });
  persistStorage();
  // Volgt het thema het systeem, dan verandert de kleur van de statusbalk mee.
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeColor);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) registerWorker();
}

// Vraag de browser de voortgang niet op te ruimen bij weinig ruimte. In de app en in Chrome/Edge
// gebeurt dat zonder vraag aan de gebruiker; in Firefox in de browser zou het een melding geven.
function persistStorage() {
  const s = navigator.storage;
  if (!s?.persist || !(isStandalone() || navigator.userAgentData)) return;
  s.persisted().then((ok) => ok || s.persist()).catch(() => {});
}

async function registerWorker() {
  const sw = navigator.serviceWorker;
  let reloading = false;
  // Alleen opnieuw laden als deze pagina om de update vroeg. Niet bij de eerste installatie, en niet
  // als een ander tabblad bijwerkt: daar kan nog een half getypt antwoord staan. Zo'n tabblad houdt de
  // oude code (die al helemaal geladen is) tot je daar zelf op „Bijwerken” klikt.
  sw.addEventListener('controllerchange', () => {
    if (!updateRequested || reloading) return;
    reloading = true;
    location.reload();
  });
  let reg;
  try {
    reg = await sw.register('./sw.js');
  } catch {
    return;
  }
  const offer = (worker) => onUpdate(worker);
  if (reg.waiting && sw.controller) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && sw.controller) offer(worker);
    });
  });
  // Een geïnstalleerde app blijft vaak lang open: kijk bij terugkeren af en toe of er een nieuwe versie is.
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 30 * 60 * 1000) return;
    lastCheck = Date.now();
    reg.update().catch(() => {});
  });
}

/** Schakelt over op de nieuwe versie; de pagina laadt daarna opnieuw. */
export function applyUpdate(worker) {
  updateRequested = true;
  // Al actief gemaakt vanuit een ander tabblad: dan is er geen wissel meer te wachten.
  if (worker.state === 'activated' || worker.state === 'redundant') location.reload();
  else worker.postMessage('skipWaiting');
}

/** Kleur van de statusbalk (Android) en titelbalk (app op de computer): gelijk aan de bovenbalk, ook in donker thema. */
export function syncThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
  if (!color) return;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.removeAttribute('media');
    meta.content = color;
  }
}
