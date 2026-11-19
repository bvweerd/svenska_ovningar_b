// Voorlezen met de spraakfunctie van de browser (Web Speech API, speechSynthesis).
// Geen eigen geluidsbestanden: de kwaliteit hangt af van de Zweedse stemmen op het apparaat.
import { getPref, setPref } from './progress.js';

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

export const speechSupported = () => !!synth() && typeof window.SpeechSynthesisUtterance === 'function';

const isSwedish = (v) => /^sv([-_]|$)/i.test(v.lang ?? '');

let voicesCache = [];
let voicesReady = false; // de lijst is geladen (of we hebben lang genoeg gewacht)
const listeners = new Set();

function loadVoices() {
  const s = synth();
  if (!s) return [];
  const all = s.getVoices() ?? [];
  if (all.length) {
    voicesCache = all;
    voicesReady = true;
  }
  return voicesCache;
}

/** Telefoon of tablet: daar leest de browser vaak Zweeds voor zonder dat er een stem in de lijst staat. */
export function isMobileDevice(ua = globalThis.navigator?.userAgent ?? '', platform = globalThis.navigator?.platform ?? '', touch = globalThis.navigator?.maxTouchPoints ?? 0) {
  return /Android|iPhone|iPad|iPod/.test(ua) || (/Mac/.test(platform) && touch > 1);
}

/**
 * Moeten de extra luisterknoppen weg? Alleen als zeker is dat er geen Zweedse stem is:
 * de lijst is geladen, er staat geen Zweedse stem in en het is geen telefoon of tablet.
 * Anders leest een Nederlandse of Engelse stem het Zweeds voor, met de verkeerde uitspraak.
 */
export function noSwedishVoice({ ready = voicesReady, voices = voicesCache, mobile = isMobileDevice(), supported = speechSupported() } = {}) {
  // Kan de browser helemaal niet voorlezen, dan zijn er geen knoppen (status 'unsupported').
  return supported && ready && !mobile && !voices.some(isSwedish);
}

/** Zet de klasse no-sv-voice op <html>; de CSS verbergt daarmee de extra knoppen (zie styles.css). */
function updateVoiceClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('no-sv-voice', noSwedishVoice());
}

if (speechSupported()) {
  loadVoices();
  updateVoiceClass();
  // Chrome en Firefox laden de stemmen pas later in.
  synth().addEventListener?.('voiceschanged', () => {
    loadVoices();
    voicesReady = true;
    updateVoiceClass();
    listeners.forEach((fn) => fn());
  });
  // Komt er geen voiceschanged (sommige browsers zonder stemmen), dan na even wachten beslissen.
  setTimeout(() => {
    loadVoices();
    voicesReady = true;
    updateVoiceClass();
  }, 2000);
}

/** Roept fn aan als de lijst met stemmen verandert. Geeft een afmeldfunctie terug. */
export function onVoicesChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}


/** Hogere score = waarschijnlijk betere stem. */
export function voiceScore(v) {
  let s = 0;
  if (/^sv[-_]SE$/i.test(v.lang)) s += 4;
  if (/natural|neural|online|premium|enhanced|förbättrad|wavenet/i.test(v.name)) s += 3;
  if (/google|microsoft|siri|alva|klara|oskar|sofie|mattias|hillevi/i.test(v.name)) s += 1;
  if (/espeak|compact|eloquence/i.test(v.name)) s -= 3;
  return s;
}

// De Web Speech API zegt niet of een stem een man of een vrouw is; we herkennen bekende namen.
const FEMALE = /alva|klara|sofie|hillevi|astrid|elin|ingrid|karin|female|kvinna|woman/i;
const MALE = /oskar|mattias|bengt|erik|\bmale\b|\bman\b/i;

/** 'v' (vrouw), 'm' (man) of null (onbekend). */
export function voiceGender(v) {
  if (FEMALE.test(v.name)) return 'v';
  if (MALE.test(v.name)) return 'm';
  return null;
}

export function swedishVoices() {
  return loadVoices().filter(isSwedish).sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function chosenVoice() {
  const voices = swedishVoices();
  const wanted = getPref('voice', null);
  return voices.find((v) => v.voiceURI === wanted || v.name === wanted) ?? voices[0] ?? null;
}

export const setVoice = (v) => setPref('voice', v ? v.voiceURI || v.name : null);
export const getRate = () => getPref('rate', 0.9);
export const setRate = (r) => setPref('rate', r);
export const getPitch = () => getPref('pitch', 1);
export const setPitch = (p) => setPref('pitch', p);

/** Kiest de beste stem van een geslacht. Geeft de stem terug, of null als die er niet is. */
export function chooseGender(g) {
  const v = swedishVoices().find((x) => voiceGender(x) === g) ?? null;
  if (v) setVoice(v);
  return v;
}

/**
 * Status voor de gebruiker:
 *  'ok'          Zweedse stem gevonden
 *  'no-voice'    spraak werkt, maar geen Zweedse stem (de browser probeert het toch met lang=sv-SE)
 *  'unsupported' deze browser kan niet voorlezen
 */
export function speechStatus() {
  if (!speechSupported()) return 'unsupported';
  return swedishVoices().length ? 'ok' : 'no-voice';
}

/** Lange teksten in zinnen opdelen: Chrome breekt lange uitingen soms halverwege af. */
export function splitSentences(text) {
  const clean = String(text)
    .replace(/\*\*|__|\*|_|~~/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-–]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?…]+[.!?…]+["”»)]*|[^.!?…]+$/g) ?? [clean];
  const out = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (p.length <= 200) out.push(p);
    else out.push(...p.split(/(?<=[,;:])\s+/));
  }
  return out;
}

let current = null; // { id, onEnd }
let token = 0;

export function stop() {
  token++;
  const prev = current;
  current = null;
  synth()?.cancel();
  prev?.onEnd?.();
}

export const isSpeaking = (id) => current?.id === id;

/**
 * Leest Zweedse tekst voor. Geeft een Promise die afloopt als alles is voorgelezen (of gestopt).
 * opts: { rate, id, onEnd, onSentence(i) }
 */
export function speak(text, opts = {}) {
  if (!speechSupported()) return Promise.resolve(false);
  stop();
  const s = synth();
  const my = ++token;
  const sentences = splitSentences(text);
  const voice = chosenVoice();
  const rate = opts.rate ?? getRate();
  current = { id: opts.id ?? text, onEnd: opts.onEnd };
  return new Promise((resolve) => {
    let i = 0;
    const done = (ok) => {
      if (my === token) {
        const c = current;
        current = null;
        c?.onEnd?.();
      }
      resolve(ok);
    };
    const next = () => {
      if (my !== token) return resolve(false);
      if (i >= sentences.length) return done(true);
      const u = new SpeechSynthesisUtterance(sentences[i]);
      u.lang = voice?.lang ?? 'sv-SE';
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = opts.pitch ?? getPitch();
      opts.onSentence?.(i);
      u.onend = () => { i++; next(); };
      u.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return resolve(false);
        done(false);
      };
      s.speak(u);
    };
    // Safari en Chrome raken soms in een gepauzeerde toestand.
    if (s.paused) s.resume();
    next();
  });
}
