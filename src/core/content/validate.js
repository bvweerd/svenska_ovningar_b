// Controleert de structuur van een (gebouwd) hoofdstuk. Geeft een lijst foutmeldingen.
import { exampleGap } from './build.js';
import { itemType, isGradable } from '../items/index.js';

function checkItem(item, where, errors, topics) {
  const err = (msg) => errors.push(`${where}: ${msg}`);
  const t = itemType(item.type);
  if (!t) return err(`onbekend type "${item.type}"`);
  if (item.topic && !topics.has(item.topic)) err(`onbekend topic "${item.topic}"`);
  t.validate?.(item, err, (sub, label) => checkItem(sub, `${where} ${label}`, errors, topics));
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
    if (v.def !== undefined) {
      const def = [].concat(v.def);
      if (!noun) err('def (bepaalde vorm) alleen bij een woord met en/ett');
      if (!def.length || def.some((d) => typeof d !== 'string' || !d.trim())) err('def moet een of meer vormen zijn');
    }
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

/** Kan-doen-uitspraken: 2–4 per hoofdstuk, elk met bekende onderwerpen en genoeg vragen om af te vinken. */
function checkCanDo(ch, topics, errors) {
  const err = (msg) => errors.push(`hoofdstuk ${ch.chapter} / canDo: ${msg}`);
  if (!Array.isArray(ch.canDo)) return err('ontbreekt (2 tot 4 uitspraken)');
  if (ch.canDo.length < 2 || ch.canDo.length > 4) err(`${ch.canDo.length} uitspraken, verwacht 2 tot 4`);
  ch.canDo.forEach((c, i) => {
    if (typeof c?.text !== 'string' || !c.text.trim()) err(`#${i + 1} heeft geen tekst`);
    if (!Array.isArray(c?.topics) || !c.topics.length) return err(`#${i + 1} heeft geen topics`);
    for (const t of c.topics) if (!topics.has(t)) err(`#${i + 1}: onbekend topic "${t}"`);
    // Zonder genoeg vragen in dit hoofdstuk kan de uitspraak nooit (eerlijk) worden afgevinkt.
    const set = new Set(c.topics);
    const n = ch.exercises.reduce((sum, ex) => sum + ex.items.filter((it) => isGradable(it) && set.has(it.topic ?? ex.topic)).length, 0);
    if (n < 5) err(`#${i + 1}: maar ${n} vragen over deze topics in dit hoofdstuk (minstens 5)`);
  });
}

/**
 * Geleid schrijven: een schrijfopdracht (`free`) is de laatste, vrijblijvende stap van zijn oefening,
 * na 3 tot 5 vragen die de app nakijkt en die naar de tekst toe werken.
 */
export const WRITING_STEPS = [3, 5];
function checkWriting(ex, where, errors) {
  const items = ex.items ?? [];
  const free = items.filter((it) => it.type === 'free');
  if (!free.length) return;
  const err = (msg) => errors.push(`${where}: ${msg}`);
  if (free.length > 1) err('maar één schrijfopdracht (free) per oefening');
  if (items.at(-1)?.type !== 'free') err('de schrijfopdracht (free) hoort als laatste stap in de oefening');
  if (ex.shuffle) err('een oefening met een schrijfopdracht mag niet schudden (shuffle)');
  const steps = items.length - free.length;
  if (steps < WRITING_STEPS[0] || steps > WRITING_STEPS[1]) err(`${steps} voorbereidende stappen vóór de schrijfopdracht, verwacht ${WRITING_STEPS[0]} tot ${WRITING_STEPS[1]}`);
}

// taak = doeltaak; makkelijk = makkelijke tekst (input met aandacht voor betekenis, telt niet mee voor de
// leestekst-lijn); situatie = „Wat zeg je?” (een situatie in het Nederlands, de leerling zegt het in het Zweeds).
export const EXERCISE_KINDS = new Set(['taak', 'makkelijk', 'situatie']);

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
  checkCanDo(ch, topics, errors);
  for (const ex of ch.exercises) {
    const where = `hoofdstuk ${ch.chapter} / ${ex.id}`;
    if (!ex.id || ids.has(ex.id)) errors.push(`${where}: ontbrekende of dubbele id`);
    ids.add(ex.id);
    if (!ex.title || !ex.instruction) errors.push(`${where}: title en instruction zijn verplicht`);
    if (ex.topic && !topics.has(ex.topic)) errors.push(`${where}: onbekend topic "${ex.topic}"`);
    if (!ex.items?.length) errors.push(`${where}: geen items`);
    // kind: taak = doeltaak; staat in de volgorde bij de dialoog (tests/content.test.js, exercisePhase).
    if (ex.kind !== undefined && !EXERCISE_KINDS.has(ex.kind)) errors.push(`${where}: onbekende kind "${ex.kind}" (bekend: ${[...EXERCISE_KINDS].join(', ')})`);
    if (ex.kind === 'taak' && ex.text) errors.push(`${where}: een taak heeft geen text (anders valt hij uit de dagelijkse herhaling)`);
    if (ex.kind === 'makkelijk' && (!ex.text || ex.listen)) errors.push(`${where}: een makkelijke tekst heeft text en geen listen`);
    if (ex.kind === 'makkelijk' && ex.items?.some((it) => !isGradable(it))) errors.push(`${where}: bij een makkelijke tekst alleen nagekeken vragen`);
    if (ex.kind === 'situatie' && (ex.text || ex.items?.some((it) => it.type !== 'translate'))) errors.push(`${where}: „Wat zeg je?” heeft geen text en alleen translate-vragen (een situatie als prompt)`);
    // Elke vraag heeft een vaste id (npm run ids); daar hangt de voortgang van gebruikers aan.
    const itemIds = new Set();
    ex.items?.forEach((it, i) => {
      if (it.id === undefined || it.id === null || it.id === '') errors.push(`${where} #${i + 1}: vraag zonder id (draai npm run ids)`);
      else if (itemIds.has(it.id)) errors.push(`${where} #${i + 1}: dubbele vraag-id "${it.id}"`);
      else itemIds.add(it.id);
    });
    ex.items?.forEach((it, i) => checkItem(it, `${where} #${i + 1}`, errors, topics));
    checkWriting(ex, where, errors);
  }
  return errors;
}
