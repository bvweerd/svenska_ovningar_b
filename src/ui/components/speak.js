// Luisterknoppen en de tekst die bij een vraag hoort om voor te lezen.
import { h } from '../dom.js';
import { speak, stop, isSpeaking, speechSupported, speechStatus, getRate, setRate } from '../../platform/speech.js';

/** Kleine keuzelijst voor de voorleessnelheid (geldt overal). */
/**
 * Korte melding dat de voorleesstem een computerstem is. speech-extra: verborgen als er geen
 * Zweedse stem is (dan is er ook niets voor te lezen).
 */
export function voiceNote() {
  return h('p', { class: 'muted small voice-note speech-extra', lang: 'nl' },
    'Je hoort een computerstem van je browser; echte Zweedse uitspraak kan afwijken. ',
    h('a', { href: '#/luisteren' }, 'Luisteren instellen'));
}

export function speedSelect() {
  if (!speechSupported()) return null;
  const opts = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2];
  const cur = getRate();
  const nearest = opts.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
  const sel = h('select', { class: 'speed-select', 'aria-label': 'Voorleessnelheid', title: 'Voorleessnelheid' },
    opts.map((r) => h('option', { value: String(r), selected: r === nearest }, `${Math.round(r * 100)}%`)));
  sel.addEventListener('change', () => {
    setRate(Number(sel.value));
    document.querySelectorAll('.speed-select').forEach((s) => { if (s !== sel) s.value = sel.value; });
  });
  const label = h('span', { class: 'speed-now' }, `${Math.round(nearest * 100)}%`);
  sel.addEventListener('change', () => { label.textContent = `${Math.round(Number(sel.value) * 100)}%`; });
  // Klein uitklapmenu, zodat de snelheid niet bij elke tekst ruimte inneemt.
  return h('details', { class: 'speed-menu' },
    h('summary', { title: 'Voorleessnelheid', 'aria-label': 'Voorleessnelheid' }, h('span', { 'aria-hidden': 'true' }, '⚙'), label),
    h('label', { class: 'speed' }, h('span', {}, 'Snelheid'), sel));
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';

let seq = 0;

/**
 * Knop die Zweedse tekst voorleest; nog een keer klikken stopt.
 * opts: { label, rate, className, getText }
 */
export function speakButton(text, { label = 'Luister', rate, className = '', getText } = {}) {
  if (!speechSupported()) return null;
  const id = `speak-${++seq}`;
  const icon = h('span', { class: 'speak-icon', html: ICON_PLAY });
  const txt = label ? h('span', { class: 'speak-label' }, label) : null;
  const btn = h('button', {
    type: 'button',
    class: `speak-btn${label ? '' : ' icon-only'} ${className}`.trim(),
    'aria-label': label ? undefined : 'Luister',
    title: speechStatus() === 'no-voice' ? 'Geen Zweedse stem gevonden. Zie „Luisteren instellen”.' : label || 'Luister',
  }, icon, txt);
  const setPlaying = (on) => {
    btn.classList.toggle('playing', on);
    icon.innerHTML = on ? ICON_STOP : ICON_PLAY;
    if (txt) txt.textContent = on ? 'Stop' : label;
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSpeaking(id)) {
      stop();
      return;
    }
    setPlaying(true);
    speak(getText ? getText() : text, { id, rate, onEnd: () => setPlaying(false) });
  });
  return btn;
}

