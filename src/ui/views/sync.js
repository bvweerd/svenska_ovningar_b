// Synchroniseren tussen apparaten: het blok op de pagina Voortgang en de koppellink.
import { h, fill } from '../dom.js';
import { syncConfigured, syncNow, getCode, setCode, forgetCode, newCode, normalizeCode, formatCode, linkFor, lastSync } from '../../platform/sync.js';
import { navigate } from '../nav.js';

const when = (t) => (t ? new Date(t).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : 'nog niet');

export function syncSection() {
  const box = h('div', { class: 'sync' });
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  let draw;
  const run = async (msg) => {
    status.textContent = 'Bezig met synchroniseren…';
    try {
      const r = await syncNow();
      status.textContent = msg ?? (r?.changed ? 'Gesynchroniseerd: voortgang van je andere apparaten is toegevoegd.' : 'Gesynchroniseerd.');
    } catch (e) {
      status.textContent = `Synchroniseren lukt nu niet (${e.message}). Het wordt later vanzelf opnieuw geprobeerd.`;
    }
    draw();
  };
  draw = () => {
    const code = getCode();
    let parts;
    if (code) {
      const link = linkFor(code);
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(link);
          status.textContent = 'Koppellink gekopieerd. Open hem op je andere apparaat.';
        } catch {
          status.textContent = `Kopiëren lukt niet. De link is: ${link}`;
        }
      };
      parts = [
        h('p', {}, 'Dit apparaat is gekoppeld met code ', h('strong', { class: 'sync-code' }, formatCode(code)), `. Laatst gesynchroniseerd: ${when(lastSync())}.`),
        h('p', {}, 'Op een ander apparaat: open de koppellink, of vul daar op deze pagina de code in. De code geldt voor de A1–A2- en de B1–B2-site samen. Houd hem voor jezelf: wie de code heeft, kan je voortgang zien en aanvullen.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => run() }, 'Nu synchroniseren'),
          h('button', { type: 'button', class: 'btn ghost', onclick: copy }, 'Kopieer koppellink'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => {
            if (!confirm('Dit apparaat ontkoppelen? De voortgang hier blijft staan, maar wordt niet meer gesynchroniseerd.')) return;
            forgetCode();
            status.textContent = 'Ontkoppeld.';
            draw();
          } }, 'Ontkoppelen'),
        ),
      ];
    } else {
      const input = h('input', { type: 'text', class: 'answer-input', placeholder: 'xxxx-xxxx-xxxx-xxxx', 'aria-label': 'Synccode', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const join = () => {
        const c = normalizeCode(input.value);
        if (!c) {
          status.textContent = 'Dit is geen geldige code: 16 letters en cijfers.';
          return;
        }
        setCode(c);
        run('Gekoppeld en gesynchroniseerd.');
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
      parts = [
        h('p', {}, 'Oefen je op meer apparaten, bijvoorbeeld je telefoon en je laptop? Zet synchroniseren aan. Je krijgt een code waarmee je je andere apparaten koppelt; een account is niet nodig. Je voortgang wordt dan, onder die code, bewaard bij Cloudflare. Je naam of e-mailadres gaat niet mee.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => { setCode(newCode()); run('Synchroniseren staat aan. Koppel nu je andere apparaten met de code of de link.'); } }, 'Synchroniseren aanzetten'),
        ),
        h('p', {}, 'Heb je al een code van een ander apparaat?'),
        h('div', { class: 'actions' }, input, h('button', { type: 'button', class: 'btn ghost', onclick: join }, 'Koppelen')),
      ];
    }
    fill(box, ...parts, status);
  };
  draw();
  return [h('h3', {}, 'Synchroniseren tussen apparaten'), box];
}

/** #/koppel/<code>: geopend via een koppellink van een ander apparaat. */
export function viewLink(raw) {
  const code = normalizeCode(decodeURIComponent(raw ?? ''));
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  if (!syncConfigured() || !code) {
    return h('div', { class: 'prose' }, h('h1', {}, 'Koppellink'), h('p', {}, 'Deze link werkt niet (meer). Kijk op de pagina ', h('a', { href: '#/voortgang' }, 'Voortgang'), '.'));
  }
  const current = getCode();
  const go = async () => {
    setCode(code);
    status.textContent = 'Bezig met synchroniseren…';
    try {
      await syncNow();
      navigate('#/');
    } catch (e) {
      status.textContent = `Gekoppeld, maar synchroniseren lukt nu niet (${e.message}). Het wordt later vanzelf opnieuw geprobeerd.`;
    }
  };
  return h('div', { class: 'prose' },
    h('h1', {}, 'Apparaat koppelen'),
    current === code
      ? h('p', {}, 'Dit apparaat is al gekoppeld met deze code. ', h('a', { href: '#/' }, 'Naar de start'))
      : [
          h('p', {}, `Wil je dit apparaat koppelen met code ${formatCode(code)}? Je voortgang hier wordt samengevoegd met die van je andere apparaten; er gaat niets verloren.`),
          current ? h('p', {}, 'Dit apparaat is nu gekoppeld met een andere code. Die koppeling vervalt.') : null,
          h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn primary', onclick: go }, 'Koppelen'),
            h('a', { class: 'btn ghost', href: '#/' }, 'Niet nu')),
        ],
    status);
}
