// Controleert of de code van deze repo gelijk is aan die van de zusterrepo
// (svenska_ovningar ⇄ svenska_ovningar_b), die ernaast moet staan.
// Gebruik: npm run check-sync   (geeft exitcode 1 bij verschillen)
//
// Gelijk moeten zijn: src/ (behalve src/config.js), tests/, scripts/, vite.config.js en package.json.
// De inhoud (content/), index.html, de app-iconen (public/icons/), de Worker en src/config.js verschillen per site.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const name = path.basename(root);
const siblingName = name.endsWith('_b') ? name.slice(0, -2) : `${name}_b`;
const sibling = path.resolve(root, '..', siblingName);

if (!fs.existsSync(sibling)) {
  console.log(`Zusterrepo ${siblingName} niet gevonden naast ${name}; niets te vergelijken.`);
  process.exit(0);
}

const SHARED_DIRS = ['src', 'tests', 'scripts'];
const SHARED_FILES = ['vite.config.js', 'package.json'];
const PER_SITE = new Set(['src/config.js']);

function files(base, dir) {
  const full = path.join(base, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(base, rel) : [rel];
  });
}

const read = (base, rel) => {
  const p = path.join(base, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
};

const all = new Set([
  ...SHARED_DIRS.flatMap((d) => [...files(root, d), ...files(sibling, d)]),
  ...SHARED_FILES,
]);
const problems = [];
for (const rel of [...all].sort()) {
  if (PER_SITE.has(rel)) continue;
  const a = read(root, rel);
  const b = read(sibling, rel);
  if (a === null) problems.push(`ontbreekt hier:      ${rel}`);
  else if (b === null) problems.push(`ontbreekt in ${siblingName}: ${rel}`);
  else if (a !== b) problems.push(`verschilt:           ${rel}`);
}

if (problems.length) {
  console.error(`${name} en ${siblingName} lopen niet gelijk:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`${name} en ${siblingName} lopen gelijk.`);
