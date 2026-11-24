// Eerste gebruik: een korte kaart „Zo werkt het” en, voor wie de site echt gebruikt, advies om
// hem als app te installeren. Allebei op de startpagina, nooit als venster dat de pagina blokkeert,
// en allebei weg te klikken.
import { h, isTouch, fill } from './dom.js';
import { getPref, setPref, hasProgress } from '../app/progress.js';
import { isStandalone, isIos, canPromptInstall, promptInstall, watchInstall } from '../platform/pwa.js';

const DAY = 24 * 60 * 60 * 1000;
/** Na „Niet nu” komt het advies na zoveel dagen terug. */
export const SNOOZE_DAYS = 21;

/** Telt de bezoeken (één per keer dat de site opent). */
export function countVisit() {
  setPref('visits', (getPref('visits', 0) ?? 0) + 1);
}

/**
 * Welk installatieadvies (of geen): 'prompt' (de browser kan zelf installeren), 'ios' (stappen
 * voor Safari), 'android' (stappen voor het menu) of null.
 * Alleen op een telefoon of tablet, niet in de app zelf, en pas als de site echt gebruikt wordt:
 * een gemaakte vraag of een tweede bezoek.
 */
export function installAdvice({ standalone, touch, canPrompt, ios, used, visits, hint, now }) {
  if (standalone || !touch) return null;
  if (hint?.never || (hint?.until ?? 0) > now) return null;
  if (!used && visits < 2) return null;
  if (canPrompt) return 'prompt';
  if (ios) return 'ios';
  return 'android';
}

/** De kaart „Zo werkt het”: tot je hem wegklikt of je eerste vraag hebt gemaakt. */
export const showIntro = ({ introDone, used }) => !introDone && !used;

const touchDevice = isTouch;

/** Kaarten voor bovenaan de startpagina (kan leeg zijn). */
export function homeNotices() {
  const used = hasProgress();
  return [introCard(used), installCard(used)].filter(Boolean);
}

function introCard(used) {
  if (!showIntro({ introDone: getPref('introDone', false), used })) return null;
  const card = h('section', { class: 'notice intro', 'aria-labelledby': 'intro-title' },
    closeButton('Uitleg sluiten', () => {
      setPref('introDone', true);
      card.remove();
    }),
    h('h2', { id: 'intro-title' }, 'Zo werkt het'),
    h('ul', {},
      h('li', {}, 'Kies hieronder een hoofdstuk en begin met de eerste oefening. Elke oefening wordt meteen nagekeken.'),
      h('li', {}, 'Fout? Dan krijg je een tip en probeer je het nog eens. Na drie pogingen kun je het antwoord bekijken.'),
      h('li', {}, 'Langere antwoorden typ je, of je tikt woordtegels aan. Dat kies je zelf bij de vraag.'),
      h('li', {}, 'Je voortgang blijft op dit apparaat bewaard; je hebt geen account nodig.'),
    ),
    h('p', {}, h('a', { href: '#/over' }, 'Meer uitleg in de handleiding →')),
  );
  return card;
}

function installCard(used) {
  const now = Date.now();
  const kind = () => installAdvice({
    standalone: isStandalone(),
    touch: touchDevice(),
    canPrompt: canPromptInstall(),
    ios: isIos(),
    used,
    visits: getPref('visits', 0),
    hint: getPref('installHint', null),
    now,
  });
  const card = h('section', { class: 'notice install', 'aria-labelledby': 'install-title' });
  const snooze = () => {
    setPref('installHint', { until: Date.now() + SNOOZE_DAYS * DAY });
    close();
  };
  const never = () => {
    setPref('installHint', { never: true });
    close();
  };
  let stop = () => {};
  const close = () => {
    stop();
    card.remove();
  };
  const draw = () => {
    const k = kind();
    if (!k) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const steps = {
      prompt: [h('p', {}, 'Zet de oefeningen als app op je beginscherm: ze openen dan met één tik, zonder adresbalk, en werken ook zonder internet.')],
      ios: [
        h('p', {}, 'Zet de oefeningen als app op je beginscherm. Ze werken dan ook zonder internet, en belangrijker: Safari kan je voortgang wissen als je de site een week niet gebruikt. In de app blijft hij bewaard.'),
        h('ol', {},
          h('li', {}, 'Tik onderin (of bovenin) op de deelknop: het vierkantje met de pijl omhoog.'),
          h('li', {}, 'Kies „Zet op beginscherm” (scroll zo nodig naar beneden).'),
          h('li', {}, 'Tik op „Voeg toe”.'),
        ),
        h('p', { class: 'muted' }, 'Al geoefend in Safari? Exporteer je voortgang eerst op de pagina Voortgang en importeer hem in de app.'),
      ],
      android: [
        h('p', {}, 'Zet de oefeningen als app op je beginscherm: ze openen dan met één tik en werken ook zonder internet.'),
        h('p', {}, 'Tik in je browser op het menu (⋮) en kies „App installeren” of „Toevoegen aan startscherm”.'),
      ],
    }[k];
    fill(card, 
      closeButton('Advies sluiten', snooze),
      h('h2', { id: 'install-title' }, 'Tip: gebruik de oefeningen als app'),
      ...steps,
      h('div', { class: 'actions' },
        k === 'prompt' ? h('button', { type: 'button', class: 'btn primary', onclick: async () => { if (await promptInstall()) never(); } }, 'Installeren') : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: snooze }, 'Niet nu'),
        h('button', { type: 'button', class: 'link-btn', onclick: never }, 'Niet meer tonen'),
      ),
    );
  };
  draw();
  // Chrome meldt pas na het laden dat installeren kan: dan wordt het advies een knop.
  stop = watchInstall(() => (card.isConnected ? draw() : stop()));
  return card;
}

function closeButton(label, onclick) {
  return h('button', { type: 'button', class: 'icon-btn notice-close', 'aria-label': label, title: label, onclick }, '×');
}
