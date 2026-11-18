// Luisterknoppen en de tekst die bij een vraag hoort om voor te lezen.
import { h } from '../dom.js';
import { displayAnswer } from '../check/normalize.js';
import { speak, stop, isSpeaking, speechSupported, speechStatus, getRate, setRate } from '../speech.js';

/** Kleine keuzelijst voor de voorleessnelheid (geldt overal). */
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
  return h('label', { class: 'speed' }, h('span', {}, 'Snelheid'), sel);
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

const stripHints = (s) => String(s)
  .replace(/\s*\([^)]*\)/g, '')
  .replace(/\*\*|\*/g, '')
  .replace(/\s+([.,!?])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// "**stanna** (blijven): Vi ___ hemma." → "Vi ___ hemma."
const cutLabel = (s) => {
  const blank = s.indexOf('___');
  const colon = s.lastIndexOf(': ', blank < 0 ? s.length : blank);
  return colon >= 0 ? s.slice(colon + 2) : s;
};

/** De goede Zweedse zin bij een vraag, of null als er niets zinnigs voor te lezen is. */
export function spokenText(item) {
  if (!item) return null;
  if (item.say) return item.say;
  switch (item.type) {
    case 'gap': {
      if (/→|___.*:/.test(item.text) || item.noSpeak) return null;
      const parts = cutLabel(item.text).split('___');
      return stripHints(parts.map((p, i) => p + (i < item.gaps.length ? displayAnswer(item.gaps[i].answers) : '')).join(''));
    }
    case 'translate':
    case 'transform':
    case 'order':
    case 'findError':
    case 'listen':
      return item.answers?.length ? displayAnswer(item.answers) : null;
    case 'truefalse':
      return item.correction ? displayAnswer(item.correction.answers) : item.statement;
    case 'mc':
      return item.prompt?.includes('___') ? stripHints(cutLabel(item.prompt).replace('___', String(item.options[item.answer]))) : null;
    case 'dialogue':
      return item.lines.map((l) => l.replace(/^[^:]{1,20}:\s*/, '')).join(' ');
    case 'steps':
      return [...item.steps].reverse().map(spokenText).find(Boolean) ?? null;
    default:
      return null;
  }
}
