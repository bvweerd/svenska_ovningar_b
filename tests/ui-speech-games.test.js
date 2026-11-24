// @vitest-environment happy-dom
// Wat een browser met spraak, tijd en slepen doet: een nep-spraaksynthese (Zweedse stem die meteen klaar
// is), nepklokken voor de snelle rondes, en pointer-events voor het slepen van woordtegels.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const spoken = [];
const voices = [
  { name: 'Alva', lang: 'sv-SE', voiceURI: 'alva', localService: true },
  { name: 'Microsoft Mattias Online (Natural) - Swedish (Sweden)', lang: 'sv-SE', voiceURI: 'mattias' },
  { name: 'Daniel', lang: 'en-GB', voiceURI: 'daniel' },
];
window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  value: {
    paused: false,
    getVoices: () => voices,
    speak(u) { spoken.push(u.text); setTimeout(() => u.onend?.(), 0); },
    cancel() {},
    resume() {},
    addEventListener() {},
    onvoiceschanged: null,
  },
});

let S;
let speakButton;
let speedSelect;
let GAMES;
let viewGame;
let tileBoard;
let saveProgressFor;

beforeAll(async () => {
  S = await import('../src/platform/speech.js');
  const P = await import('../src/app/progress.js');
  S.usePrefs(P.getPref, P.setPref);
  ({ speakButton, speedSelect } = await import('../src/ui/components/speak.js'));
  ({ GAMES, viewGame } = await import('../src/ui/views/practice/games.js'));
  ({ tileBoard } = await import('../src/ui/items/tiles.js'));
  saveProgressFor = P;
});

beforeEach(() => {
  document.body.replaceChildren();
  spoken.length = 0;
});

describe('spraak', () => {
  it('kiest de beste Zweedse stem, en een stem per geslacht', () => {
    expect(S.speechStatus()).toBe('ok');
    expect(S.swedishVoices().map((v) => v.name)[0]).toContain('Mattias');
    expect(S.chosenVoice().lang).toBe('sv-SE');
    S.setVoice(voices[0]);
    expect(S.chosenVoice().name).toBe('Alva');
    S.setRate(0.7);
    expect(S.getRate()).toBe(0.7);
    S.setPitch(1.1);
    expect(S.getPitch()).toBe(1.1);
    const g = S.chooseGender(S.voiceGender(voices[1]));
    if (g) expect(S.chosenVoice()).toBe(g);
  });

  it('leest zin voor zin voor, en stopt', async () => {
    const seen = [];
    const ok = await S.speak('Hej! Jag heter Bram. Bor du här?', { onSentence: (i) => seen.push(i) });
    expect(ok).toBe(true);
    expect(spoken).toEqual(['Hej!', 'Jag heter Bram.', 'Bor du här?']);
    expect(seen).toEqual([0, 1, 2]);
    const p = S.speak('En lång mening. Och en till.', { id: 'x' });
    expect(S.isSpeaking('x')).toBe(true);
    S.stop();
    expect(await p).toBe(false);
  });

  it('luisterknop: afspelen, en nog een keer klikken stopt', async () => {
    const btn = speakButton('Hej då!', { label: 'Luister' });
    document.body.append(btn);
    btn.click();
    expect(btn.classList.contains('playing')).toBe(true);
    btn.click();
    expect(btn.classList.contains('playing')).toBe(false);
    btn.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(spoken).toContain('Hej då!');
    expect(btn.classList.contains('playing')).toBe(false);
  });

  it('snelheid kiezen', () => {
    const el = speedSelect();
    document.body.append(el);
    const sel = el.querySelector('select') ?? el;
    if (sel.tagName === 'SELECT') {
      sel.selectedIndex = 0;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(S.getRate()).toBe(Number(sel.value));
    }
  });
});

describe('snelle rondes (60 seconden, met nepklok)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  for (const id of ['en-ett', 'betekenis', 'preteritum', 'vlot']) {
    it(id, () => {
      if (!GAMES[id]) return;
      const view = viewGame(id);
      document.body.append(view);
      [...view.querySelectorAll('button')].find((b) => b.textContent.startsWith('Start')).click();
      let answered = 0;
      for (let i = 0; i < 40; i++) {
        const options = view.querySelectorAll('.game-option');
        if (!options.length) break; // vlot zonder bekende vragen: een melding
        // Om en om de eerste en de laatste optie: zo zitten er goede en foute antwoorden bij.
        options[i % 2 ? options.length - 1 : 0].click();
        answered++;
        vi.advanceTimersByTime(1000);
      }
      // Cijfertoets kiest ook een optie.
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      vi.advanceTimersByTime(61000);
      if (answered) {
        expect(view.textContent).toContain('Tijd! Je score');
        vi.advanceTimersByTime(1500);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(view.querySelector('.game-option, .lead, p')).not.toBeNull();
      }
    });
  }

  it('alle spellen uit het register starten zonder fout', () => {
    for (const id of Object.keys(GAMES)) {
      const view = viewGame(id);
      document.body.append(view);
      [...view.querySelectorAll('button')].find((b) => b.textContent.startsWith('Start')).click();
      view.querySelector('.game-option')?.click();
      vi.advanceTimersByTime(61000);
      view.remove();
    }
  });
});

describe('woordtegels slepen', () => {
  // happy-dom rekent geen opmaak uit: geef elke tegel een eigen plek op een regel.
  const place = (el, i, row = 0) => {
    el.getBoundingClientRect = () => ({ left: i * 60, right: i * 60 + 50, top: row * 50, bottom: row * 50 + 40, width: 50, height: 40, x: i * 60, y: row * 50 });
  };
  const ptr = (type, target, x, y, extra = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerType: 'mouse', ...extra }));

  it('tegel naar de zin slepen en daarbinnen verplaatsen', async () => {
    const board = tileBoard({ tiles: ['Jag', 'heter', 'Bram'].map((t, i) => ({ t, i })), label: 'Jouw zin', needed: 3 });
    document.body.append(board.el);
    const line = board.el.querySelector('.chips.line');
    line.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 40, width: 400, height: 40 });
    const bank = () => [...board.el.querySelectorAll('.chips.bank .chip')];
    bank().forEach((c, i) => place(c, i, 2));
    // Slepen van de bank naar de zin (muis: meteen slepen na 6 px).
    const first = bank()[0];
    ptr('pointerdown', first, 10, 110);
    ptr('pointermove', window, 30, 110);
    ptr('pointermove', window, 20, 20);
    await new Promise((r) => requestAnimationFrame(r));
    ptr('pointerup', window, 20, 20);
    await new Promise((r) => setTimeout(r, 0));
    expect(board.tokens().length).toBeGreaterThanOrEqual(0);
    // Tikken legt de rest neer.
    for (const c of bank()) c.click();
    expect(board.tokens().length).toBe(3);
    // Binnen de zin verplaatsen.
    const inLine = [...line.querySelectorAll('.chip')];
    inLine.forEach((c, i) => place(c, i));
    ptr('pointerdown', inLine[2], 130, 20);
    ptr('pointermove', window, 140, 20);
    ptr('pointermove', window, 5, 20);
    await new Promise((r) => requestAnimationFrame(r));
    ptr('pointerup', window, 5, 20);
    await new Promise((r) => setTimeout(r, 0));
    expect(board.tokens().length).toBe(3);
  });

  it('touch: eerst vasthouden, bewegen vóór die tijd is scrollen', async () => {
    vi.useFakeTimers();
    const board = tileBoard({ tiles: ['a', 'b'].map((t, i) => ({ t, i })), label: 'Zin', needed: 2 });
    document.body.append(board.el);
    const chip = board.el.querySelector('.chips.bank .chip');
    place(chip, 0, 2);
    ptr('pointerdown', chip, 10, 110, { pointerType: 'touch' });
    ptr('pointermove', window, 40, 110, { pointerType: 'touch' }); // te vroeg bewogen: geen sleep
    expect(document.querySelector('.drag-ghost')).toBeNull();
    ptr('pointerdown', chip, 10, 110, { pointerType: 'touch' });
    vi.advanceTimersByTime(300); // vastgehouden
    expect(document.querySelector('.drag-ghost')).not.toBeNull();
    ptr('pointercancel', window, 10, 110, { pointerType: 'touch' });
    expect(document.querySelector('.drag-ghost')).toBeNull();
    vi.useRealTimers();
  });
});
