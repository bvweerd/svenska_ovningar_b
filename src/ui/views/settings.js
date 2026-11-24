// Instellingen: luisteren, thema, antwoorden invoeren, naar de volgende vraag en anoniem meetellen.
import { h } from '../dom.js';
import { crumbs, autoNext, setAutoNext } from '../shared.js';
import { getInputMode, setInputMode } from '../items/tiles.js';
import { setPref } from '../../app/progress.js';
import { charBarOn, applyCharBar } from '../components/charbar.js';
import { getTheme, setTheme } from '../components/theme.js';
import { analyticsConfigured, optedOut, setOptOut } from '../../platform/analytics.js';

const checkbox = (label, checked, onChange) => {
  const box = h('input', { type: 'checkbox', checked, onchange: () => onChange(box.checked) });
  return h('label', { class: 'option inline' }, box, h('span', {}, label));
};

const select = (label, value, options, onChange) => {
  const sel = h('select', { class: 'answer-input', 'aria-label': label, onchange: () => onChange(sel.value) },
    options.map(([v, l]) => h('option', { value: v, selected: value === v }, l)));
  return sel;
};

export function viewSettings() {
  document.title = 'Instellingen · Svenska övningar';
  return h('div', { class: 'prose settings' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Instellingen' }),
    h('h1', {}, 'Instellingen'),
    h('p', { class: 'muted' }, 'Instellingen gelden voor dit apparaat.'),

    h('h2', {}, 'Luisteren'),
    h('p', {}, 'De site leest Zweeds voor met de spraakfunctie van je eigen browser. Kies een Zweedse stem, de snelheid en de toonhoogte, en lees hoe je een goede stem krijgt.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: '#/luisteren' }, 'Luisteren instellen')),

    h('h2', {}, 'Licht of donker'),
    select('Thema', getTheme(), [['', 'Automatisch (zoals je apparaat)'], ['light', 'Licht'], ['dark', 'Donker']], setTheme),

    h('h2', {}, 'Antwoorden invoeren'),
    h('p', {}, 'Bij langere antwoorden kun je typen of woordtegels in de goede volgorde aantikken. Op een telefoon of tablet staan standaard de tegels aan.'),
    select('Invoer bij zinnen', getInputMode(),
      [['auto', 'Automatisch (tegels op een touchscreen)'], ['tiles', 'Altijd woordtegels'], ['type', 'Altijd typen']], setInputMode),
    h('p', {}, 'Bij het typen staan er knoppen voor å, ä en ö: op een computer naast „Controleer”, op een telefoon of tablet boven het toetsenbord. Heeft je toetsenbord die letters zelf al, dan kun je de knoppen uitzetten.'),
    checkbox('Knoppen voor å, ä en ö', charBarOn(), (on) => { setPref('charBar', on); applyCharBar(); }),

    h('h2', {}, 'Naar de volgende vraag'),
    h('p', {}, 'Na een goed antwoord gaat de site vanzelf naar de volgende vraag. Typte je je antwoord op een telefoon of tablet, dan staat de cursor meteen in het volgende invulvak en blijft het toetsenbord open. Wil je eerst rustig de uitleg lezen, zet dit dan uit: je tikt dan zelf op „Volgende vraag”.'),
    checkbox('Vanzelf naar de volgende vraag', autoNext(), setAutoNext),

    analyticsConfigured() ? [
      h('h2', {}, 'Anoniem meetellen'),
      h('p', {}, 'Om de site te verbeteren tellen we anoniem mee welke pagina\'s bezocht worden en welke vragen vaak goed of fout gaan, zonder cookies en zonder persoonsgegevens. ', h('a', { href: '#/over' }, 'Meer over privacy'), '.'),
      checkbox('Anoniem meetellen', !optedOut(), (on) => setOptOut(!on)),
    ] : null,
  );
}
