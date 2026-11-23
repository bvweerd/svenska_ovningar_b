// Zelf schrijven: invullen, vertalen, omvormen, tabel, zoek de fout en vrij schrijven.
import { h } from '../dom.js';
import { inline } from '../md.js';
import { shuffle } from '../../core/content/build.js';
import { checkFree, freeHelp } from '../../core/check/grade.js';
import { prompt, fieldChars, textInput, lockInputs, sentenceField, fieldsItem, sentenceLock } from './fields.js';

// ---------- Invullen ----------
export function gap(item, ctx) {
  const parts = item.text.split('___');
  const fields = [];
  const sentence = h('p', { class: 'gap-text', lang: 'sv' });
  parts.forEach((part, i) => {
    // Een hint direct na het gat, zoals „(arbeta)”, blijft aan het veld vast (zie hieronder).
    if (i > 0) part = part.replace(/^\s*\([^()]{1,40}\)/, '');
    sentence.append(h('span', { html: inline(part) }));
    if (i < parts.length - 1) {
      const g = item.gaps[i];
      let f;
      if (g.options) {
        f = h('select', {
          class: 'answer-input',
          'aria-label': `Gat ${i + 1}`,
          onchange: () => {
            if (item.gaps.every((x) => x.options) && fields.every((x) => x.value)) ctx.auto?.();
          },
        },
          h('option', { value: '' }, '…'),
          (g.shuffle === false ? g.options : shuffle(g.options)).map((o) => h('option', { value: o }, o)),
        );
      } else {
        f = textInput(g, { label: `Gat ${i + 1}` });
        // Zo breed als het langste goede antwoord (net als het size-attribuut), in ch: dan blijft
        // de zin bij elkaar en breekt hij niet over regels zoals bij een breed veld.
        f.style.width = `calc(${Math.min(fieldChars(g), 30)}ch + 18px)`;
      }
      fields.push(f);
      const hint = parts[i + 1].match(/^\s*\(([^()]{1,40})\)/);
      sentence.append(hint
        ? h('span', { class: 'gap-field' }, f, h('span', { class: 'gap-hint', html: ` (${inline(hint[1])})` }))
        : f);
    }
  });
  const el = h('div', {}, prompt(item.prompt), sentence, item.hint ? h('p', { class: 'hint' }, item.hint) : null);
  return { el, ...fieldsItem(el, fields, item.gaps, ctx) };
}

export function translate(item, ctx) {
  const f = sentenceField(item, ctx, { label: 'Jouw vertaling' });
  const el = h('div', {}, h('p', { class: 'prompt source' }, item.prompt), f.field.el);
  return { el, check: f.check, reveal: f.reveal, lock: sentenceLock(f, el) };
}

// ---------- Omvormen: een Zweedse zin herschrijven (actief → passief, twee zinnen → één) ----------
export function transform(item, ctx) {
  const f = sentenceField(item, ctx, { label: 'Jouw zin', source: item.prompt });
  const el = h('div', {},
    item.task ? h('p', { class: 'task', html: inline(item.task) }) : null,
    h('p', { class: 'prompt source', lang: 'sv', html: inline(item.prompt) }),
    f.field.el);
  return { el, check: f.check, reveal: f.reveal, lock: sentenceLock(f, el) };
}

export function table(item, ctx) {
  const specs = [];
  const inputs = [];
  const rows = item.rows.map((row) =>
    h('tr', {}, row.map((cell, c) => {
      if (cell && typeof cell === 'object') {
        const inp = textInput(cell, { label: item.columns[c] });
        specs.push(cell);
        inputs.push(inp);
        return h('td', { 'data-label': item.columns[c] }, inp);
      }
      return h(c === 0 ? 'th' : 'td', { lang: 'sv', scope: c === 0 ? 'row' : undefined, 'data-label': c === 0 ? undefined : item.columns[c] }, String(cell ?? ''));
    })),
  );
  const el = h('div', {}, prompt(item.prompt),
    h('div', { class: 'table-wrap' }, h('table', { class: 'fill' }, h('thead', {}, h('tr', {}, item.columns.map((c) => h('th', {}, c)))), h('tbody', {}, rows))),
  );
  return { el, ...fieldsItem(el, inputs, specs, ctx) };
}

// ---------- Vrij schrijven ----------
// De laatste, vrijblijvende stap van een schrijfopdracht (na de nagekeken stappen ervoor). De app
// beoordeelt de tekst niet: geen vinkjes, geen oordeel. „Hulp” somt op wat erin kan (minWords,
// require); na „Klaar” of „Toon voorbeeld” volgt het voorbeeldantwoord.
export function free(item) {
  const area = h('textarea', { class: 'answer-input free', rows: 6, lang: 'sv', spellcheck: false, 'aria-label': 'Jouw tekst' });
  const tips = freeHelp(item);
  const help = tips.length ? h('details', { class: 'help' }, h('summary', {}, 'Hulp'), h('ul', {}, tips.map((t) => h('li', {}, t)))) : null;
  const model = item.model ? h('details', { class: 'model' }, h('summary', {}, 'Voorbeeldantwoord'), h('p', { lang: 'sv' }, item.model)) : null;
  if (model) model.hidden = true;
  const showModel = () => {
    if (model) { model.hidden = false; model.open = true; }
  };
  const el = h('div', {},
    h('p', { class: 'muted optional' }, 'Vrij schrijven, mag je overslaan. De app kijkt dit niet na: vergelijk je tekst met het voorbeeld.'),
    prompt(item.prompt), help, area, model);
  return {
    el,
    check() {
      if (!checkFree(area.value, item).words) return { correct: false, empty: true, tip: 'Schrijf eerst je tekst, of kies „Toon voorbeeld”.' };
      showModel();
      return { correct: true, neutral: true };
    },
    reveal: showModel,
    lock: () => lockInputs(el),
  };
}

// ---------- Zoek de fout ----------
export function findError(item, ctx) {
  const words = item.sentence.split(' ');
  let phase = 'find';
  let chosen = null;
  let fixField = null;
  const buttons = words.map((w, i) =>
    h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': 'false',
      onclick: () => {
        if (phase !== 'find') return;
        chosen = i;
        buttons.forEach((b, k) => {
          b.classList.toggle('selected', k === i);
          b.classList.remove('bad');
          b.setAttribute('aria-pressed', String(k === i));
        });
        ctx.auto?.();
      },
    }, w),
  );
  const fix = h('div', { class: 'correction', hidden: true });
  const el = h('div', {},
    prompt(item.prompt ?? 'Klik op het woord dat niet klopt.'),
    h('div', { class: 'chips find-error', lang: 'sv', role: 'group', 'aria-label': 'Woorden van de zin' }, buttons),
    fix,
  );
  const showFix = (label) => {
    fixField = sentenceField(item, ctx, { label: 'Verbeterde zin', source: item.sentence, prefill: item.sentence });
    fix.replaceChildren(h('p', { class: 'prompt' }, fixField.field.kind === 'tiles' ? label.replace('Verbeter nu de zin:', 'Maak nu de goede zin:') : label), fixField.field.el);
    fix.hidden = false;
  };
  return {
    el,
    check() {
      if (phase === 'find') {
        if (chosen === null) return { correct: false, empty: true, tip: 'Klik eerst op het woord dat niet klopt.' };
        if (item.wrong.includes(chosen)) {
          buttons[chosen].classList.add('ok');
          phase = 'fix';
          buttons.forEach((b) => (b.disabled = true));
          showFix('Goed gevonden! Verbeter nu de zin:');
          fixField.field.focus();
          return { correct: true, advance: true };
        }
        buttons[chosen].classList.add('bad');
        return { correct: false, kind: 'find', tip: `„${words[chosen]}” is goed. ${item.tip ?? 'Zoek nog eens.'}` };
      }
      return fixField.check();
    },
    reveal() {
      item.wrong.forEach((i) => buttons[i].classList.add('ok'));
      if (!fixField) showFix('Goede zin:');
      fixField.reveal();
    },
    lock: () => { fixField?.field.lock(); lockInputs(el); },
  };
}
