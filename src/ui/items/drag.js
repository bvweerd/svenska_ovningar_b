// Slepen van woordtegels (aanvulling op tikken; tikken blijft gewoon werken).
// Muis en pen: slepen begint zodra je beweegt. Touch: eerst even vasthouden (HOLD_MS), zodat een
// veeg over de tegels de pagina nog steeds scrolt.
import { h } from '../dom.js';

const HOLD_MS = 220;
const MOVE_PX = 6;

/**
 * Maakt een element sleepbaar.
 * @param el       de tegel
 * @param opts.onMove(point)  tijdens het slepen (bijvoorbeeld om de invoegplek te tonen)
 * @param opts.onDrop(point)  bij loslaten; point = { x, y } in viewport-coördinaten
 * @param opts.onEnd()        na afloop (ook bij afbreken)
 * @param opts.disabled()     true: niet slepen
 */
export function draggable(el, { onMove = () => {}, onDrop, onEnd = () => {}, disabled = () => false }) {
  el.addEventListener('pointerdown', (down) => {
    if (disabled() || down.button !== 0) return;
    const touch = down.pointerType === 'touch';
    const start = { x: down.clientX, y: down.clientY };
    let ghost = null;
    let holdTimer = null;
    let armed = !touch; // touch: pas na vasthouden

    const begin = () => {
      const r = el.getBoundingClientRect();
      ghost = h('span', { class: 'chip drag-ghost', 'aria-hidden': 'true' }, el.textContent);
      ghost.style.left = `${r.left}px`;
      ghost.style.top = `${r.top}px`;
      document.body.append(ghost);
      el.classList.add('dragging');
    };
    const position = (e) => {
      ghost.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px)`;
      onMove({ x: e.clientX, y: e.clientY });
    };
    // Tijdens slepen op touch: niet scrollen.
    const noScroll = (e) => { if (ghost) e.preventDefault(); };
    const cleanup = () => {
      clearTimeout(holdTimer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', noScroll);
      ghost?.remove();
      el.classList.remove('dragging', 'held');
      if (ghost) {
        // De klik die op het loslaten volgt, mag de tegel niet ook nog verplaatsen.
        const block = (c) => { c.stopImmediatePropagation(); c.preventDefault(); };
        el.addEventListener('click', block, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', block, { capture: true }), 0);
        setTimeout(onEnd, 0);
      }
    };
    const move = (e) => {
      const far = Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_PX;
      if (!ghost) {
        if (!armed) {
          if (far) cleanup(); // touch: bewogen vóór het vasthouden → gewoon scrollen
          return;
        }
        if (!far) return;
        begin();
      }
      position(e);
    };
    const up = (e) => {
      if (ghost) onDrop({ x: e.clientX, y: e.clientY });
      cleanup();
    };
    const cancel = () => cleanup();
    if (touch) {
      holdTimer = setTimeout(() => {
        armed = true;
        begin();
        el.classList.add('held');
      }, HOLD_MS);
      document.addEventListener('touchmove', noScroll, { passive: false });
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}

/** Ligt het punt binnen het element (met een marge)? */
export function inside(el, { x, y }, margin = 16) {
  const r = el.getBoundingClientRect();
  return x >= r.left - margin && x <= r.right + margin && y >= r.top - margin && y <= r.bottom + margin;
}

/**
 * Op welke plek in een regel tegels komt een tegel die op dit punt wordt losgelaten?
 * chips: de tegels in de regel (in volgorde). Geeft een index van 0 tot chips.length.
 */
export function dropIndex(chips, { x, y }) {
  let n = 0;
  for (const c of chips) {
    const r = c.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const before = cy < y - r.height / 2 || (Math.abs(cy - y) <= r.height / 2 && r.left + r.width / 2 < x);
    if (before) n++;
  }
  return n;
}
