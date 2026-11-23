// Pure nakijkfuncties per vraagtype. Geven altijd { correct, tip?, kind? } terug.
import { normalize, variants, expand } from './normalize.js';
import { movedAdverbialOrders } from './adverbial.js';
import { diagnose } from './diagnose.js';
import { clockAnswers, clockFeedback } from './clock.js';

const asList = (x) => (x === undefined ? [] : [].concat(x));

// „Fleur och Bram” = „Bram och Fleur”: twee namen (of een naam en jag/du/…) met och mogen ook andersom.
const PAIR = /(?<![\p{L}\p{N}])(\p{Lu}[\p{L}-]*) och (\p{Lu}[\p{L}-]*|jag|du|han|hon|vi|ni|de)(?![\p{L}\p{N}])/gu;
const SUBJ = new Set(['jag', 'du', 'han', 'hon', 'vi', 'ni', 'de']);
function swapPairs(text) {
  return text.replace(PAIR, (m, a, b, at) => {
    // Een voornaamwoord aan het begin van de zin (Jag och Bram) wordt na het omdraaien klein (Bram och jag).
    const first = at === 0 && SUBJ.has(a.toLowerCase()) ? a.toLowerCase() : a;
    const second = at === 0 && SUBJ.has(b) ? b.charAt(0).toUpperCase() + b.slice(1) : b;
    return `${second} och ${first}`;
  });
}
/** Alle uitgeklapte goede antwoorden, plus dezelfde zinnen met de namen bij och omgedraaid. */
function answerTexts(answers) {
  const list = asList(answers).flatMap((a) => expand(a));
  return [...new Set([...list, ...list.map(swapPairs)])];
}

/**
 * Open tekstantwoord. spec: { answers, feedback?, caseSensitive?, fixedOrder? }
 * ctx.fixedOrder (of spec.fixedOrder): de opdracht schrijft de woordvolgorde voor (bijv. „begin met de
 * tijdsbepaling”). Een andere goede volgorde is dan geen fout, maar ook nog niet goed: { retry, tip }.
 */
export function gradeText(input, spec, ctx = {}) {
  const opts = { caseSensitive: !!spec.caseSensitive };
  const n = normalize(input, opts);
  if (!n) return { correct: false, empty: true, tip: 'Je hebt nog niets ingevuld.' };
  const texts = answerTexts(spec.answers);
  const expected = variants(texts, opts);
  if (expected.includes(n)) return { correct: true };

  // Echte fouten gaan voor: een retry-regel (goed Zweeds, andere vorm) komt pas als geen andere regel past.
  const rules = [...(spec.feedback ?? [])].sort((x, y) => Number(!!x.retry) - Number(!!y.retry));
  for (const f of rules) {
    const hitMatch = asList(f.match).some((m) => variants([m], opts).includes(n));
    const hitContains = asList(f.contains).some((c) => ` ${n} `.includes(` ${normalize(c, opts)} `));
    // retry: goed Zweeds, maar niet wat de opdracht oefent. Geen fout, wel nog een poging (zoals fixedOrder).
    if (hitMatch || hitContains) return f.retry ? { correct: false, retry: true, kind: 'feedback', tip: f.tip } : { correct: false, kind: 'feedback', tip: f.tip };
  }
  // Tijdsbepaling vooraan of achteraan: ook goed (vastgelegde fouten hierboven gaan voor).
  // Uit de patronen mét leestekens, zodat een komma (bijzin) een verplaatsing tegenhoudt.
  const moved = spec.options ? undefined : texts
    .flatMap((e) => movedAdverbialOrders(e, opts).map((m) => ({ ...m, source: e }))).find((m) => m.text === n);
  if (moved) {
    if (spec.fixedOrder || ctx.fixedOrder) {
      // fronted: de leerling zette de tijdsbepaling vooraan, terwijl de opdracht met iets anders begint.
      const tip = moved.fronted
        ? 'Dat is goed Zweeds, maar volg de opdracht: begin de zin zoals gevraagd.'
        : 'Dat is goed Zweeds, maar de opdracht is anders: begin de zin met de tijdsbepaling, net als in het Nederlands. Let dan op de inversie.';
      return { correct: false, retry: true, kind: 'order', tip };
    }
    return { correct: true, moved: true, note: `Het voorbeeldantwoord zet de tijdsbepaling op een andere plek: „${moved.source.replace(/\s+/g, ' ').trim()}”` };
  }
  // Bij een keuzelijst is een vaste tip zinvoller dan een spellingsdiagnose.
  if (spec.options && spec.tip) return { correct: false, kind: 'feedback', tip: spec.tip };
  const d = diagnose(n, expected, ctx);
  return { correct: false, kind: d?.kind ?? 'unknown', tip: d?.tip ?? spec.tip };
}

export function gradeMc(index, item) {
  if (index === null || index === undefined) return { correct: false, empty: true, tip: 'Kies eerst een antwoord.' };
  if (index === item.answer) return { correct: true };
  return { correct: false, kind: 'mc', tip: item.optionTips?.[index] ?? item.tip };
}

export function gradeMulti(indices, item) {
  const chosen = new Set(indices);
  if (!chosen.size) return { correct: false, empty: true, tip: 'Kies minstens één antwoord.' };
  const good = new Set(item.answers);
  const wrong = [...chosen].filter((i) => !good.has(i)).length;
  const missing = [...good].filter((i) => !chosen.has(i)).length;
  if (!wrong && !missing) return { correct: true };
  const parts = [];
  if (wrong) parts.push(`${wrong} van je keuzes ${wrong === 1 ? 'is' : 'zijn'} niet goed`);
  if (missing) parts.push(`je mist er nog ${missing}`);
  const tip = parts.join(' en ') + '.';
  return { correct: false, kind: 'multi', tip: tip[0].toUpperCase() + tip.slice(1) + (item.tip ? ` ${item.tip}` : '') };
}

export function gradeTrueFalse(value, item) {
  if (value === null || value === undefined) return { correct: false, empty: true, tip: 'Kies Rätt of Fel.' };
  if (value === item.answer) return { correct: true };
  return { correct: false, kind: 'truefalse', tip: item.tip ?? 'Lees de tekst nog eens goed.' };
}

/** Zinsbouw: gekozen tegels (inclusief vast eerste woord) tot een zin samenvoegen. */
export function gradeOrder(chosenTokens, item, ctx) {
  if (chosenTokens.length < item.tokens.length) {
    return { correct: false, empty: true, tip: 'Gebruik alle woorden.' };
  }
  const sentence = [item.start, ...chosenTokens].filter(Boolean).join(' ');
  return gradeText(sentence, item, ctx);
}

/** Dialoog: volgorde van regelindexen. De regels staan in de inhoud in de goede volgorde. */
export function gradeDialogue(order, item) {
  const firstWrong = order.findIndex((v, i) => v !== i);
  if (firstWrong === -1) return { correct: true };
  return {
    correct: false,
    kind: 'dialogue',
    tip: `${order.filter((v, i) => v !== i).length} regels staan nog niet op de goede plek (rood); de groene staan goed. Kijk eerst naar regel ${firstWrong + 1}: welke zin is een logische reactie op de zin ervoor?`,
  };
}

/** Koppelen: answer[i] is de gekozen rechterindex bij linkerindex i. */
export function gradeMatch(answer, item) {
  if (answer.some((v) => v === null || v === undefined || v === '')) {
    return { correct: false, empty: true, tip: 'Koppel eerst alle woorden.' };
  }
  const wrong = answer.map((v, i) => (v === i ? null : i)).filter((i) => i !== null);
  if (!wrong.length) return { correct: true, fields: answer.map(() => true) };
  return {
    correct: false,
    kind: 'match',
    fields: answer.map((v, i) => v === i),
    share: shareOf(answer.map((v, i) => v === i)),
    tip: `${wrong.length} ${wrong.length === 1 ? 'koppeling klopt' : 'koppelingen kloppen'} nog niet (rood gemarkeerd).`,
  };
}

/** Deel van de vakjes dat goed is (bij meer dan één vakje), voor deelpunten in de score. */
const shareOf = (fields) => (fields.length > 1 ? fields.filter(Boolean).length / fields.length : undefined);

/** Meerdere tekstvelden (invullen met meerdere gaten, tabellen). */
export function gradeFields(inputs, specs, ctx) {
  const results = specs.map((spec, i) => gradeText(inputs[i], spec, { ...ctx, topic: spec.topic ?? ctx.topic }));
  if (results.every((r) => r.correct)) return { correct: true, fields: results.map(() => true) };
  if (results.every((r) => r.empty)) return { correct: false, empty: true, tip: 'Je hebt nog niets ingevuld.' };
  const firstWrong = results.find((r) => !r.correct && !r.empty && r.tip) ?? results.find((r) => !r.correct);
  const goodCount = results.filter((r) => r.correct).length;
  // Bij meer vakjes: hoeveel er al goed zijn. Die worden groen en blijven staan (zie ui/items/fields.js).
  const prefix = specs.length > 1
    ? `${goodCount} van ${specs.length} goed.${goodCount ? ' De groene staan vast; verbeter de rode.' : ''} `
    : '';
  return {
    correct: false,
    kind: firstWrong.kind,
    fields: results.map((r) => r.correct),
    share: shareOf(results.map((r) => r.correct)),
    tip: (prefix + (firstWrong.tip ?? '')).trim() || undefined,
  };
}

export function clockSpec(item) {
  return {
    answers: clockAnswers(item.time),
    feedback: [...(item.feedback ?? []), ...clockFeedback(item.time)],
    tileStart: 'Klockan är', // met woordtegels staat dit vast vooraan (ui/items/tiles.js)
  };
}

/** „Hulp” bij een vrije schrijfopdracht: wat er in de tekst kan, zonder het na te kijken. */
export function freeHelp(item) {
  return [
    ...(item.minWords ? [`Ongeveer ${item.minWords} woorden`] : []),
    ...(item.require ?? []).map((req) => req.label ?? `Gebruik „${[].concat(req.any ?? req.word)[0]}”`),
  ];
}

/** Woorden tellen en kijken welke hulpwoorden erin staan (alleen intern; de leerling ziet geen vinkjes). */
export function checkFree(text, item) {
  const n = normalize(text);
  const words = n ? n.split(' ').length : 0;
  const checks = [];
  if (item.minWords) {
    checks.push({ ok: words >= item.minWords, label: `Minstens ${item.minWords} woorden (nu ${words})` });
  }
  for (const req of item.require ?? []) {
    const opts = [].concat(req.any ?? req.word);
    const ok = opts.some((w) => ` ${n} `.includes(` ${normalize(w)} `));
    checks.push({ ok, label: req.label ?? `Gebruikt „${opts[0]}”` });
  }
  return { checks, allOk: checks.every((c) => c.ok), words };
}

/** Sorteren: choice[i] is de gekozen categorie bij item i. */
export function gradeSort(choice, item) {
  if (choice.some((c) => c === null || c === undefined)) return { correct: false, empty: true, tip: 'Kies bij elke regel een categorie.' };
  const fields = choice.map((c, i) => c === item.items[i].cat);
  const wrong = fields.map((ok, i) => (ok ? null : i)).filter((i) => i !== null);
  if (!wrong.length) return { correct: true, fields };
  const first = item.items[wrong[0]];
  const tip = first.tip ? `„${first.text.replace(/\*/g, '')}”: ${first.tip}` : item.tip;
  return {
    correct: false,
    kind: 'sort',
    fields,
    share: shareOf(fields),
    tip: `${wrong.length === 1 ? 'Eén regel staat' : `${wrong.length} regels staan`} nog in de verkeerde categorie.${tip ? ` ${tip}` : ''}`,
  };
}
