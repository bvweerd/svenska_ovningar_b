// Wat de gebruiker van de app-functies ziet: melding bij een nieuwe versie en uitleg over installeren.
import { h } from '../dom.js';
import { applyUpdate, canPromptInstall, isIos, isStandalone, promptInstall, watchInstall } from '../../platform/pwa.js';

/** Balk onderin: er is een nieuwe versie. */
export function showUpdate(worker) {
  if (document.querySelector('.update-bar')) return;
  const bar = h('div', { class: 'update-bar', role: 'status' },
    h('span', {}, 'Er is een nieuwe versie van de oefeningen.'),
    h('button', { type: 'button', class: 'btn primary small', onclick: () => applyUpdate(worker) }, 'Bijwerken'),
    h('button', { type: 'button', class: 'btn ghost small', onclick: () => bar.remove() }, 'Later'),
  );
  document.body.append(bar);
}

/** Uitleg en knop voor de pagina Over. */
export function installSection() {
  if (isStandalone()) {
    return [
      h('h2', {}, 'App'),
      h('p', {}, 'Je gebruikt de oefeningen als app. Alles werkt ook zonder internet, en je voortgang staat op dit apparaat. Is er een nieuwe versie, dan zie je onderin een melding.'),
    ];
  }
  const btn = h('button', { type: 'button', class: 'btn primary', hidden: true, onclick: () => promptInstall() }, 'Installeren als app');
  const update = () => {
    if (!btn.isConnected && btn.dataset.shown) return stop();
    btn.hidden = !canPromptInstall();
    btn.dataset.shown = '1';
  };
  const stop = watchInstall(update);
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
