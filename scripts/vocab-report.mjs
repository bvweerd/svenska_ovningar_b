// Overzicht van de woordenlijsten: aantallen per hoofdstuk, hoeveel woorden een meervoud of
// voorbeeldzin hebben, dubbele woorden, en woorden die ook in de zusterrepo staan.
// Gebruik: npm run vocab-report
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import { root, name, siblingName, sibling } from './sibling.mjs';

function chapters(repo) {
  const dir = path.join(repo, 'content', 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const own = chapters(root);
const isNoun = (v) => /^(en|ett) /.test(v.sv);
console.log('hfst  woorden  zelfst.nw  met pl  met ex');
let total = 0;
for (const ch of own) {
  const vocab = ch.vocab ?? [];
  total += vocab.length;
  const nouns = vocab.filter(isNoun);
  console.log(
    String(ch.chapter).padStart(4),
    String(vocab.length).padStart(8),
    String(nouns.length).padStart(10),
    `${nouns.filter((v) => v.pl).length}/${nouns.length}`.padStart(8),
    `${vocab.filter((v) => v.ex).length}/${vocab.length}`.padStart(7),
  );
}

const where = new Map();
for (const ch of own) for (const v of ch.vocab ?? []) {
  const k = v.sv.toLowerCase();
  where.set(k, [...(where.get(k) ?? []), ch.chapter]);
}
const dupes = [...where].filter(([, chs]) => chs.length > 1);
console.log(`\nTotaal ${total} woorden, ${where.size} uniek.`);
if (dupes.length) console.log(`In meer hoofdstukken (${dupes.length}): ${dupes.map(([w, chs]) => `${w} (${chs.join(', ')})`).join('; ')}`);

const other = chapters(sibling);
if (other.length) {
  const theirs = new Set(other.flatMap((ch) => (ch.vocab ?? []).map((v) => v.sv.toLowerCase())));
  const shared = [...where.keys()].filter((w) => theirs.has(w));
  console.log(`Ook in ${siblingName} (${shared.length}): ${shared.join(', ') || '–'}`);
}
