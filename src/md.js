// Minimale markdown voor grammatica-kaarten: koppen, alinea's, lijsten, tabellen,
// **vet**, *cursief*, ~~doorgestreept~~ en `code`. Invoer wordt eerst ge-escaped.
import { escapeHtml } from './dom.js';

export function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function markdown(src) {
  const lines = String(src ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const head = line.match(/^(#{2,4})\s+(.*)$/);
    if (head) {
      const lvl = head[1].length + 1;
      out.push(`<h${lvl}>${inline(head[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|?\s*$/.test(r));
      const [first, ...rest] = body;
      if (first === undefined) continue; // alleen een scheidingsregel: geen tabel
      out.push(
        '<div class="table-wrap"><table><thead><tr>' +
          cells(first).map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rest.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>',
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\s*\||\s*[-*]\s+)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
