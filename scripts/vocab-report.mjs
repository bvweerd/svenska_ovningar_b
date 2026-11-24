// Overzicht van de woordenlijsten: aantallen per hoofdstuk, hoeveel woorden een meervoud of
// voorbeeldzin hebben, dubbele woorden, en woorden die ook in de zusterrepo staan. Met hunspell ook het aantal
// verschillende woorden (basisvormen) in alle Zweedse stof, cumulatief: de maat voor de omvang van de woordenschat.
// Gebruik: npm run vocab-report
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import { root, name, siblingName, sibling } from './sibling.mjs';
import { hasHunspell, lemmaCounts, lemmaChapters } from './spelling.mjs';

function chapters(repo) {
  const dir = path.join(repo, 'content', 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const own = chapters(root).sort((a, b) => a.chapter - b.chapter);
const isNoun = (v) => /^(en|ett) /.test(v.sv);
const lemmas = hasHunspell() ? lemmaCounts(own) : null;
console.log(`hfst  woorden  zelfst.nw  met pl  met ex${lemmas ? '  in stof (nieuw/tot nu)' : ''}`);
let total = 0;
for (const [i, ch] of own.entries()) {
  const vocab = ch.vocab ?? [];
  total += vocab.length;
  const nouns = vocab.filter(isNoun);
  console.log(
    String(ch.chapter).padStart(4),
    String(vocab.length).padStart(8),
    String(nouns.length).padStart(10),
    `${nouns.filter((v) => v.pl).length}/${nouns.length}`.padStart(8),
    `${vocab.filter((v) => v.ex).length}/${vocab.length}`.padStart(7),
    ...(lemmas ? [`${lemmas[i].nieuw}/${lemmas[i].totaal}`.padStart(11)] : []),
  );
}

const where = new Map();
for (const ch of own) for (const v of ch.vocab ?? []) {
  const k = v.sv.toLowerCase();
  where.set(k, [...(where.get(k) ?? []), ch.chapter]);
}
const dupes = [...where].filter(([, chs]) => chs.length > 1);
console.log(`\nTotaal ${total} woorden, ${where.size} uniek.`);
if (lemmas) console.log(`In de stof ${lemmas.at(-1).totaal} verschillende woorden (basisvormen volgens hunspell, zonder namen).`);
else console.log('Zonder hunspell geen telling van de woorden in de stof.');

// Vergelijking met de Kelly-lijst (frequentiebanden met een ERK-label; scripts/data/kelly-sv.tsv, CC BY 4.0).
const kellyFile = path.join(root, 'scripts', 'data', 'kelly-sv.tsv');
if (lemmas && fs.existsSync(kellyFile)) {
  const inStof = new Set(lemmaChapters(own).keys());
  const kelly = fs.readFileSync(kellyFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).slice(1)
    .map((l) => l.split('\t')).filter(([, , , w, pos]) => w && pos !== 'proper name' && !/\s/.test(w.replace(/\s*\(.*\)/, '')));
  const bands = ['A1', 'A2', 'B1', 'B2'].map((band) => {
    const ws = kelly.filter(([, c]) => c === band).map(([, , , w]) => w.replace(/\s*\(.*\)/, '').toLowerCase());
    return `${band} ${ws.filter((w) => inStof.has(w)).length}/${ws.length}`;
  });
  console.log(`Kelly-lijst (frequentiebanden, losse woorden zonder namen) in de stof: ${bands.join(', ')}.`);
}
if (dupes.length) console.log(`In meer hoofdstukken (${dupes.length}): ${dupes.map(([w, chs]) => `${w} (${chs.join(', ')})`).join('; ')}`);

const other = chapters(sibling);
if (other.length) {
  const theirs = new Set(other.flatMap((ch) => (ch.vocab ?? []).map((v) => v.sv.toLowerCase())));
  const shared = [...where.keys()].filter((w) => theirs.has(w));
  console.log(`Ook in ${siblingName} (${shared.length}): ${shared.join(', ') || '–'}`);
}
