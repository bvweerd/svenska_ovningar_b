// Luisteren, klok, zinsbouw, koppelen en dialoog.
import { displayAnswer } from '../check/normalize.js';
import { firstWords } from './text.js';

export const listen = {
  type: 'listen',
  name: 'luisteren',
  selfChecking: (item) => !!item.options,
  validate(item, err) {
    if (!item.say) err('listen heeft een tekst (say) nodig');
    if (item.options && (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)) err('listen: antwoord buiten bereik');
  },
  answerPart: (item) => ['listen', item.say, item.options ? item.options[item.answer] : item.answers ?? null],
  spoken: (item) => (item.answers?.length ? displayAnswer(item.answers) : null),
};

export const clock = {
  type: 'clock',
  name: 'klok',
  validate(item, err) {
    if (!/^\d{1,2}:\d{2}$/.test(item.time ?? '')) err('clock heeft een tijd "uu:mm" nodig');
  },
  answerPart: (item) => ['clock', item.time],
};

export const order = {
  type: 'order',
  name: 'zinsbouw',
  produce: true,
  answerSentence: true,
  validate(item, err) {
    if (!item.tokens?.length || !item.answers?.length) err('order heeft tokens en antwoorden nodig');
  },
  hint: (item) => firstWords(item.answers),
  spoken: (item) => (item.answers?.length ? displayAnswer(item.answers) : null),
};

export const match = {
  type: 'match',
  name: 'koppelen',
  selfChecking: () => true,
  validate(item, err) {
    if (!item.pairs?.length || item.pairs.some((p) => p.length !== 2)) err('match heeft paren [links, rechts] nodig');
  },
  answerPart: (item) => ['match', item.pairs],
};

export const dialogue = {
  type: 'dialogue',
  name: 'dialoog',
  selfChecking: () => true,
  validate(item, err) {
    if (!item.lines || item.lines.length < 3) err('dialogue heeft minstens 3 regels nodig');
  },
  answerPart: (item) => ['dialogue', item.lines],
  spoken: (item) => item.lines.map((l) => l.replace(/^[^:]{1,20}:\s*/, '')).join(' '),
};
