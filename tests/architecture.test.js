// Bewaakt de laagregels uit ARCHITECTURE.md (in svenska_ovningar).
//
//   core < platform < app < ui < main.js      (config.js mag overal)
//
// Een module importeert alleen uit dezelfde of een lagere laag. core/ draait ook in Node: geen
// window, document, localStorage, navigator of fetch. localStorage alleen in platform/storage.js.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'src');
const RANK = { core: 0, platform: 1, app: 2, ui: 3, main: 4 };

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : e.name.endsWith('.js') ? [full] : [];
  });
}

const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
const all = files(SRC).map(rel).sort();

/** Laag van een bestand: de eerste map (core/, platform/, app/, ui/), of main.js / config.js. */
function layer(f) {
  if (f === 'main.js') return 'main';
  if (f === 'config.js') return 'config';
  const top = f.split('/')[0];
  return top in RANK ? top : null;
}

function imports(f) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  return [...src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"`;]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
    .map((m) => m[1] ?? m[2])
    .map((p) => path.posix.normalize(path.posix.join(path.posix.dirname(f), p)))
    .filter((p) => p.endsWith('.js') && !p.startsWith('..'));
}

// Bekende uitzonderingen tijdens de overgang. Deze lijsten mogen alleen korter worden: de tests
// vergelijken exact, dus een opgeloste uitzondering moet hier ook weg.
const KNOWN = {
  unplaced: [],
  layers: [],
  browserInCore: [],
  storage: [],
  big: ['app/progress.js'],
};

const graph = Object.fromEntries(all.map((f) => [f, imports(f)]));

describe('architectuur', () => {
  it('elk bestand in src/ hoort bij een laag', () => {
    expect(all.filter((f) => !layer(f))).toEqual(KNOWN.unplaced);
  });

  it('imports gaan alleen naar dezelfde of een lagere laag', () => {
    const bad = [];
    for (const [f, deps] of Object.entries(graph)) {
      for (const d of deps) {
        const a = layer(f);
        const b = layer(d);
        if (b === 'config' || !a || !b) continue;
        if (a === 'config' || RANK[b] > RANK[a]) bad.push(`${f} -> ${d}`);
      }
    }
    expect(bad.sort()).toEqual(KNOWN.layers);
  });

  it('geen importcycli', () => {
    const cycles = [];
    const done = new Set();
    const stack = [];
    const visit = (n) => {
      const i = stack.indexOf(n);
      if (i >= 0) return cycles.push([...stack.slice(i), n].join(' > '));
      if (done.has(n)) return;
      stack.push(n);
      for (const m of graph[n] ?? []) visit(m);
      stack.pop();
      done.add(n);
    };
    all.forEach(visit);
    expect(cycles).toEqual([]);
  });

  it('core/ gebruikt geen browser', () => {
    const bad = all.filter((f) => layer(f) === 'core').filter((f) => {
      const src = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return /\b(window|document|localStorage|sessionStorage|navigator|fetch|location)\b\s*[.(]/.test(src);
    });
    expect(bad).toEqual(KNOWN.browserInCore);
  });

  it('localStorage alleen in platform/storage.js', () => {
    const bad = all.filter((f) => f !== 'platform/storage.js')
      .filter((f) => /\blocalStorage\b/.test(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\/\/.*$/gm, '')));
    expect(bad).toEqual(KNOWN.storage);
  });

  it('geen bestand boven 400 regels', () => {
    const big = all.map((f) => [f, fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').length])
      .filter(([, n]) => n > 400).map(([f]) => f);
    expect(big).toEqual(KNOWN.big);
  });
});
