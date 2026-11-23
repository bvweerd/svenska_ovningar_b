// Schermtoetsenbord op een telefoon: is het open, en hoe zet je een vraag goed in beeld?
//
// Met het toetsenbord open is alleen het zichtbare deel (visualViewport) te zien. De vaste balk bovenaan
// hoort bij de hele pagina en valt dan vaak buiten beeld. Daarom rekenen we hier met wat echt zichtbaar is,
// niet met een vaste ruimte voor die balk.
import { isTouch } from '../dom.js';

/** Staat het schermtoetsenbord open? */
export function keyboardOpen() {
  const vv = window.visualViewport;
  return !!vv && isTouch() && window.innerHeight - vv.height > 120;
}

/** Hoeveel van de bovenkant van het zichtbare deel wordt bedekt door de vaste balken (kop, score)? */
function coveredTop(vv) {
  // De balken sluiten op elkaar aan (kop, daaronder de score): tel door zolang de volgende direct aansluit.
  let bottom = vv.offsetTop;
  for (const el of document.querySelectorAll('.topbar, .score')) {
    const r = el.getBoundingClientRect();
    if (r.height && r.top <= bottom + 2 && r.bottom > bottom) bottom = r.bottom;
  }
  return bottom - vv.offsetTop;
}

/**
 * Zet de vraag van dit tekstveld zo in beeld dat je hem leest terwijl je typt: de kop van de vraag bovenaan,
 * en het veld boven de letterbalk en het toetsenbord. Past dat niet, dan gaat het veld voor: net boven de
 * letterbalk, met zoveel mogelijk van de vraag erboven.
 */
export function fitField(field) {
  const vv = window.visualViewport;
  if (!vv || !field?.isConnected) return;
  const card = field.closest('.item') ?? field;
  const bar = document.querySelector('.charbar.docked');
  const below = bar?.offsetHeight ? bar.offsetHeight + 6 : 0;
  const top = vv.offsetTop + coveredTop(vv) + 8;
  const bottom = vv.offsetTop + vv.height - below - 8;
  const c = card.getBoundingClientRect();
  const f = field.getBoundingClientRect();
  let by = c.top - top;
  if (f.bottom - by > bottom) by = Math.min(f.bottom - bottom, f.top - top);
  if (Math.abs(by) > 2) window.scrollBy({ top: by, behavior: 'instant' });
}
