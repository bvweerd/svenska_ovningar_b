// Gedeelde bouwstenen voor de renderers per vraagtype (zie index.js).
import { h } from '../dom.js';
import { inline } from '../md.js';
import { displayAnswer, expand } from '../../core/check/normalize.js';
import { gradeText } from '../../core/check/grade.js';
import { sentenceInput } from './tiles.js';

export const prompt = (text) => (text ? h('p', { class: 'prompt', html: inline(text) }) : null);

export function markFields(inputs, fields) {
  inputs.forEach((inp, i) => {
    inp.classList.toggle('ok', fields?.[i] === true);
    inp.classList.toggle('bad', fields?.[i] === false);
    // Een goed vakje blijft staan: je verbetert alleen wat rood is.
    if (fields?.[i] === true && fields.length > 1) inp.disabled = true;
  });
}

/**
 * Breedte van een veld in tekens. Niet precies de lengte van het antwoord: dan verraadt het veld of
 * er bijvoorbeeld nog -en achter moet. Daarom vaste maten: 14, 22 of 30 tekens, naar het langste
 * goede antwoord (alle varianten).
 */
export function fieldChars(spec) {
  const longest = Math.max(...[].concat(spec.answers ?? ['']).flatMap((a) => expand(String(a))).map((a) => a.length), 1);
  return longest <= 12 ? 14 : longest <= 20 ? 22 : 30;
}

export function textInput(spec, { size, label, wide } = {}) {
  const longest = fieldChars(spec) - 2;
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
