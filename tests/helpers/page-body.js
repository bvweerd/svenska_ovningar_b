// De <body> van index.html voor UI-tests, zonder <script>-elementen (de tests laden main.js zelf).
// Via de DOM-parser van happy-dom, niet met een reguliere expressie: die mist varianten als
// `</script >` (CodeQL: incomplete sanitization).
import fs from 'node:fs';
import path from 'node:path';

export function pageBody() {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const s of doc.querySelectorAll('script')) s.remove();
  return doc.body.innerHTML;
}
