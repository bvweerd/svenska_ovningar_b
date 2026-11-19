// Luisteren: instellingen, uitleg per browser en een dicteeronde.
import { h } from '../dom.js';
import { course } from '../content.js';
import { crumbs, exerciseRunner, findTopic } from '../ui.js';
import { shuffle } from '../build.js';
import { displayAnswer } from '../check/normalize.js';
import {
  speechSupported, speechStatus, swedishVoices, chosenVoice, setVoice, getRate, setRate, speak, stop, onVoicesChanged,
  voiceGender, chooseGender, getPitch, setPitch,
} from '../speech.js';
import { speakButton } from '../render/speak.js';
import { trackEvent } from '../analytics.js';
import { recordDictation, pickDictation, dictationProgress } from '../progress.js';

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
      'Open **Instellingen → Tijd en taal → Spraak**.',
      'Kies bij **Stemmen beheren** de knop **Stemmen toevoegen**, zoek **Zweeds** op en kies **Toevoegen**. Lukt dat niet, open dan Verteller-instellingen met **Windows-toets + Ctrl + N** en kies **Verouderde stemmen toevoegen** (Windows 10: **Meer stemmen toevoegen**); dat brengt je naar dezelfde pagina.',
      'Wacht tot het downloaden klaar is en **start de browser opnieuw**.',
      'Kies hieronder de stem **Microsoft Bengt**. Dat is de enige Zweedse stem van Windows zelf (een mannenstem). Op een computer van je werk kan het toevoegen van stemmen geblokkeerd zijn; gebruik dan Edge (zie hierboven).',
    ],
  },
  mac: {
    title: 'macOS: Zweedse stem downloaden',
    steps: [
      'Open **Systeeminstellingen → Toegankelijkheid → Lezen en spreken** (tot en met macOS 15 heet dit **Gesproken materiaal**).',
      'Klik op het **ⓘ-knopje** naast **Systeemstem**.',
      'Kies **Zweeds** en download **Alva**, **Klara** of **Oskar** (een stem met een downloadsymbool staat nog niet op je Mac).',
      '**Start de browser opnieuw** en kies hieronder de stem. In Firefox verschijnt een nieuwe stem soms pas na het **herstarten van de Mac**.',
    ],
  },
  linux: {
    title: 'Linux: spraak via speech-dispatcher',
    steps: [
      'Browsers lezen op Linux voor via **speech-dispatcher**. Installeer `speech-dispatcher` en `espeak-ng` met je pakketbeheerder.',
      'espeak-ng heeft een Zweedse stem, maar die klinkt robotachtig. Een natuurlijker Zweedse stem kan met **Piper** (stem `sv_SE`), maar dat vraagt extra instellingen in speech-dispatcher.',
      'Start de browser opnieuw.',
    ],
  },
  ios: {
    title: 'iPhone en iPad: Zweedse stem downloaden',
    steps: [
      'Open **Instellingen → Toegankelijkheid → Lezen en spreken → Stemmen** (tot en met iOS 18: **Gesproken materiaal → Stemmen**).',
      'Kies **Zweeds** en download **Alva**, **Klara** of **Oskar**.',
      'Sluit Safari helemaal af (omhoog vegen in de appkiezer) en open de site opnieuw.',
      'Hoor je niets? Zet het volume omhoog en controleer de **stille modus**: daarin blijft voorlezen soms stil.',
    ],
  },
  android: {
    title: 'Android: Zweedse spraakgegevens installeren',
    steps: [
      'Open **Instellingen → Toegankelijkheid → Tekst-naar-spraak-uitvoer**. De plek verschilt per telefoon (bij Samsung bijvoorbeeld onder **Algemeen beheer**); de zoekfunctie in Instellingen vindt het ook.',
      'Kies als voorkeursengine de engine van **Google** en tik op het tandwiel ernaast → **Spraakgegevens installeren** → **Zweeds**.',
      'Open Chrome opnieuw. Chrome op Android toont geen echte stemmenlijst, maar leest Zweeds dan wel met de Zweedse stem voor.',
    ],
  },
};

const BROWSERS = [
  {
    id: 'edge', name: 'Microsoft Edge',
    text: 'Edge heeft ingebouwde **online stemmen** van goede kwaliteit: **Microsoft Sofie Online (Natural)** (vrouw) en **Microsoft Mattias Online (Natural)** (man). Kies die hieronder; je hoeft niets te installeren, maar je hebt wel internet nodig. Edge op Android kan niet voorlezen; gebruik daar Chrome.',
  },
  {
    id: 'chrome', name: 'Google Chrome',
    text: 'Chrome heeft eigen online stemmen, maar **geen Zweedse**. Het gebruikt daarom de Zweedse stem van je **besturingssysteem** (zie hieronder). Staat er geen Zweedse stem in de lijst, installeer er dan een en start Chrome opnieuw. Stopt het voorlezen halverwege, klik dan nog een keer op Luister.',
  },
  {
    id: 'firefox', name: 'Firefox',
    text: 'Firefox gebruikt alleen de stemmen van je **besturingssysteem**: op Windows **Microsoft Bengt**, op de Mac **Alva**, **Klara** of **Oskar**. Installeer een Zweedse stem (zie hieronder) en start Firefox opnieuw. Op Linux is speech-dispatcher nodig. Werkt voorlezen helemaal niet, kijk dan in `about:config` of `media.webspeech.synth.enabled` op `true` staat.',
  },
  {
    id: 'safari', name: 'Safari op de Mac',
    text: 'Safari gebruikt de stemmen van **macOS**. Download een Zweedse stem (zie hieronder) en start Safari opnieuw. Verschijnt de stem daarna niet in de lijst, of verdwijnt hij na het downloaden van een betere versie, probeer dan Chrome of Edge.',
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

const GENDER_LABEL = { v: 'vrouw', m: 'man' };
const NO_MALE = 'Er is geen mannenstem gevonden. In Edge heet die Mattias, op Mac en iPhone Oskar (downloaden bij de stemmen), op Windows Bengt. Zie de uitleg hieronder.';
const NO_FEMALE = 'Er is geen vrouwenstem gevonden. In Edge heet die Sofie, op Mac en iPhone Alva of Klara. Windows zelf heeft alleen een mannenstem (Bengt); gebruik voor een vrouwenstem Edge. Zie de uitleg hieronder.';

function voicePicker(onChange) {
  const select = h('select', { class: 'answer-input', 'aria-label': 'Zweedse stem' });
  const note = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const genderBtn = (g, label) => h('button', {
    type: 'button',
    class: 'btn ghost small toggle',
    onclick: () => {
      const v = chooseGender(g);
      note.textContent = v ? '' : g === 'm' ? NO_MALE : NO_FEMALE;
      draw();
      onChange?.();
      if (v) speak('Hej! Så här låter jag.');
    },
  }, label);
  const buttons = { v: genderBtn('v', 'Vrouwenstem'), m: genderBtn('m', 'Mannenstem') };
  function draw() {
    const voices = swedishVoices();
    const cur = chosenVoice();
    select.replaceChildren(...(voices.length
      ? voices.map((v) => {
          const g = GENDER_LABEL[voiceGender(v)];
          return h('option', { value: v.voiceURI || v.name, selected: v === cur }, `${v.name} (${[g, v.lang, v.localService ? '' : 'online'].filter(Boolean).join(', ')})`);
        })
      : [h('option', { value: '' }, 'Geen Zweedse stemmen')]));
    select.disabled = !voices.length;
    const g = cur ? voiceGender(cur) : null;
    for (const [k, b] of Object.entries(buttons)) {
      b.setAttribute('aria-pressed', String(g === k));
      b.disabled = !voices.length;
    }
  }
  select.addEventListener('change', () => {
    const v = swedishVoices().find((x) => (x.voiceURI || x.name) === select.value);
    setVoice(v);
    note.textContent = '';
    draw();
    onChange?.();
    speak('Hej! Så här låter jag.');
  });
  draw();
  const el = h('div', { class: 'voice-picker' }, h('div', { class: 'actions' }, buttons.v, buttons.m), select, note);
  return { el, draw };
}

const RATE_PRESETS = [['Langzaam', 0.7], ['Normaal', 0.9], ['Snel', 1.1]];

function rateSlider() {
  const value = h('span', { class: 'muted' });
  const input = h('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: String(getRate()), 'aria-label': 'Snelheid' });
  const presets = RATE_PRESETS.map(([label, r]) => h('button', {
    type: 'button',
    class: 'btn ghost small toggle',
    onclick: () => {
      input.value = String(r);
      apply();
      speak('Så här snabbt pratar jag nu.');
    },
  }, label));
  const sync = () => {
    const r = Number(input.value);
    value.textContent = `${Math.round(r * 100)}%`;
    presets.forEach((b, i) => b.setAttribute('aria-pressed', String(Math.abs(RATE_PRESETS[i][1] - r) < 0.01)));
  };
  const apply = () => {
    setRate(Number(input.value));
    sync();
  };
  input.addEventListener('input', sync);
  input.addEventListener('change', apply);
  sync();
  return h('div', {}, h('div', { class: 'actions' }, presets), h('span', { class: 'rate' }, input, value));
}

function pitchSlider() {
  const value = h('span', { class: 'muted' });
  const input = h('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: String(getPitch()), 'aria-label': 'Toonhoogte' });
  const label = () => { value.textContent = Number(input.value) === 1 ? 'normaal' : Number(input.value) < 1 ? 'lager' : 'hoger'; };
  input.addEventListener('input', label);
  input.addEventListener('change', () => {
    setPitch(Number(input.value));
    speak('Hej! Så här låter jag.');
  });
  label();
  const reset = h('button', { type: 'button', class: 'btn ghost small', onclick: () => { input.value = '1'; setPitch(1); label(); } }, 'Normaal');
  return h('div', {}, h('span', { class: 'rate' }, input, value, reset),
    h('p', { class: 'muted small' }, 'Lager klinkt zwaarder, maar maakt van een vrouwenstem geen echte mannenstem. Niet alle stemmen (vooral online stemmen) passen de toonhoogte aan.'));
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
            h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Stem'), picker.el),
            h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Snelheid'), rateSlider()),
            h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Toonhoogte'), pitchSlider())),
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
  // Eerst wat je nog niet gehad hebt of fout had, zodat je niet steeds dezelfde zinnen krijgt.
  const says = pool.map((p) => p.say);
  const chosen = new Set(pickDictation(says, 10));
  const picked = shuffle(pool.filter((p) => chosen.has(p.say)));
  const label = kind === 'zin' ? ['zin', 'zinnen'] : ['woord', 'woorden'];
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
    onItem: (entry, r) => recordDictation(entry.item.say, r.firstTry && !r.revealed),
    onFinish: (good, total) => {
      trackEvent(`luisteren/dictee/${kind}/${good}-van-${total}`, 'Dictee');
      const p = dictationProgress(says);
      const left = p.total - p.seen;
      return [
        h('h2', {}, `Klaar! ${good} van ${total} in één keer goed.`),
        h('p', {}, left || p.wrong
          ? `Je hebt nu ${p.seen} van de ${p.total} ${label[1]} gehad${left ? `; ${left} nog nieuw` : ''}${p.wrong ? `${left ? ',' : ';'} ${p.wrong} om te herhalen` : ''}.`
          : `Je hebt alle ${p.total} ${label[1]} gehad en de laatste keer goed geschreven. Nog een ronde wordt een herhaling.`),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: `#/oefenen/luisteren?soort=${kind}&${Date.now()}` }, 'Nog een ronde'),
          h('a', { class: 'btn ghost', href: '#/oefenen' }, 'Terug naar oefenen')),
      ];
    },
  });
  return h('div', {}, crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dictee' }), head, score, list, summary);
}
