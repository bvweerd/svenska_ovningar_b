// Gedeelde bouwstenen voor de renderers per vraagtype (zie index.js).
import { h } from '../dom.js';
import { inline } from '../md.js';
import { displayAnswer } from '../../core/check/normalize.js';
import { gradeText } from '../../core/check/grade.js';
import { sentenceInput } from './tiles.js';

export const prompt = (text) => (text ? h('p', { class: 'prompt', html: inline(text) }) : null);

export function markFields(inputs, fields) {
  inputs.forEach((inp, i) => {
    inp.classList.toggle('ok', fields?.[i] === true);
    inp.classList.toggle('bad', fields?.[i] === false);
  });
}

/** Aantal tekens van het langste goede antwoord (minstens 4), voor de breedte van een veld. */
export const fieldChars = (spec) => Math.max(...[].concat(spec.answers ?? ['']).map((a) => displayAnswer([a]).length), 4) + 1;

export function textInput(spec, { size, label, wide } = {}) {
  const longest = fieldChars(spec) - 1;
  return h('input', {
    type: 'text',
    class: `answer-input${wide ? ' wide' : ''}`,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    lang: 'sv',
    'aria-label': label ?? 'Antwoord',
    size: size ?? Math.min(longest + 2, 40),
  });
}

export function lockInputs(root) {
  root.querySelectorAll('input, select, button.chip, button.move, textarea').forEach((e) => (e.disabled = true));
}

/** Zinsveld (typen of woordtegels) met nakijken; gedeeld door vertalen, omvormen, luisteren enz. */
export function sentenceField(spec, ctx, { label, source, prefill, topic } = {}) {
  const field = sentenceInput(spec, { label, source, prefill, textInput, onComplete: () => ctx.ready?.() });
  return {
    field,
    check() {
      const res = gradeText(field.value(), spec, topic ? { ...ctx, topic } : ctx);
      field.mark(res.empty ? undefined : res.correct);
      return res;
    },
    reveal() {
      field.reveal(displayAnswer(spec.answers));
    },
  };
}
