// Luisteren: dictee of „wat hoor je?” (meerkeuze).
import { h } from '../dom.js';
import { speakButton, speedSelect } from '../components/speak.js';
import { speak, speechStatus } from '../../platform/speech.js';
import { prompt, sentenceField, sentenceLock } from './fields.js';
import { mc } from './choice.js';

// ---------- Luisteren: dictee of „wat hoor je?” ----------
function listenPlayer(item) {
  const status = speechStatus();
  if (status === 'unsupported') {
    const shown = h('p', { class: 'listen-text', lang: 'sv', hidden: true }, item.say);
    return {
      el: h('div', { class: 'listen-player unsupported' },
        h('p', { class: 'muted' }, 'Deze browser kan niet voorlezen. ', h('a', { href: '#/luisteren' }, 'Bekijk hoe je dat aanzet'), ', of lees de tekst.'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { shown.hidden = false; e.currentTarget.remove(); } }, 'Toon de tekst'),
        shown),
      play: () => {},
    };
  }
  // Zonder Zweedse stem (klasse no-sv-voice op <html>) toont de CSS het blok listen-novoice in plaats
  // van de knoppen: een andere stem leert de verkeerde uitspraak aan. „Toch voorlezen” zet ze terug.
  const shown = h('p', { class: 'listen-text', lang: 'sv', hidden: true }, item.say);
  const el = h('div', { class: 'listen-player' },
    h('div', { class: 'listen-normal' },
      speakButton(item.say, { label: 'Luister', className: 'big' }),
      speakButton(item.say, { label: 'Langzaam', rate: 0.6 }),
      speedSelect(),
      status === 'no-voice' ? h('p', { class: 'muted small' }, 'Er is geen Zweedse stem gevonden, dus het kan vreemd klinken. ', h('a', { href: '#/luisteren' }, 'Luisteren instellen')) : null),
    h('div', { class: 'listen-novoice' },
      h('p', { class: 'muted' }, 'Op dit apparaat is geen Zweedse stem gevonden. ', h('a', { href: '#/luisteren' }, 'Installeer er een'), ', of lees de tekst.'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { shown.hidden = false; e.currentTarget.remove(); } }, 'Toon de tekst'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { el.classList.add('forced'); speak(item.say); } }, 'Toch voorlezen'),
      shown),
  );
  // Enter in een leeg veld speelt alleen af als de knoppen ook zichtbaar zijn.
  const audible = () => !document.documentElement.classList.contains('no-sv-voice') || el.classList.contains('forced');
  return { el, play: () => { if (audible()) speak(item.say); } };
}

export function listen(item, ctx) {
  const player = listenPlayer(item);
  if (item.options) {
    const inner = mc({ ...item, type: 'mc', prompt: item.prompt ?? 'Wat hoor je?' }, ctx);
    return { ...inner, el: h('div', {}, player.el, inner.el) };
  }
  const spec = { ...item, answers: item.answers ?? [item.say] };
  const f = sentenceField(spec, ctx, { label: 'Wat hoor je?' });
  // Enter in een leeg typveld: nog een keer afspelen.
  f.field.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input') && !e.target.value.trim()) {
      e.preventDefault();
      e.stopPropagation();
      player.play();
    }
  });
  const el = h('div', {}, player.el, prompt(item.prompt ?? (f.field.kind === 'tiles' ? 'Zet de woorden in de volgorde die je hoort.' : 'Schrijf op wat je hoort.')), f.field.el,
    f.field.kind === 'tiles' ? null : h('p', { class: 'hint speech-extra' }, 'Tip: druk op Enter in het lege veld om het nog eens te horen.'));
  return { el, check: f.check, reveal: f.reveal, lock: sentenceLock(f, el) };
}
