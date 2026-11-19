// Moeilijkheid per hoofdstuk, naast de moeilijkheidslijn uit PLAN.md (fase 1b van het verbeterplan).
// Gebruik: npm run difficulty-report
//
// Meetregels (zie ook CLAUDE.md):
// - vragen: alle items, stappen van `steps` apart, zonder de onderdelen herhaling en eindtoets en zonder
//   de gegenereerde woordenschat;
// - antwoordzin: woorden in het eerste goede antwoord van translate, transform, order en findError
//   ([..] weg, {a|b} → a), en in de zin van gap (___ telt als één woord);
// - leestekst: `text` van oefeningen zonder `listen: true`;
// - zelf maken: translate, transform, order, findError, gap en free t.o.v. alle vragen.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

import { root } from './sibling.mjs';

/** De moeilijkheidslijn: per niveau leestekst (woorden), antwoordzin (woorden) en minimum aantal vragen. */
export const LINE = [
  { level: 'A1', from: 1, to: 6, text: [70, 120], answer: [4, 6], questions: 80 },
  { level: 'A2', from: 7, to: 12, text: [120, 200], answer: [6, 9], questions: 80 },
  { level: 'B1', from: 13, to: 24, text: [200, 350], answer: [8, 12], questions: 70 },
  { level: 'B2', from: 25, to: 30, text: [350, 500], answer: [10, 15], questions: 70 },
];

const words = (s) => (String(s).match(/[\p{L}\d'-]+/gu) ?? []).length;
const firstAnswer = (a) => String([].concat(a)[0] ?? '').replace(/\[[^\]]*\]/g, '').replace(/\{([^|}]*)[^}]*\}/g, '$1');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const PRODUCE = new Set(['translate', 'transform', 'order', 'findError', 'gap', 'free']);

export function measure(ch) {
  const lens = [];
  let total = 0;
  let produce = 0;
  for (const s of ch.sections ?? []) {
    if (s.id === 'herhaling' || s.id === 'eindtoets') continue;
    for (const ex of s.exercises) for (const it of ex.items) {
      for (const x of it.type === 'steps' ? it.steps : [it]) {
        total++;
        if (PRODUCE.has(x.type)) produce++;
        if (['translate', 'transform', 'order', 'findError'].includes(x.type) && x.answers) lens.push(words(firstAnswer(x.answers)));
        else if (x.type === 'gap' && x.text) lens.push(words(x.text.replace(/___/g, 'x')));
      }
    }
  }
  const texts = (ch.sections ?? []).flatMap((s) => s.exercises).filter((ex) => ex.text && !ex.listen).map((ex) => ex.text);
  return {
    chapter: ch.chapter,
    questions: total,
    answer: mean(lens),
    produce: total ? produce / total : 0,
    text: texts.reduce((n, t) => n + words(t), 0),
  };
}

const lineFor = (n) => LINE.find((l) => n >= l.from && n <= l.to);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = path.join(root, 'content', 'chapters');
  const chapters = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')));
  console.log('hfst  niveau  vragen  antwoordzin  zelf maken  leestekst   (! = onder de lijn)');
  let below = 0;
  for (const ch of chapters) {
    const m = measure(ch);
    const l = lineFor(ch.chapter);
    const flag = (bad) => (bad ? '!' : ' ');
    const q = l && m.questions < l.questions;
    const a = l && m.answer < l.answer[0];
    const t = l && m.text < l.text[0];
    if (q || a || t) below++;
    console.log(
      String(ch.chapter).padStart(4),
      (l?.level ?? '-').padStart(7),
      `${String(m.questions).padStart(6)}${flag(q)}`,
      `${m.answer.toFixed(1).padStart(10)}${flag(a)}`,
      `${Math.round(m.produce * 100)}%`.padStart(11),
      `${String(m.text).padStart(9)}${flag(t)}`,
    );
  }
  console.log(`\nDoellijn: ${LINE.map((l) => `${l.level} (H${l.from}–${l.to}) tekst ${l.text.join('–')}, antwoordzin ${l.answer.join('–')}, ≥ ${l.questions} vragen`).join('; ')}.`);
  console.log(`${below} hoofdstuk(ken) zitten op minstens één punt onder de lijn.`);
}
