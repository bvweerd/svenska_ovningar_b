// Welke vragen en oefeningen gaan vaak fout? Leest de anonieme events uit GoatCounter
// (zie README, „Statistieken”) en zet per vraag goed, fout en bekeken naast elkaar.
//
// Gebruik: GOATCOUNTER_TOKEN=<token met leesrechten> npm run stats [-- --min 5 --top 30 --start 2026-11-01]
//   --min    alleen vragen met minstens zoveel pogingen (standaard 5)
//   --top    zoveel regels per lijst (standaard 30)
//   --start  alleen events vanaf deze datum (standaard: alles)
// Een token maak je in GoatCounter onder Settings → API (rechten: statistieken lezen).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { GOATCOUNTER_CODE, PATH_PREFIX } from '../src/config.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const MIN = Number(opt('min', 5));
const TOP = Number(opt('top', 30));
const START = opt('start', null);

const token = process.env.GOATCOUNTER_TOKEN;
if (!token) {
  console.error('Zet GOATCOUNTER_TOKEN (GoatCounter → Settings → API, rechten: statistieken lezen).');
  process.exit(1);
}
const BASE = `https://${GOATCOUNTER_CODE}.goatcounter.com/api/v0`;

async function get(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`GoatCounter: ${res.status} ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error('GoatCounter antwoordt niet');
}

/** Alle paden met hun aantallen (de API geeft ze per 100; exclude_paths slaat de vorige over). */
async function allHits() {
  const hits = [];
  for (;;) {
    const params = new URLSearchParams({ limit: '100' });
    if (START) params.set('start', `${START}T00:00:00Z`);
    if (hits.length) params.set('exclude_paths', hits.map((h) => h.path_id).join(','));
    const data = await get(`${BASE}/stats/hits?${params}`);
    hits.push(...(data.hits ?? []));
    if (!data.more || !data.hits?.length) return hits;
  }
}

// Vragen uit de inhoud, zodat het rapport de tekst laat zien en niet alleen een id.
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'content', 'chapters');
const questions = new Map();
const describe = (it) => it.prompt ?? it.text ?? it.statement ?? it.sentence ?? it.say ?? it.steps?.[0]?.prompt ?? it.steps?.[0]?.text ?? it.options?.join(', ') ?? '';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
  const ch = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const s of ch.sections ?? []) for (const ex of s.exercises ?? []) for (const it of ex.items ?? []) {
    if (it.id) questions.set(`${ch.chapter}/${ex.id}/${it.id}`, String(describe(it)).replace(/\s+/g, ' ').slice(0, 70));
  }
}

const prefix = PATH_PREFIX.replace(/^\//, '');
const own = (p) => {
  const q = p.replace(/^\//, '');
  if (prefix) return q.startsWith(`${prefix}/`) ? q.slice(prefix.length + 1) : null;
  return /^(vraag|oefening|werkwoord|toets|spel|luisteren|melding)\//.test(q) ? q : null;
};

const hits = (await allHits()).filter((h) => h.event).map((h) => ({ path: own(h.path), count: h.count })).filter((h) => h.path);

const perQ = new Map();
const perEx = new Map();
const add = (map, key, field, n) => {
  const row = map.get(key) ?? { goed: 0, fout: 0, bekeken: 0 };
  row[field] += n;
  map.set(key, row);
};
for (const { path: p, count } of hits) {
  let m = p.match(/^vraag\/(\d+)\/([^/]+)\/(.+)\/(goed|fout|bekeken)$/);
  if (m) {
    add(perQ, `${m[1]}/${m[2]}/${m[3]}`, m[4], count);
    add(perEx, `${m[1]}/${m[2]}`, m[4], count);
    continue;
  }
  m = p.match(/^werkwoord\/([^/]+)\/(.+)\/(goed|fout|bekeken)$/);
  if (m) add(perQ, `werkwoord/${m[2]} (${m[1]})`, m[3], count);
}

const total = (r) => r.goed + r.fout + r.bekeken;
const hard = (r) => (r.fout + r.bekeken) / total(r);
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
const table = (title, map, label) => {
  const rows = [...map].filter(([, r]) => total(r) >= MIN).sort((a, b) => hard(b[1]) - hard(a[1]) || total(b[1]) - total(a[1])).slice(0, TOP);
  console.log(`\n${title} (minstens ${MIN} pogingen; moeilijk = fout of antwoord bekeken)`);
  if (!rows.length) return console.log('  (nog te weinig gegevens)');
  for (const [key, r] of rows) console.log(`  ${pct(hard(r))}  ${String(total(r)).padStart(4)}×  ${key}${label(key) ? `  „${label(key)}”` : ''}`);
};

const sum = (map) => [...map.values()].reduce((s, r) => s + total(r), 0);
console.log(`GoatCounter ${GOATCOUNTER_CODE}${prefix ? ` (pad ${prefix}/)` : ''}${START ? ` vanaf ${START}` : ''}: ${sum(perQ)} antwoorden op ${perQ.size} vragen.`);
table('Moeilijkste oefeningen', perEx, () => '');
table('Moeilijkste vragen', perQ, (k) => questions.get(k));

const voice = hits.filter((h) => h.path.startsWith('luisteren/status/'));
if (voice.length) {
  console.log('\nVoorlezen (status per apparaat):');
  for (const h of voice.sort((a, b) => b.count - a.count)) console.log(`  ${String(h.count).padStart(4)}×  ${h.path.slice('luisteren/status/'.length)}`);
}
