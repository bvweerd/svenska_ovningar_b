// Luisteren: instellingen, uitleg per browser en een dicteeronde.
import { h } from '../dom.js';
import { course } from '../content.js';
import { crumbs, exerciseRunner, findTopic } from '../ui.js';
import { shuffle } from '../build.js';
import { displayAnswer } from '../check/normalize.js';
import {
  speechSupported, speechStatus, swedishVoices, chosenVoice, setVoice, getRate, setRate, speak, stop, onVoicesChanged,
} from '../speech.js';
import { speakButton } from '../render/speak.js';
import { trackEvent } from '../analytics.js';

const TEST_SENTENCE = 'Hej! Jag heter Sanne och jag bor i Uppsala. Nu ska jag dricka en kopp kaffe, sju sjösjuka sjömän och en tjock kjol.';

/** Herkent de browser grofweg, alleen om de juiste uitleg bovenaan te zetten. */
export function detectBrowser(ua = navigator.userAgent, platform = navigator.platform ?? '') {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(platform) && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

const os = () => {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'mac';
  if (/Linux|X11/.test(ua)) return 'linux';
  return 'other';
};

const STEPS = {
  windows: {
    title: 'Windows: Zweedse stem installeren',
    steps: [
      'Open **Instellingen → Tijd en taal → Taal en regio**.',
      'Kies **Een taal toevoegen**, zoek **Svenska (Sverige)** en vink bij de opties **Tekst-naar-spraak** aan. De rest (weergavetaal, handschrift) mag uit.',
      'Wacht tot het downloaden klaar is en **start de browser opnieuw**.',
      'Kies hieronder de stem **Microsoft Bengt** (of een andere Zweedse stem).',
    ],
  },
  mac: {
    title: 'macOS: Zweedse stem downloaden',
    steps: [
      'Open **Systeeminstellingen → Toegankelijkheid → Gesproken materiaal**.',
      'Klik bij **Systeemstem** op het **ⓘ-knopje** (of „Beheer stemmen”).',
      'Zoek **Zweeds** en download bijvoorbeeld **Alva**, **Klara** of **Oskar**. Kies bij voorkeur de versie **(Verbeterd)** of **(Premium)**: die klinkt veel natuurlijker.',
      '**Start de browser opnieuw** en kies hieronder de stem.',
    ],
  },
  linux: {
    title: 'Linux: spraak via speech-dispatcher',
    steps: [
      'Firefox en Chromium gebruiken **speech-dispatcher**. Installeer bijvoorbeeld `speech-dispatcher` en `espeak-ng` met je pakketbeheerder.',
      'espeak-ng heeft een Zweedse stem, maar die klinkt robotachtig. Voor betere kwaliteit kun je een module als **RHVoice** of **Piper** installeren, als die een Zweedse stem heeft.',
      'Start de browser opnieuw.',
    ],
  },
  ios: {
    title: 'iPhone en iPad: Zweedse stem downloaden',
    steps: [
      'Open **Instellingen → Toegankelijkheid → Gesproken materiaal → Stemmen**.',
      'Kies **Zweeds** en download **Alva**, **Klara** of **Oskar** (bij voorkeur „Verbeterd”).',
      'Sluit Safari helemaal af (omhoog vegen in de appkiezer) en open de site opnieuw.',
      'Hoor je niets? Zet het volume omhoog en controleer de **stille modus**: daarin blijft voorlezen soms stil.',
    ],
  },
  android: {
    title: 'Android: Zweedse spraakgegevens installeren',
    steps: [
      'Open **Instellingen → Systeem → Talen en invoer → Tekst-naar-spraak-uitvoer** (de plek verschilt per telefoon; zoek in de instellingen op „tekst-naar-spraak”).',
      'Kies als engine **Spraakservices van Google** en tik op het tandwiel → **Spraakgegevens installeren** → **Svenska (Sverige)**.',
      'Open Chrome opnieuw. Chrome op Android toont soms geen stemmenlijst, maar leest Zweeds dan toch met de Zweedse stem.',
    ],
  },
};

const BROWSERS = [
  {
    id: 'edge', name: 'Microsoft Edge',
    text: 'Edge heeft ingebouwde **online stemmen** van goede kwaliteit, zoals **Microsoft Sofie Online (Natural)**, **Mattias** en **Hillevi**. Kies die hieronder; meestal hoef je niets te installeren. Je hebt wel internet nodig.',
  },
  {
    id: 'chrome', name: 'Google Chrome',
    text: 'Chrome gebruikt de stemmen van je **besturingssysteem** (zie hieronder) en heeft daarnaast een paar eigen online stemmen. Staat er geen Zweedse stem in de lijst, installeer er dan een in Windows of macOS en start Chrome opnieuw. Stopt het voorlezen halverwege, klik dan nog een keer op Luister.',
  },
  {
    id: 'firefox', name: 'Firefox',
    text: 'Firefox gebruikt alleen de stemmen van je **besturingssysteem**. Installeer een Zweedse stem (zie hieronder) en start Firefox opnieuw. Op Linux is speech-dispatcher nodig. Staat in `about:config` de instelling `media.webspeech.synth.enabled` op `false`, zet die dan op `true`.',
  },
  {
    id: 'safari', name: 'Safari op de Mac',
    text: 'Safari gebruikt de stemmen van **macOS**. Download een Zweedse stem (zie hieronder) en start Safari opnieuw. De versies „Verbeterd” en „Premium” klinken het best.',
  },
  {
    id: 'ios', name: 'Safari en Chrome op iPhone en iPad',
    text: 'Alle browsers op iOS gebruiken de stemmen van iOS. Download een Zweedse stem in de instellingen (zie hieronder). Het eerste geluid start pas na een tik op een knop; dat is een beperking van iOS.',
  },
  {
    id: 'android', name: 'Chrome op Android',
    text: 'Chrome op Android gebruikt de spraakengine van de telefoon. Installeer de Zweedse spraakgegevens (zie hieronder).',
  },
];

const md = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

function stepsBlock(key, open) {
  const s = STEPS[key];
  return h('details', { class: 'howto', open },
    h('summary', {}, s.title),
    h('ol', {}, s.steps.map((t) => h('li', { html: md(t) }))));
}

function statusBox() {
  const box = h('div', { class: 'speech-status', 'aria-live': 'polite' });
  const draw = () => {
    const st = speechStatus();
    const v = chosenVoice();
    box.className = `speech-status ${st}`;
    box.replaceChildren(...{
      ok: [h('strong', {}, '✓ Voorlezen werkt.'), ` ${swedishVoices().length} Zweedse ${swedishVoices().length === 1 ? 'stem' : 'stemmen'} gevonden. Gekozen: ${v?.name ?? '—'}.`],
      'no-voice': [h('strong', {}, 'Geen Zweedse stem gevonden.'), ' Deze browser kan wel voorlezen, maar dan met een andere stem of de standaardstem. Installeer een Zweedse stem met de uitleg hieronder. Op Android werkt het vaak toch: probeer de testzin.'],
      unsupported: [h('strong', {}, 'Deze browser kan niet voorlezen.'), ' Probeer een recente versie van Chrome, Edge, Safari of Firefox.'],
    }[st]);
  };
  draw();
  return { box, draw };
}

function voicePicker(onChange) {
  const select = h('select', { class: 'answer-input', 'aria-label': 'Zweedse stem' });
  const draw = () => {
    const voices = swedishVoices();
    const cur = chosenVoice();
    select.replaceChildren(...(voices.length
      ? voices.map((v) => h('option', { value: v.voiceURI || v.name, selected: v === cur }, `${v.name} (${v.lang}${v.localService ? '' : ', online'})`))
      : [h('option', { value: '' }, 'Geen Zweedse stemmen')]));
    select.disabled = !voices.length;
  };
  select.addEventListener('change', () => {
    const v = swedishVoices().find((x) => (x.voiceURI || x.name) === select.value);
    setVoice(v);
    onChange?.();
    speak('Hej! Så här låter jag.');
  });
  draw();
  return { select, draw };
}

function rateSlider() {
  const value = h('span', { class: 'muted' });
  const input = h('input', { type: 'range', min: '0.5', max: '1.3', step: '0.1', value: String(getRate()), 'aria-label': 'Snelheid' });
  const label = () => { value.textContent = `${Math.round(Number(input.value) * 100)}%`; };
  input.addEventListener('input', label);
  input.addEventListener('change', () => setRate(Number(input.value)));
  label();
  return h('span', { class: 'rate' }, input, value);
}

function ratingBox() {
  const out = h('p', { class: 'muted', 'aria-live': 'polite' });
  const rate = (r) => {
    const st = speechStatus();
    const v = chosenVoice();
    trackEvent(`luisteren/oordeel/${r}/${st}/${(v?.name ?? 'geen').replace(/[^\w-]+/g, '-').slice(0, 60)}`, `Luisteren: ${r}`);
    out.textContent = 'Dank je! Je oordeel is anoniem meegeteld.';
  };
  return h('div', { class: 'rating' },
    h('p', {}, 'Hoe klinkt het? Je oordeel helpt om te bepalen of de browserstem goed genoeg is.'),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => rate('goed') }, 'Goed verstaanbaar'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => rate('matig') }, 'Gaat wel'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => rate('slecht') }, 'Slecht')),
    out);
}

let reported = false;
/** Eén keer per bezoek anoniem meetellen of voorlezen werkt (zonder stemnaam als er geen is). */
export function reportSpeechStatus() {
  if (reported) return;
  reported = true;
  setTimeout(() => {
    const st = speechStatus();
    trackEvent(`luisteren/status/${st}/${detectBrowser()}`, `Luisteren: ${st}`);
  }, 2500);
}

export function viewListenSettings() {
  document.title = 'Luisteren instellen · Svenska övningar';
  const browser = detectBrowser();
  const sys = browser === 'ios' || browser === 'android' ? browser : os();
  const status = statusBox();
  const picker = voicePicker(() => status.draw());
  const off = onVoicesChanged(() => {
    if (!document.body.contains(status.box)) return off();
    status.draw();
    picker.draw();
  });
  const mine = BROWSERS.find((b) => b.id === browser);
  const others = BROWSERS.filter((b) => b !== mine);
  return h('div', { class: 'listen-settings' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Luisteren instellen' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Luisteren instellen'),
      h('p', { class: 'lead' }, 'De site leest Zweeds voor met de spraakfunctie van je eigen browser. Hoe goed dat klinkt, hangt af van de Zweedse stemmen op je apparaat.')),
    status.box,
    speechSupported()
      ? h('section', { class: 'block' },
          h('h2', {}, 'Probeer het'),
          h('p', { lang: 'sv', class: 'test-sentence' }, TEST_SENTENCE),
          h('div', { class: 'actions' },
            speakButton(TEST_SENTENCE, { label: 'Speel de testzin af', className: 'big' }),
            h('button', { type: 'button', class: 'btn ghost', onclick: stop }, 'Stop')),
          h('div', { class: 'form-grid' },
            h('label', {}, h('span', {}, 'Stem'), picker.select),
            h('label', {}, h('span', {}, 'Snelheid'), rateSlider())),
          ratingBox())
      : null,
    h('section', { class: 'block prose' },
      h('h2', {}, 'Uitleg voor jouw browser'),
      mine ? h('div', {}, h('h3', {}, mine.name), h('p', { html: md(mine.text) })) : h('p', {}, 'Kies hieronder je browser.'),
      STEPS[sys] ? stepsBlock(sys, true) : null,
      h('h2', {}, 'Andere browsers en systemen'),
      others.map((b) => h('details', { class: 'howto' }, h('summary', {}, b.name), h('p', { html: md(b.text) }))),
      Object.keys(STEPS).filter((k) => k !== sys).map((k) => stepsBlock(k, false)),
      h('h2', {}, 'Werkt het niet?'),
      h('ul', {},
        h('li', {}, 'Start de browser helemaal opnieuw nadat je een stem hebt geïnstalleerd. Browsers lezen de lijst met stemmen alleen bij het opstarten.'),
        h('li', {}, 'Controleer het volume, en op een telefoon de stille modus.'),
        h('li', {}, 'Klinkt het als Nederlands of Engels met een raar accent? Dan wordt er geen Zweedse stem gebruikt. Kies hierboven een stem met „sv-SE” erachter.'),
        h('li', {}, 'Online stemmen (Edge, sommige in Chrome) hebben internet nodig en klinken vaak het best.'),
        h('li', {}, 'Stopt het voorlezen halverwege een tekst? Klik nog een keer op Luister. Lange teksten worden per zin voorgelezen om dat te voorkomen.'),
      ),
    ),
  );
}

// ---------- Dicteeronde ----------
const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

/** Zinnen en woorden uit de beschikbare hoofdstukken om te dicteren. */
export function dictationPool(chapters = course.filter((c) => c.available), { level } = {}) {
  const pool = [];
  for (const ch of chapters) {
    if (level && ch.level !== level) continue;
    for (const v of ch.vocab ?? []) pool.push({ say: v.sv, kind: 'woord', ch });
    for (const ex of ch.exercises) {
      for (const item of ex.items) {
        const list = item.type === 'translate' || item.type === 'transform' ? item.answers : item.type === 'listen' ? [item.say] : null;
        if (!list?.length) continue;
        const s = displayAnswer(list);
        const n = wordCount(s);
        if (n >= 3 && n <= 14) pool.push({ say: s, kind: 'zin', ch, topic: item.topic ?? ex.topic });
      }
    }
  }
  const seen = new Set();
  return pool.filter((p) => (seen.has(p.say) ? false : seen.add(p.say)));
}

export function viewDictation(query) {
  document.title = 'Dictee · Svenska övningar';
  const kind = query?.get('soort') ?? 'zin';
  const pool = dictationPool().filter((p) => p.kind === kind);
  const picked = shuffle(pool).slice(0, 10);
  const head = h('header', { class: 'page-head' },
    h('h1', {}, 'Dictee'),
    h('p', { class: 'instruction' }, kind === 'zin'
      ? 'Luister naar de zin en schrijf op wat je hoort. Hoofdletters en leestekens tellen niet mee.'
      : 'Luister naar het woord en schrijf het op, met en/ett of att als je dat hoort.'),
    h('div', { class: 'actions' },
      h('a', { class: `btn ${kind === 'zin' ? 'primary' : 'ghost'} small`, href: '#/oefenen/luisteren?soort=zin' }, 'Zinnen'),
      h('a', { class: `btn ${kind === 'woord' ? 'primary' : 'ghost'} small`, href: '#/oefenen/luisteren?soort=woord' }, 'Woorden'),
      h('a', { class: 'btn ghost small', href: '#/luisteren' }, 'Luisteren instellen')));
  if (!speechSupported()) {
    return h('div', {}, crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dictee' }), head,
      h('p', {}, 'Deze browser kan niet voorlezen. ', h('a', { href: '#/luisteren' }, 'Bekijk hoe je dat aanzet.')));
  }
  const items = picked.map((p) => ({
    item: { type: 'listen', say: p.say, topic: p.topic },
    label: p.ch.title,
    ctx: { topic: p.topic, findTopic: (t) => findTopic(t, p.ch) },
  }));
  const [list, score, summary] = exerciseRunner(items, {
    advanceAfterReveal: true,
    onFinish: (good, total) => {
      trackEvent(`luisteren/dictee/${kind}/${good}-van-${total}`, 'Dictee');
      return [
        h('h2', {}, `Klaar! ${good} van ${total} in één keer goed.`),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: `#/oefenen/luisteren?soort=${kind}&${Date.now()}` }, 'Nog een ronde'),
          h('a', { class: 'btn ghost', href: '#/oefenen' }, 'Terug naar oefenen')),
      ];
    },
  });
  return h('div', {}, crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dictee' }), head, score, list, summary);
}
