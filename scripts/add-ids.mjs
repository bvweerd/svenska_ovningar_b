// Geeft elke vraag in content/chapters/*.yaml zonder id een korte, vaste id.
// Gebruik: npm run ids   (veilig om vaker te draaien: bestaande ids blijven staan)
//
// De voortgang van gebruikers hangt aan hoofdstuk + oefening + id. Verander een id dus nooit.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import yaml from 'js-yaml';

const dir = path.resolve(import.meta.dirname, '..', 'content', 'chapters');
const ITEMS = /^ {8}items:\s*$/; // de lijst met vragen van een oefening
const ITEM = /^ {10}- /; // één vraag in die lijst

function newId(used) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    const chars = [];
    while (chars.length < 4) {
      for (const b of randomBytes(4)) {
        if (b >= limit) continue; // rejection sampling om modulo-bias te vermijden
        chars.push(alphabet[b % alphabet.length]);
        if (chars.length === 4) break;
      }
    }
    const id = chars.join('');
    if (!used.has(id) && !/^\d+$/.test(id)) {
      used.add(id);
      return id;
    }
  }
}

let added = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
  const full = path.join(dir, file);
  const raw = fs.readFileSync(full, 'utf8');
  // Windows-checkouts (core.autocrlf) hebben CRLF: los splitsen en hetzelfde regeleinde terugschrijven,
  // anders matchen de regexen hieronder met $ niet en krijgt elke vraag een tweede id.
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const used = new Set([...raw.matchAll(/\bid: ([a-z0-9]{4})\b/g)].map((m) => m[1]));
  const before = added;
  let inItems = false;
  const out = [];
  for (const line of lines) {
    if (ITEMS.test(line)) inItems = true;
    else if (line.trim() && !line.startsWith(' '.repeat(9))) inItems = false;
    if (inItems && ITEM.test(line)) {
      const flow = line.match(/^( {10}- )\{ (.*)$/);
      if (flow && !/^id: /.test(flow[2])) {
        out.push(`${flow[1]}{ id: ${newId(used)}, ${flow[2]}`);
        added++;
        continue;
      }
      if (!flow && !/^ {10}- id: /.test(line)) {
        out.push(`          - id: ${newId(used)}`, `            ${line.slice(12)}`);
        added++;
        continue;
      }
    }
    out.push(line);
  }
  const text = out.join(eol);
  // Controle: elke vraag van elke oefening heeft nu een id.
  const data = yaml.load(text);
  for (const s of data.sections ?? []) for (const ex of s.exercises ?? []) for (const it of ex.items ?? []) {
    if (!it.id) throw new Error(`${file} / ${ex.id}: vraag zonder id (onverwachte opmaak?)`);
  }
  if (added > before) fs.writeFileSync(full, text); // niets veranderd: bestand niet herschrijven
}
console.log(`${added} id's toegevoegd.`);
