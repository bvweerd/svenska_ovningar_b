// Gegevens voor de pagina Verantwoording (#/verantwoording): dezelfde metingen als het rapport inhoud en
// didactiek in CI (scripts/content-report.mjs), maar als kleine JSON voor de site. Wordt bij elke build
// opnieuw berekend via de virtuele module `virtual:verantwoording` (zie vite.config.js).
//
// De B-site telt de A-site mee als bekende stof (zusterrepo naast deze repo, of SIBLING_DIR). Ontbreekt die,
// dan staat `beforeMissing` aan en meldt de pagina dat de dekking van teksten lager uitvalt.
import fs from 'node:fs';
import path from 'node:path';

import { loadChapters, analyse, attention, TH } from './content-report.mjs';
import { LINE } from './difficulty-report.mjs';
import { root, name, sibling } from './sibling.mjs';

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const plain = (md) => md.replace(/`([^`]*)`/g, '$1').replace(/\*\*/g, '');

/** Samenvatting van het rapport, zonder Zweedse woordenlijsten: alleen getallen per hoofdstuk. */
export function verantwoording(chapters, before = [], { beforeMissing = false } = {}) {
  const { rows } = analyse(chapters, before);
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
  return {
    beforeChapters: before.length,
    beforeMissing,
    line: LINE,
    th: TH,
    totals: {
      chapters: rows.length,
      questions: sum((r) => r.qs),
      vocab: sum((r) => r.vocab),
      cards: sum((r) => r.cards.length),
      texts: sum((r) => r.coverage.length),
      canDo: sum((r) => r.canDo.length),
      strands: {
        input: sum((r) => r.strands.input),
        output: sum((r) => r.strands.output),
        vorm: sum((r) => r.strands.vorm),
      },
    },
    chapters: rows.map((r) => ({
      ch: r.chapter,
      level: r.line?.level ?? null,
      questions: r.m.questions,
      answer: round(r.m.answer),
      text: r.m.text,
      produceShare: round(r.m.produce, 3),
      strands: r.strands,
      qs: r.qs,
      translate: r.translate,
      produce: r.produce,
      feedback: r.feedback,
      vocab: r.vocab,
      recur: r.recur,
      used: r.vocab - r.onlyList.length,
      texts: r.coverage.map((c) => ({ easy: c.easy, words: c.words, known: round(c.known, 3) })),
      cards: r.cards.map((c) => ({ title: c.title ?? c.id, here: c.here, after: c.after })),
      canDo: r.canDo,
      forward: r.forward,
    })),
    attention: attention(rows).map((f) => ({ chapter: f.chapter, text: plain(f.text) })),
  };
}

/** Vite-plugin: `import data from 'virtual:verantwoording'`. */
export function verantwoordingPlugin() {
  const id = 'virtual:verantwoording';
  const resolved = `\0${id}`;
  return {
    name: 'verantwoording',
    resolveId: (x) => (x === id ? resolved : null),
    load(x) {
      if (x !== resolved) return null;
      const dir = path.join(root, 'content', 'chapters');
      for (const f of fs.readdirSync(dir)) this.addWatchFile(path.join(dir, f));
      const isB = name.endsWith('_b');
      const before = isB ? loadChapters(sibling) : [];
      const data = verantwoording(loadChapters(root), before, { beforeMissing: isB && !before.length });
      return `export default ${JSON.stringify(data)};`;
    },
  };
}
