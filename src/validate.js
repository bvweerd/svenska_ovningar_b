// Controleert de structuur van een (gebouwd) hoofdstuk. Geeft een lijst foutmeldingen.
import { exampleGap } from './build.js';

const TYPES = new Set(['mc', 'multi', 'gap', 'translate', 'order', 'match', 'table', 'truefalse', 'clock', 'dialogue', 'free', 'steps', 'findError', 'transform', 'listen', 'sort']);

function checkItem(item, where, errors, topics) {
  const err = (msg) => errors.push(`${where}: ${msg}`);
  if (!TYPES.has(item.type)) return err(`onbekend type "${item.type}"`);
  if (item.topic && !topics.has(item.topic)) err(`onbekend topic "${item.topic}"`);
  switch (item.type) {
    case 'mc':
      if (!Array.isArray(item.options) || item.options.length < 2) err('mc heeft minstens 2 opties nodig');
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= (item.options?.length ?? 0)) err('mc-antwoord buiten bereik');
      if (new Set(item.options).size !== item.options?.length) err('mc heeft dubbele opties');
      break;
    case 'multi':
      if (!Array.isArray(item.answers) || !item.answers.length) err('multi heeft antwoorden nodig');
      if (!Array.isArray(item.options) || item.options.length < 2) err('multi heeft minstens 2 opties nodig');
      if (item.answers?.some((a) => !Number.isInteger(a) || a < 0 || a >= (item.options?.length ?? 0))) err('multi-antwoord buiten bereik');
      break;
    case 'gap': {
      if (typeof item.text !== 'string') { err('gap heeft een tekst nodig'); break; }
      const holes = (item.text.match(/___/g) ?? []).length;
      if (!holes) err('gap-tekst bevat geen ___');
      if (holes !== item.gaps?.length) err(`gap: ${holes} gaten maar ${item.gaps?.length ?? 0} antwoorden`);
      item.gaps?.forEach((g, i) => {
        if (!g.answers?.length) err(`gap ${i + 1} heeft geen antwoorden`);
        if (g.options && !g.answers?.every((a) => g.options.includes(a))) err(`gap ${i + 1}: antwoord staat niet tussen de opties`);
      });
      break;
    }
    case 'translate':
      if (!item.prompt || !item.answers?.length) err('translate heeft prompt en antwoorden nodig');
      break;
    case 'order':
      if (!item.tokens?.length || !item.answers?.length) err('order heeft tokens en antwoorden nodig');
      break;
    case 'match':
      if (!item.pairs?.length || item.pairs.some((p) => p.length !== 2)) err('match heeft paren [links, rechts] nodig');
      break;
    case 'table':
      if (!item.columns?.length || !item.rows?.length) err('table heeft kolommen en rijen nodig');
      item.rows?.forEach((r, i) => {
        if (!Array.isArray(r)) err(`tabelrij ${i + 1} is geen lijst`);
        else if (r.length !== item.columns?.length) err(`tabelrij ${i + 1} heeft ${r.length} cellen, verwacht ${item.columns?.length ?? 0}`);
      });
      break;
    case 'truefalse':
      if (typeof item.answer !== 'boolean' || !item.statement) err('truefalse heeft statement en answer (true/false) nodig');
      if (item.correction && item.answer) err('truefalse: verbetering alleen bij een foute bewering');
      if (!item.answer && item.correction && !item.correction.answers?.length) err('truefalse: verbetering zonder antwoorden');
      break;
    case 'transform':
      if (!item.prompt || !item.answers?.length) err('transform heeft prompt en antwoorden nodig');
      break;
    case 'listen':
      if (!item.say) err('listen heeft een tekst (say) nodig');
      if (item.options && (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)) err('listen: antwoord buiten bereik');
      break;
    case 'sort':
      if (!item.categories || item.categories.length < 2) err('sort heeft minstens 2 categorieën nodig');
      if (!item.items?.length || item.items.some((x) => !x.text || !Number.isInteger(x.cat) || x.cat < 0 || x.cat >= (item.categories?.length ?? 0))) err('sort: elk item heeft text en een geldige cat nodig');
      break;
    case 'clock':
      if (!/^\d{1,2}:\d{2}$/.test(item.time ?? '')) err('clock heeft een tijd "uu:mm" nodig');
      break;
    case 'dialogue':
      if (!item.lines || item.lines.length < 3) err('dialogue heeft minstens 3 regels nodig');
      break;
    case 'free':
      if (!item.prompt) err('free heeft een prompt nodig');
      break;
    case 'findError': {
      const n = (item.sentence ?? '').split(' ').length;
      if (!item.sentence || !item.answers?.length) err('findError heeft sentence en answers nodig');
      if (!Array.isArray(item.wrong) || !item.wrong.length || item.wrong.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) err('findError: wrong moet geldige woordnummers bevatten');
      break;
    }
    case 'steps':
      if (!item.steps?.length || item.steps.length < 2) err('steps heeft minstens 2 stappen nodig');
      item.steps?.forEach((s, i) => checkItem(s, `${where} stap ${i + 1}`, errors, topics));
      break;
  }
}

/** Woordenlijst: { sv, nl, def?, pl?, plDef?, mass?, alt?, ex?, exNl? } (zie vocabExercises in build.js). */
function checkVocab(ch, errors) {
  const seen = new Set();
  (ch.vocab ?? []).forEach((v, i) => {
    const where = `hoofdstuk ${ch.chapter} / woord ${i + 1} (${v?.sv ?? '?'})`;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    if (typeof v?.sv !== 'string' || !v.sv.trim() || typeof v.nl !== 'string' || !v.nl.trim()) return err('sv en nl zijn verplicht');
    if (seen.has(v.sv)) err('staat dubbel in dit hoofdstuk');
    seen.add(v.sv);
    const noun = /^(en|ett) /.test(v.sv);
    if (v.def !== undefined && (!noun || ![].concat(v.def).length || [].concat(v.def).some((d) => typeof d !== 'string' || !d.trim()))) err('def (bepaalde vorm) alleen bij een woord met en/ett');
    if (v.pl !== undefined) {
      const pl = [].concat(v.pl);
      if (!noun) err('pl (meervoud) alleen bij een woord met en/ett');
      if (!pl.length || pl.some((p) => typeof p !== 'string' || !p.trim() || /^(en|ett) /.test(p))) err('pl moet een of meer vormen zonder lidwoord zijn');
    }
    if (v.plDef !== undefined) {
      const d = [].concat(v.plDef);
      if (v.pl === undefined) err('plDef (bepaalde vorm meervoud) alleen samen met pl');
      if (!d.length || d.some((p) => typeof p !== 'string' || !p.trim() || /^(en|ett) /.test(p))) err('plDef moet een of meer vormen zonder lidwoord zijn');
    }
    if (v.mass !== undefined && (v.mass !== true || !noun)) err('mass: true alleen bij een woord met en/ett');
    if (v.ex !== undefined && !exampleGap(v.ex)) err('ex moet precies één **vet** stuk bevatten');
    if (v.ex !== undefined && !v.exNl) err('bij ex hoort exNl (de Nederlandse vertaling)');
    if (v.exNl !== undefined && v.ex === undefined) err('exNl zonder ex');
  });
}

/** @param extraTopics  grammatica-onderwerpen uit andere hoofdstukken (voor herhaling) */
export function validateChapter(ch, extraTopics = []) {
  const errors = [];
  const topics = new Set([...(ch.grammar ?? []).map((g) => g.id), 'woordenschat', ...extraTopics]);
  const ids = new Set();
  if (!Number.isInteger(ch.chapter)) errors.push('hoofdstuknummer ontbreekt');
  for (const g of ch.grammar ?? []) {
    if (!g.id || !g.title || !g.summary || !g.body) errors.push(`grammatica ${g.id ?? '?'}: id, title, summary en body zijn verplicht`);
  }
  checkVocab(ch, errors);
  for (const ex of ch.exercises) {
    const where = `hoofdstuk ${ch.chapter} / ${ex.id}`;
    if (!ex.id || ids.has(ex.id)) errors.push(`${where}: ontbrekende of dubbele id`);
    ids.add(ex.id);
    if (!ex.title || !ex.instruction) errors.push(`${where}: title en instruction zijn verplicht`);
    if (ex.topic && !topics.has(ex.topic)) errors.push(`${where}: onbekend topic "${ex.topic}"`);
    if (!ex.items?.length) errors.push(`${where}: geen items`);
    // Elke vraag heeft een vaste id (npm run ids); daar hangt de voortgang van gebruikers aan.
    const itemIds = new Set();
    ex.items?.forEach((it, i) => {
      if (it.id === undefined || it.id === null || it.id === '') errors.push(`${where} #${i + 1}: vraag zonder id (draai npm run ids)`);
      else if (itemIds.has(it.id)) errors.push(`${where} #${i + 1}: dubbele vraag-id "${it.id}"`);
      else itemIds.add(it.id);
    });
    ex.items?.forEach((it, i) => checkItem(it, `${where} #${i + 1}`, errors, topics));
  }
  return errors;
}
