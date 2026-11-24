// Spellingscontrole van het Zweeds met Hunspell en het woordenboek sv_SE (offline, alleen in de tests en dit
// script, niet in de app). Installeren: apt-get install hunspell hunspell-sv (CI doet dat zelf). Zonder
// hunspell slaat de test zich buiten CI over.
// Gebruik: npm run spelling                  (onbekende woorden met hun vindplaats)
//          npm run spelling -- --write       (zet alle onbekende woorden in content/stavning.txt)
//
// Gecontroleerd: woordenlijst (sv, vormen, voorbeeldzin), teksten en alle goede antwoorden (elke variant van
// {a|b} en [..]), zinnen van gap/listen/dictee, woordtegels en de Zweedse opdracht van transform. Niet:
// de foute zin van „Zoek de fout” (die bevat de fout met opzet), foutregels en Nederlandse opdrachten. Daarom
// valt ook weg: tekst tussen haakjes (buiten de woordenlijst: daar staat de Nederlandse betekenis of een
// hint), een gap-zin met → (woordvorming, met Nederlandse uitleg; de antwoorden tellen wel) en een korte
// opdracht vóór een dubbele punt in transform („Maak één zin: …”).
//
// Het woordenboek mist sommige woorden (vaktermen, samenstellingen, delen als „hälso-”). Die staan in
// content/stavning.txt, één per regel; een woord daarin is gecontroleerd en goedgekeurd. De test faalt bij
// elk woord dat het woordenboek niet kent en dat niet in die lijst staat: een tikfout of een nieuw woord.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { root } from './sibling.mjs';
import { loadChapters } from './content-report.mjs';
import { expand } from '../src/core/check/normalize.js';

const list = (v) => (v == null ? [] : [].concat(v));
const WORD = /\p{L}+(?:[-'’]\p{L}+)*/gu;

/** Alle Zweedse tekst van een hoofdstuk als [vindplaats, tekst]. */
export function swedishTexts(ch) {
  const out = [];
  const add = (where, s, { vocab = false } = {}) => {
    let t = String(s ?? '').replace(/\*\*|\*/g, '').replace(/___/g, ' ');
    if (!vocab) t = t.replace(/\([^()]*\)/g, ' ');
    for (const v of expand(t)) out.push([where, v]);
  };
  const item = (it, where) => {
    for (const a of list(it.answers)) add(where, a);
    for (const k of ['say', 'statement', 'model', 'start', 'correction']) if (typeof it[k] === 'string') add(where, it[k]);
    if (typeof it.text === 'string' && !(it.type === 'gap' && it.text.includes('→'))) add(where, it.text);
    for (const t of list(it.tokens)) add(where, t);
    for (const g of list(it.gaps)) for (const a of list(g.answers)) add(where, a);
    if (it.type === 'transform') add(where, String(it.prompt ?? '').replace(/^(?:\S+\s){0,4}\S+:\s/, ''));
    for (const st of list(it.steps)) item(st, where);
  };
  for (const v of ch.vocab ?? []) for (const k of ['sv', 'def', 'pl', 'plDef', 'ex']) if (v[k]) add(`H${ch.chapter} woordenlijst`, v[k], { vocab: true });
  for (const s of ch.sections ?? []) for (const ex of s.exercises ?? []) {
    if (ex.text) add(`H${ch.chapter} ${ex.id}`, ex.text);
    for (const it of ex.items ?? []) item(it, `H${ch.chapter} ${ex.id}${it.id ? ` ${it.id}` : ''}`);
  }
  return out;
}

/** Is hunspell met het Zweedse woordenboek beschikbaar? */
export function hasHunspell() {
  const r = spawnSync('hunspell', ['-d', 'sv_SE', '-l', '-i', 'utf-8'], { input: 'hej\n', encoding: 'utf8' });
  return r.status === 0;
}

/** De woorden die hunspell niet kent (één aanroep voor de hele lijst). */
export function misspelled(words) {
  const uniq = [...new Set(words)];
  if (!uniq.length) return new Set();
  const r = spawnSync('hunspell', ['-d', 'sv_SE', '-l', '-i', 'utf-8'], { input: `${uniq.join('\n')}\n`, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`hunspell faalde: ${r.stderr || r.error}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

/** Lijst met goedgekeurde woorden (kleine letters); regels met # zijn commentaar. */
export function loadAllowed(file = path.join(root, 'content', 'stavning.txt')) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim().toLowerCase()).filter(Boolean));
}

/** Onbekende woorden: Map woord → vindplaatsen. Een woord met streepje telt als zijn delen (sms-kod). */
export function unknownWords(chapters, allowed = new Set(), check = misspelled) {
  const found = [];
  for (const ch of chapters) for (const [where, t] of swedishTexts(ch)) {
    for (const w of t.match(WORD) ?? []) {
      for (const p of w.split('-').filter(Boolean)) if (!/\d/.test(p) && !allowed.has(p.toLowerCase())) found.push([p, where]);
    }
  }
  const bad = check(found.map(([w]) => w));
  const out = new Map();
  for (const [w, where] of found) {
    if (!bad.has(w)) continue;
    if (!out.has(w)) out.set(w, new Set());
    out.get(w).add(where);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = path.join(root, 'content', 'stavning.txt');
  const allowed = loadAllowed(file);
  const bad = unknownWords(loadChapters(root), allowed);
  if (process.argv.includes('--write')) {
    const words = [...new Set([...allowed, ...[...bad.keys()].map((w) => w.toLowerCase())])].sort((a, b) => a.localeCompare(b, 'sv'));
    const head = '# Zweedse woorden die het woordenboek (hunspell sv_SE) niet kent, maar die gecontroleerd en goed zijn.\n'
      + '# Eén per regel, kleine letters. Zie scripts/spelling.mjs; npm test faalt bij een onbekend woord dat hier niet staat.\n';
    fs.writeFileSync(file, `${head}${words.join('\n')}\n`);
    console.log(`${words.length} woorden in ${path.relative(root, file)}.`);
  } else {
    for (const [w, where] of [...bad].sort((a, b) => a[0].localeCompare(b[0], 'sv'))) console.log(`${w}\t${[...where].slice(0, 3).join('; ')}`);
    console.log(`${bad.size} onbekende woorden.`);
  }
}
