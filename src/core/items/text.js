// Zelf schrijven: invullen, vertalen, omvormen, tabel, zoek de fout en vrij schrijven.
import { displayAnswer } from '../check/normalize.js';
import { stripHints, cutLabel } from './spoken.js';

const answersSpoken = (item) => (item.answers?.length ? displayAnswer(item.answers) : null);

/** Hint: het begin van het goede antwoord (eerste woord), zonder het hele antwoord te verklappen. */
export function firstWords(answers) {
  const ws = displayAnswer(answers).split(/\s+/).filter(Boolean);
  return ws.length > 1 ? `Het antwoord begint met „${ws[0]} …”.` : null;
}

/** Hint voor één woord: de eerste letter(s). */
export function firstLetters(answers) {
  const w = displayAnswer(answers);
  if (!w) return null;
  const n = w.length > 6 ? 2 : 1;
  return `${w.slice(0, n)}…`;
}

export const gap = {
  type: 'gap',
  name: 'invullen',
  produce: true,
  selfChecking: (item) => (item.gaps ?? []).every((g) => g.options),
  validate(item, err) {
    if (typeof item.text !== 'string') return err('gap heeft een tekst nodig');
    const holes = (item.text.match(/___/g) ?? []).length;
    if (!holes) err('gap-tekst bevat geen ___');
    if (holes !== item.gaps?.length) err(`gap: ${holes} gaten maar ${item.gaps?.length ?? 0} antwoorden`);
    item.gaps?.forEach((g, i) => {
      if (!g.answers?.length) err(`gap ${i + 1} heeft geen antwoorden`);
      if (g.options && !g.answers?.every((a) => g.options.includes(a))) err(`gap ${i + 1}: antwoord staat niet tussen de opties`);
    });
  },
  answerPart: (item) => ['gap', (item.gaps ?? []).map((g) => g.answers)],
  hint(item) {
    const open = (item.gaps ?? []).filter((g) => !g.options);
    if (!open.length) return null;
    return `Begint met: ${open.map((g) => `„${firstLetters(g.answers)}”`).join(', ')}`;
  },
  spoken(item) {
    if (/→|___.*:/.test(item.text) || item.noSpeak) return null;
    const parts = cutLabel(item.text).split('___');
    return stripHints(parts.map((p, i) => p + (i < item.gaps.length ? displayAnswer(item.gaps[i].answers) : '')).join(''));
  },
};

export const translate = {
  type: 'translate',
  name: 'vertalen',
  produce: true,
  answerSentence: true,
  validate(item, err) {
    if (!item.prompt || !item.answers?.length) err('translate heeft prompt en antwoorden nodig');
  },
  spoken: answersSpoken,
  hint: (item) => firstWords(item.answers) ?? (item.answers?.length ? `Begint met: „${firstLetters(item.answers)}”` : null),
};

export const transform = {
  type: 'transform',
  name: 'omvormen',
  produce: true,
  answerSentence: true,
  validate(item, err) {
    if (!item.prompt || !item.answers?.length) err('transform heeft prompt en antwoorden nodig');
  },
  spoken: answersSpoken,
  hint: (item) => firstWords(item.answers),
};

export const table = {
  type: 'table',
  name: 'tabel',
  validate(item, err) {
    if (!item.columns?.length || !item.rows?.length) err('table heeft kolommen en rijen nodig');
    item.rows?.forEach((r, i) => {
      if (!Array.isArray(r)) err(`tabelrij ${i + 1} is geen lijst`);
      else if (r.length !== item.columns?.length) err(`tabelrij ${i + 1} heeft ${r.length} cellen, verwacht ${item.columns?.length ?? 0}`);
    });
  },
  answerPart: (item) => ['table', (item.rows ?? []).map((r) => r.map((c) => (c && typeof c === 'object' ? c.answers : c)))],
};

export const findError = {
  type: 'findError',
  name: 'zoek de fout',
  produce: true,
  answerSentence: true,
  selfChecking: () => true,
  validate(item, err) {
    const n = (item.sentence ?? '').split(' ').length;
    if (!item.sentence || !item.answers?.length) err('findError heeft sentence en answers nodig');
    if (!Array.isArray(item.wrong) || !item.wrong.length || item.wrong.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) err('findError: wrong moet geldige woordnummers bevatten');
  },
  answerPart: (item) => ['findError', item.sentence, item.wrong, item.answers],
  spoken: answersSpoken,
};

/** Vrij schrijven: de app kijkt het niet na (telt niet mee in voortgang, herhaling of toetsen). */
export const free = {
  type: 'free',
  name: 'schrijven',
  produce: true,
  gradable: false,
  validate(item, err) {
    if (!item.prompt) err('free heeft een prompt nodig');
  },
  answerPart: () => ['free'],
};
