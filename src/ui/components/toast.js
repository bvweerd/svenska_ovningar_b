// Korte melding onderin het scherm (bijvoorbeeld een nieuwe prestatie). Verdwijnt vanzelf.
import { h } from '../dom.js';

let box = null;

/** @param content  tekst of elementen; opts.ms hoe lang zichtbaar (standaard 7 s) */
export function toast(content, { ms = 7000 } = {}) {
  if (!box) {
    box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const close = () => item.remove();
  const item = h('div', { class: 'toast' }, h('div', { class: 'toast-body' }, content),
    h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Sluiten', onclick: close }, '×'));
  box.append(item);
  setTimeout(close, ms);
  return item;
}
