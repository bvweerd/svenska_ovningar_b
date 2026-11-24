// Gedeelde bouwstenen voor de renderers per vraagtype (zie index.js).
import { h } from '../dom.js';
import { inline } from '../md.js';
import { displayAnswer, expand } from '../../core/check/normalize.js';
import { gradeText, gradeFields } from '../../core/check/grade.js';
import { shuffle } from '../../core/content/build.js';
import { sentenceInput } from './tiles.js';

export const prompt = (text) => (text ? h('p', { class: 'prompt', html: inline(text) }) : null);

/** Volgorde waarin n keuzes getoond worden: door elkaar, tenzij de vraag shuffle: false heeft. */
export function displayOrder(item, n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  return item.shuffle === false ? idx : shuffle(idx);
}

/**
 * Vraag met meer tekstvakjes (gaten, tabel): nakijken per vakje en het goede antwoord invullen.
 * Geeft { check, reveal, lock } voor een renderer.
 */
export function fieldsItem(el, inputs, specs, ctx) {
  return {
    check() {
      const res = gradeFields(inputs.map((f) => f.value), specs, ctx);
      markFields(inputs, res.fields);
      return res;
    },
    reveal() {
      inputs.forEach((f, i) => {
        f.value = displayAnswer(specs[i].answers);
        f.classList.add('revealed');
      });
    },
    lock: () => lockInputs(el),
  };
}

/** Een zinsveld en de rest van de vraag vergrendelen. */
export const sentenceLock = (f, el) => () => { f.field.lock(); lockInputs(el); };

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
  return h('input', {
    type: 'text',
    class: `answer-input${wide ? ' wide' : ''}`,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    lang: 'sv',
    'aria-label': label ?? 'Antwoord',
    size: size ?? fieldChars(spec),
  });
}

export function lockInputs(root) {
  root.querySelectorAll('input, select, button.chip, button.move, textarea').forEach((e) => (e.disabled = true));
}

/** Zinsveld (typen of woordtegels) met nakijken; gedeeld door vertalen, omvormen, luisteren enz. */
export function sentenceField(spec, ctx, { label, source, prefill, topic, placeholder } = {}) {
  const field = sentenceInput(spec, { label, source, prefill, placeholder, textInput, onComplete: () => ctx.ready?.() });
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
