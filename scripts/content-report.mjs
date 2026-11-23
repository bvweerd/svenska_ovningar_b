// Rapport over de taalinhoud en de didactiek, als Markdown (in CI: de samenvatting van de testrun).
// Gebruik: npm run content-report            (naar het scherm)
//          npm run content-report -- --out rapport.md
//
// Het rapport keurt niets af: het laat zien waar de inhoud afwijkt van de lijn in PLAN.md. Alles is een
// benadering zonder woordenboek of taalmodel (de spelregels: geen AI). Hoe er gemeten wordt, staat bij elk
// onderdeel. De B-site telt de inhoud van de A-site (zusterrepo) mee als bekende stof.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

import { root, name, sibling, siblingName } from './sibling.mjs';
import { isProduce } from '../src/core/items/index.js';
import { measure, LINE } from './difficulty-report.mjs';

// ---------- inlezen ----------

export function loadChapters(repo) {
  const dir = path.join(repo, 'content', 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.chapter - b.chapter);
}

const REVIEW = new Set(['herhaling', 'eindtoets']);
const INPUT_SECTIONS = new Set(['luisteren', 'lyssna', 'lasa']);
const OUTPUT_SECTIONS = new Set(['skriva', 'praktiskt']);

/** Alle vragen van een hoofdstuk met hun oefening en onderdeel; stappen van `steps` apart. */
export function questions(ch, { review = false } = {}) {
  const out = [];
  for (const s of ch.sections ?? []) {
    if (!review && REVIEW.has(s.id)) continue;
    for (const ex of s.exercises ?? []) for (const it of ex.items ?? []) {
      for (const x of it.type === 'steps' ? it.steps ?? [] : [it]) {
        out.push({ item: x, parent: it, ex, section: s.id, topic: x.topic ?? it.topic ?? ex.topic, review: REVIEW.has(s.id) });
      }
    }
  }
  return out;
}

// ---------- tekst en woorden ----------

const TOKEN = /\p{L}+(?:[-']\p{L}+)*/gu;
export const tokens = (s) => String(s ?? '').replace(/\*\*|\*/g, '').match(TOKEN) ?? [];

/** Alle varianten van een antwoord: {a|b} → a en b, [x] → met en zonder x. */
const variants = (s) => String(s ?? '').replace(/[[\]]/g, ' ').replace(/\{([^}]*)\}/g, (_, alts) => alts.replace(/\|/g, ' '));
const list = (v) => (v == null ? [] : [].concat(v));

/** Zweedse tekst in een vraag (zonder de Nederlandse opdrachten). */
export function swedishOf(item) {
  const parts = [];
  for (const a of list(item.answers)) parts.push(variants(a));
  for (const k of ['text', 'say', 'sentence', 'statement', 'model', 'start', 'correction']) {
    if (typeof item[k] === 'string') parts.push(variants(item[k]).replace(/___/g, ' '));
  }
  for (const t of list(item.tokens)) parts.push(String(t));
  for (const g of list(item.gaps)) for (const a of list(g.answers)) parts.push(variants(a));
  if (item.type === 'transform' || item.type === 'findError') parts.push(String(item.prompt ?? ''));
  for (const st of list(item.steps)) parts.push(swedishOf(st));
  return parts.join(' ');
}

const vocabText = (v) => [v.sv, v.def, v.pl, v.plDef, v.ex].filter(Boolean).join(' ');

/** Zweedse tekst van een hoofdstuk: woordenlijst, teksten en vragen (zonder herhaling, zonder teksten in `skip`). */
function chapterCorpus(ch, skip = new Set()) {
  const parts = (ch.vocab ?? []).map(vocabText);
  for (const s of ch.sections ?? []) {
    if (REVIEW.has(s.id)) continue;
    for (const ex of s.exercises ?? []) {
      if (skip.has(ex)) continue;
      if (ex.text) parts.push(ex.text);
      for (const it of ex.items ?? []) parts.push(swedishOf(it));
    }
  }
  return parts.join(' ');
}

const lower = (ts) => ts.map((t) => t.toLowerCase());

/** Kent iemand dit woord al? Ook een vervoeging van een bekend woord telt (fråga → frågorna, klara → klarat). */
export function knownWord(word, sets) {
  if (sets.some((k) => k.has(word))) return true;
  for (let cut = 1; cut <= 4 && word.length - cut >= 4; cut++) {
    const stem = word.slice(0, -cut);
    if (sets.some((k) => k.has(stem) || k.has(`${stem}a`) || k.has(`${stem}e`))) return true;
  }
  return false;
}

/** Woordvormen van een woord uit de woordenlijst, en een stam om vervoegingen te herkennen. */
export function forms(v) {
  const strip = (s) => String(s ?? '').replace(/^(en|ett|att)\s+/i, '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
  const head = strip(v.sv).split(/\s+/)[0] ?? '';
  const exact = new Set([head, ...[v.def, v.pl, v.plDef].filter(Boolean).map((f) => strip(f).split(/\s+/).at(-1))]);
  // Werkwoorden en bijvoeglijke naamwoorden: simma → simmar, simmade; stor → stora, större (benadering).
  const stem = head.length >= 4 ? head.replace(/[ae]$/, '') : null;
  return { head, exact, stem };
}

const matches = (f, tokenSet) => {
  for (const x of f.exact) if (tokenSet.has(x)) return true;
  if (!f.stem) return false;
  for (const t of tokenSet) if (t.startsWith(f.stem) && t.length - f.stem.length <= 4) return true;
  return false;
};

// ---------- metingen ----------

/** Vier strands (Nation), benaderd per vraag. Vloeiendheid zit in de app (snelle rondes), niet in de inhoud. */
export function strand(q) {
  const { item, parent, ex, section } = q;
  if (ex.kind === 'situatie' || ex.kind === 'taak' || ['free', 'dialogue'].includes(item.type)
    || OUTPUT_SECTIONS.has(section) || (parent.type === 'steps' && (parent.steps ?? []).some((s) => s.type === 'free'))) return 'output';
  if (ex.text || ex.kind === 'makkelijk' || INPUT_SECTIONS.has(section) || item.type === 'truefalse' || item.type === 'listen') return 'input';
  return 'vorm';
}

const hasFeedback = (item) => list(item.feedback).length > 0 || list(item.gaps).some((g) => list(g.feedback).length > 0);
/** Aantal goede antwoorden dat een vraag accepteert (elke {a|b} vermenigvuldigt, elke [x] verdubbelt). */
const answerVariants = (item) => list(item.answers).reduce((n, a) => {
  const alts = (String(a).match(/\{[^}]*\}/g) ?? []).reduce((m, alt) => m * alt.split('|').length, 1);
  return n + alts * 2 ** (String(a).match(/\[[^\]]*\]/g) ?? []).length;
}, 0);
const words = (s) => tokens(s).length;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const lineFor = (n) => LINE.find((l) => n >= l.from && n <= l.to);

export function analyse(chapters, before = []) {
  const known = new Set(lower(tokens(before.map((ch) => chapterCorpus(ch)).join(' '))));
  // Namen: woorden die nergens met een kleine letter voorkomen (Linda, Uppsala), ook aan het begin van een zin.
  const lowerSeen = new Set(tokens([...before, ...chapters].map((ch) => chapterCorpus(ch)).join(' ')).filter((t) => t[0] === t[0].toLowerCase()));
  const later = chapters.map((ch, i) => new Set(lower(tokens(chapters.slice(i + 1).map((c) => chapterCorpus(c)).join(' ')))));
  // Grammaticakaart → hoofdstuk waar hij staat (beide sites).
  const cardChapter = new Map();
  for (const ch of [...before, ...chapters]) for (const g of ch.grammar ?? []) cardChapter.set(g.id, ch.chapter);

  const rows = [];
  for (const [i, ch] of chapters.entries()) {
    const qs = questions(ch);
    const all = questions(ch, { review: true });
    const strands = { input: 0, output: 0, vorm: 0 };
    for (const q of qs) strands[strand(q)]++;
    const produce = qs.filter((q) => isProduce(q.item));
    const translate = qs.filter((q) => q.item.type === 'translate');
    const narrow = qs.filter((q) => ['translate', 'transform'].includes(q.item.type) && answerVariants(q.item) === 1
      && words(variants(list(q.item.answers)[0])) >= 6);

    // Woordenschat: komt een woord terug in latere hoofdstukken, en wordt het hier in een oefening gebruikt?
    const vocab = ch.vocab ?? [];
    const exerciseWords = new Set(lower(tokens(chapterCorpus({ ...ch, vocab: [] }))));
    const recur = vocab.filter((v) => matches(forms(v), later[i]));
    const onlyList = vocab.filter((v) => !matches(forms(v), exerciseWords));

    // Makkelijke teksten: welk deel van de woorden is al bekend (eerdere hoofdstukken + de rest van dit hoofdstuk)?
    const exercises = (ch.sections ?? []).filter((s) => !REVIEW.has(s.id)).flatMap((s) => s.exercises ?? []);
    const texts = exercises.filter((ex) => ex.text && !ex.listen);
    const seenHere = new Set(lower(tokens(chapterCorpus(ch, new Set(texts)))));
    const coverage = texts.map((ex) => {
      const ts = tokens(ex.text);
      let total = 0;
      const unknown = new Set();
      for (const t of ts) {
        const l = t.toLowerCase();
        if (t[0] !== l[0] && !lowerSeen.has(l)) continue; // naam
        total++;
        if (!knownWord(l, [known, seenHere])) unknown.add(l);
      }
      const miss = ts.filter((t) => unknown.has(t.toLowerCase())).length;
      return { id: ex.id, easy: ex.kind === 'makkelijk', words: total, known: total ? 1 - miss / total : 1, unknown: [...unknown] };
    });

    // Grammatica: vragen per kaart in dit hoofdstuk, en of de kaart later nog terugkomt (ook in herhalingen).
    const cards = (ch.grammar ?? []).map((g) => {
      const here = all.filter((q) => q.topic === g.id).length;
      const after = chapters.slice(i + 1).reduce((n, c) => n + questions(c, { review: true }).filter((q) => q.topic === g.id).length, 0)
        + all.filter((q) => q.review && q.topic === g.id).length;
      return { id: g.id, title: g.title, here, after };
    });
    const forward = all.filter((q) => q.topic && cardChapter.has(q.topic) && cardChapter.get(q.topic) > ch.chapter).length;

    const canDo = (ch.canDo ?? []).map((c) => ({ text: c.text, n: all.filter((q) => (c.topics ?? []).includes(q.topic)).length }));

    rows.push({
      chapter: ch.chapter, m: measure(ch), line: lineFor(ch.chapter), qs: qs.length, strands,
      produce: produce.length, feedback: produce.filter((q) => hasFeedback(q.item)).length,
      translate: translate.length, narrow: narrow.length,
      vocab: vocab.length, recur: recur.length, onlyList: onlyList.map((v) => v.sv),
      coverage, cards, forward, canDo,
    });
    for (const t of tokens(chapterCorpus(ch))) known.add(t.toLowerCase());
  }

  // Dubbele vragen: dezelfde opdrachtzin (prompt of Zweedse zin) meer dan eens op de site.
  const seen = new Map();
  for (const ch of chapters) for (const q of questions(ch)) {
    const key = String(q.item.prompt ?? q.item.text ?? q.item.sentence ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (key.length < 12) continue;
    seen.set(key, [...(seen.get(key) ?? []), ch.chapter]);
  }
  const dupes = [...seen].filter(([, chs]) => chs.length > 1);
  return { rows, dupes };
}

// ---------- Markdown ----------

const TH = { easyKnown: 0.95, readKnown: 0.9, feedback: 0.5, translateA2: 0.35, recur: 0.4, cardMin: 8 };

export function report({ site, chapters, before = [], beforeName = null }) {
  const { rows, dupes } = analyse(chapters, before);
  const flags = [];
  const flag = (ch, text) => flags.push(`- **H${ch}**: ${text}`);
  for (const r of rows) {
    const l = r.line;
    if (l) {
      if (r.m.questions < l.questions) flag(r.chapter, `${r.m.questions} vragen (lijn ≥ ${l.questions}).`);
      if (r.m.answer < l.answer[0]) flag(r.chapter, `antwoordzin gemiddeld ${r.m.answer.toFixed(1)} woorden (lijn ${l.answer.join('–')}).`);
      if (r.m.answer > l.answer[1] + 2) flag(r.chapter, `antwoordzin gemiddeld ${r.m.answer.toFixed(1)} woorden, ruim boven de lijn (${l.answer.join('–')}).`);
      if (r.m.text && r.m.text < l.text[0]) flag(r.chapter, `leestekst ${r.m.text} woorden (lijn ${l.text.join('–')}).`);
    }
    for (const c of r.coverage) {
      if (c.easy && r.chapter >= 2 && c.known < TH.easyKnown) flag(r.chapter, `makkelijke tekst \`${c.id}\`: ${Math.round(c.known * 100)}% bekende woorden (doel ≥ 95%). Nieuw: ${c.unknown.slice(0, 8).join(', ')}${c.unknown.length > 8 ? ' …' : ''}`);
    }
    if (r.produce && r.feedback / r.produce < TH.feedback) flag(r.chapter, `${pct(r.feedback, r.produce)}% van de zelf-maakvragen heeft foutregels.`);
    if (r.chapter >= 7 && r.qs && r.translate / r.qs > TH.translateA2) flag(r.chapter, `${pct(r.translate, r.qs)}% vertalen (vanaf A2 hoort vertalen niet de hoofdvorm te zijn).`);
    const thin = r.cards.filter((c) => c.here < TH.cardMin);
    if (thin.length) flag(r.chapter, `weinig vragen bij ${thin.map((c) => `\`${c.id}\` (${c.here})`).join(', ')} (richtlijn ≥ ${TH.cardMin}).`);
    const once = r.chapter < rows.at(-1).chapter ? r.cards.filter((c) => c.after === 0) : [];
    if (once.length) flag(r.chapter, `komt in geen latere vraag of herhaling terug: ${once.map((c) => `\`${c.id}\``).join(', ')}.`);
    if (r.forward) flag(r.chapter, `${r.forward} vragen over grammatica uit een later hoofdstuk.`);
    // Vlak voor het eind van de site komen er vanzelf weinig hoofdstukken na: alleen melden als er nog ≥ 3 volgen.
    if (r.vocab && rows.at(-1).chapter - r.chapter >= 3 && r.recur / r.vocab < TH.recur) flag(r.chapter, `maar ${pct(r.recur, r.vocab)}% van de woorden komt in latere hoofdstukken terug.`);
  }

  const out = [];
  const p = (...l) => out.push(...l);
  const total = rows.reduce((n, r) => n + r.qs, 0);
  const vocabTotal = rows.reduce((n, r) => n + r.vocab, 0);
  p(`# Inhoud en didactiek: ${site}`, '',
    `${rows.length} hoofdstukken, ${total} vragen (zonder herhaling), ${vocabTotal} woorden in de woordenlijsten.`
    + (before.length ? ` Bekende stof vooraf: ${before.length} hoofdstukken van ${beforeName}.` : '')
    + (beforeName && !before.length ? ` Let op: ${beforeName} niet gevonden, dus geen bekende stof vooraf.` : ''), '',
    'Een signalering, geen oordeel: getallen zijn benaderingen zonder woordenboek. De lijn staat in `PLAN.md`.', '');

  p(`## Aandachtspunten (${flags.length})`, '', ...(flags.length ? flags : ['Geen.']), '');

  p('## Opbouw per hoofdstuk', '',
    'Vragen, antwoordzin en leestekst zoals `npm run difficulty-report`; strands = aandeel van de vragen.',
    '',
    '| H | niveau | vragen | antwoordzin | leestekst | zelf maken | input | output | vorm | vertalen | foutregels |',
    '|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    const s = r.strands;
    p(`| ${r.chapter} | ${r.line?.level ?? '–'} | ${r.m.questions} | ${r.m.answer.toFixed(1)} | ${r.m.text} | ${Math.round(r.m.produce * 100)}% | ${pct(s.input, r.qs)}% | ${pct(s.output, r.qs)}% | ${pct(s.vorm, r.qs)}% | ${pct(r.translate, r.qs)}% | ${pct(r.feedback, r.produce)}% |`);
  }
  const sum = rows.reduce((a, r) => ({ input: a.input + r.strands.input, output: a.output + r.strands.output, vorm: a.vorm + r.strands.vorm }), { input: 0, output: 0, vorm: 0 });
  p('', `Totaal: input ${pct(sum.input, total)}%, output ${pct(sum.output, total)}%, vorm ${pct(sum.vorm, total)}%. Nation adviseert grofweg een kwart per strand; vloeiendheid zit in de app (snelle rondes, vloeiendheidsronde), niet in deze telling.`,
    '', '<details><summary>Hoe de strands en de andere kolommen geteld worden</summary>', '',
    '- **input** (betekenis): vragen bij een tekst, makkelijke teksten, luistervragen, waar/niet waar;',
    '- **output** (betekenis): „Wat zeg je?” (`kind: situatie`), taken, dialogen, (geleid) schrijven;',
    '- **vorm**: de rest (invullen, kiezen, vertalen, omvormen, volgorde, zoek de fout);',
    '- **vertalen**: `translate` t.o.v. alle vragen; **foutregels**: zelf-maakvragen met minstens één `feedback`-regel.',
    '', '</details>', '');

  p('## Woordenschat', '',
    '| H | woorden | komt later terug | alleen in de lijst |', '|---:|---:|---:|---|');
  for (const r of rows) {
    const only = r.onlyList.length ? `${r.onlyList.length}: ${r.onlyList.slice(0, 6).join(', ')}${r.onlyList.length > 6 ? ' …' : ''}` : '–';
    p(`| ${r.chapter} | ${r.vocab} | ${r.vocab ? `${pct(r.recur, r.vocab)}%` : '–'} | ${only} |`);
  }
  p('', '- **Komt later terug**: het woord (of een vorm ervan) staat in een vraag of tekst van een later hoofdstuk op deze site. Woorden die terugkomen, beklijven beter (spreiding).',
    '- **Alleen in de lijst**: het woord staat in de woordenlijst, maar in geen enkele vraag of tekst van het hoofdstuk zelf (wel in de gegenereerde woordenoefeningen).',
    '- Vormen worden herkend via meervoud, bepaalde vorm en een stam (simma → simmar, simmade); onregelmatige vormen worden soms gemist.', '');

  p('## Teksten: bekende woorden', '',
    'Aandeel van de woorden in een tekst dat al eerder voorkwam (vorige hoofdstukken en de rest van dit hoofdstuk). Doel voor makkelijke teksten: 95–98%. Namen (woorden die nergens met een kleine letter voorkomen) tellen niet mee. Een vervoeging van een bekend woord telt als bekend (benadering: zelfde stam).', '',
    '| H | tekst | soort | woorden | bekend | nieuwe woorden |', '|---:|---|---|---:|---:|---|');
  for (const r of rows) for (const c of r.coverage) {
    p(`| ${r.chapter} | \`${c.id}\` | ${c.easy ? 'makkelijk' : 'leestekst'} | ${c.words} | ${Math.round(c.known * 100)}% | ${c.unknown.slice(0, 6).join(', ')}${c.unknown.length > 6 ? ` … (+${c.unknown.length - 6})` : ''} |`);
  }
  p('');

  p('## Grammatica', '',
    'Per grammaticakaart: vragen in het eigen hoofdstuk, en hoeveel nieuwe vragen het onderwerp daarna nog heeft (herhalingsonderdelen en latere hoofdstukken). De dagelijkse herhaling laat oude vragen ook terugkomen; dit gaat over het onderwerp in nieuwe zinnen en contexten (afwisselen).', '',
    '| H | kaart | vragen | later terug |', '|---:|---|---:|---:|');
  for (const r of rows) for (const c of r.cards) p(`| ${r.chapter} | ${c.title ?? c.id} | ${c.here} | ${c.after} |`);
  p('');

  p('## Kan-doen-uitspraken', '', 'Aantal vragen dat meetelt voor het vinkje (test: minstens 5).', '',
    '| H | uitspraak | vragen |', '|---:|---|---:|');
  for (const r of rows) for (const c of r.canDo) p(`| ${r.chapter} | ${c.text.replace(/\|/g, '/')} | ${c.n} |`);
  p('');

  const narrow = rows.filter((r) => r.narrow);
  p('## Antwoordruimte', '',
    'Vertaal- en omvormvragen met een antwoord van 6+ woorden en maar één goede vorm (geen `{a|b}` of `[...]`). Bij langere zinnen zijn er vaak meer goede antwoorden; die worden dan fout gerekend.', '',
    narrow.length ? narrow.map((r) => `H${r.chapter}: ${r.narrow}`).join(' · ') : 'Geen.', '');

  p('## Dubbele vragen', '', dupes.length
    ? `${dupes.length} keer dezelfde opdrachtzin op meer plekken (kan bewust zijn): ${dupes.slice(0, 10).map(([k, chs]) => `„${k.slice(0, 50)}${k.length > 50 ? '…' : ''}” (H${chs.join(', H')})`).join('; ')}${dupes.length > 10 ? ' …' : ''}`
    : 'Geen.', '');
  return out.join('\n');
}

// ---------- opdrachtregel ----------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const chapters = loadChapters(root);
  const isB = name.endsWith('_b');
  const before = isB ? loadChapters(sibling) : [];
  const md = report({ site: name, chapters, before, beforeName: isB ? siblingName : null });
  const i = process.argv.indexOf('--out');
  if (i > 0 && process.argv[i + 1]) fs.writeFileSync(process.argv[i + 1], `${md}\n`);
  else console.log(md);
}
