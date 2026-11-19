// De site als app: service worker (offline, updates), installeren en blijvende opslag.
// Het manifest en sw.js worden bij de build gemaakt door scripts/pwa.mjs.
import { h } from './dom.js';

let installPrompt = null;
// Waar: deze pagina heeft op „Bijwerken” geklikt en moet na de wissel opnieuw laden.
let updateRequested = false;
// De knop op de pagina Over (er is er hooguit één tegelijk).
let onInstallChange = () => {};

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function initPwa() {
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
  const offer = (worker) => showUpdate(worker);
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

function showUpdate(worker) {
  if (document.querySelector('.update-bar')) return;
  const bar = h('div', { class: 'update-bar', role: 'status' },
    h('span', {}, 'Er is een nieuwe versie van de oefeningen.'),
    h('button', { type: 'button', class: 'btn primary small', onclick: () => {
      updateRequested = true;
      // Al actief gemaakt vanuit een ander tabblad: dan is er geen wissel meer te wachten.
      if (worker.state === 'activated' || worker.state === 'redundant') location.reload();
      else worker.postMessage('skipWaiting');
    } }, 'Bijwerken'),
    h('button', { type: 'button', class: 'btn ghost small', onclick: () => bar.remove() }, 'Later'),
  );
  document.body.append(bar);
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

/** Uitleg en knop voor de pagina Over. */
export function installSection() {
  if (isStandalone()) {
    return [
      h('h2', {}, 'App'),
      h('p', {}, 'Je gebruikt de oefeningen als app. Alles werkt ook zonder internet, en je voortgang staat op dit apparaat. Is er een nieuwe versie, dan zie je onderin een melding.'),
    ];
  }
  const btn = h('button', { type: 'button', class: 'btn primary', hidden: true, onclick: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    update();
  } }, 'Installeren als app');
  const update = () => { btn.hidden = !installPrompt; };
  onInstallChange = update;
  update();
  const ios = isIos();
  return [
    h('h2', {}, 'Als app installeren'),
    h('p', {}, 'Je kunt de oefeningen als app op je telefoon, tablet of computer zetten. Ze openen dan met een eigen icoon, zonder adresbalk, en werken ook zonder internet. Je voortgang blijft op je apparaat.'),
    h('div', { class: 'actions' }, btn),
    h('ul', {},
      h('li', {}, h('strong', {}, 'iPhone en iPad: '), 'open de site in Safari, tik op de deelknop (vierkant met pijl omhoog) en kies „Zet op beginscherm”.'),
      h('li', {}, h('strong', {}, 'Android: '), 'tik in Chrome op het menu (⋮) en kies „App installeren” of „Toevoegen aan startscherm”.'),
      h('li', {}, h('strong', {}, 'Computer: '), 'klik in Chrome of Edge op het installatie-icoon rechts in de adresbalk.'),
    ),
    h('p', { class: ios ? null : 'muted' }, ios
      ? 'Let op: op iPhone en iPad heeft de app een eigen opslag, los van Safari. Heb je al in Safari geoefend? Exporteer dan hieronder je voortgang, open de app en importeer het bestand daar. In de app blijft je voortgang ook bewaard als je hem een tijd niet gebruikt; in Safari kan die na een week of zo verdwijnen.'
      : 'Op iPhone en iPad heeft de app een eigen opslag, los van Safari: exporteer je voortgang eerst hieronder en importeer die in de app.'),
  ];
}
