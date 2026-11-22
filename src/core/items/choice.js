// Kiezen: meerkeuze, meer antwoorden, sorteren, rätt/fel.
import { displayAnswer } from '../check/normalize.js';
import { stripHints, cutLabel } from './spoken.js';

export const mc = {
  type: 'mc',
  name: 'meerkeuze',
  selfChecking: () => true,
  validate(item, err) {
    if (!Array.isArray(item.options) || item.options.length < 2) err('mc heeft minstens 2 opties nodig');
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= (item.options?.length ?? 0)) err('mc-antwoord buiten bereik');
    if (new Set(item.options).size !== item.options?.length) err('mc heeft dubbele opties');
  },
  answerPart: (item) => ['mc', item.options?.[item.answer]],
  spoken: (item) => (item.prompt?.includes('___') ? stripHints(cutLabel(item.prompt).replace('___', String(item.options[item.answer]))) : null),
};

export const multi = {
  type: 'multi',
  name: 'meerdere antwoorden',
  validate(item, err) {
    if (!Array.isArray(item.answers) || !item.answers.length) err('multi heeft antwoorden nodig');
    if (!Array.isArray(item.options) || item.options.length < 2) err('multi heeft minstens 2 opties nodig');
    if (item.answers?.some((a) => !Number.isInteger(a) || a < 0 || a >= (item.options?.length ?? 0))) err('multi-antwoord buiten bereik');
  },
  answerPart: (item) => ['multi', (item.answers ?? []).map((i) => item.options?.[i]).sort()],
};

export const sort = {
  type: 'sort',
  name: 'sorteren',
  selfChecking: () => true,
  validate(item, err) {
    if (!item.categories || item.categories.length < 2) err('sort heeft minstens 2 categorieën nodig');
    if (!item.items?.length || item.items.some((x) => !x.text || !Number.isInteger(x.cat) || x.cat < 0 || x.cat >= (item.categories?.length ?? 0))) err('sort: elk item heeft text en een geldige cat nodig');
  },
  answerPart: (item) => ['sort', item.categories, (item.items ?? []).map((x) => [x.text, x.cat])],
};

export const truefalse = {
  type: 'truefalse',
  name: 'rätt/fel',
  selfChecking: () => true,
  validate(item, err) {
    if (typeof item.answer !== 'boolean' || !item.statement) err('truefalse heeft statement en answer (true/false) nodig');
    if (item.correction && item.answer) err('truefalse: verbetering alleen bij een foute bewering');
    if (!item.answer && item.correction && !item.correction.answers?.length) err('truefalse: verbetering zonder antwoorden');
  },
  answerPart: (item) => ['truefalse', item.statement, item.answer, item.correction?.answers ?? null],
  spoken: (item) => (item.correction ? displayAnswer(item.correction.answers) : item.statement),
};
