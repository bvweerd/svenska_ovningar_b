// Router: een tabel van routes (ui/routes.js) in plaats van een keten van ifs.
//
// Een route: { path: '/k/:ch/o/:ex', view, refresh? }
//   view({ params, query, signal }) → element of null (= pagina niet gevonden). De pagina zet zelf document.title.
//   signal: AbortSignal dat afbreekt zodra je de pagina verlaat. Geef het mee aan
//           addEventListener(…, { signal }) en ruim timers op met signal.addEventListener('abort', …).
//   refresh: true → de pagina wordt opnieuw getekend als er voortgang van buiten binnenkomt
//           (synchronisatie, import). Alleen voor pagina's zonder invoer die je kwijt kunt raken.
import { h } from './dom.js';

const notFound = () =>
  h('div', { class: 'prose' }, h('h1', {}, 'Pagina niet gevonden'), h('p', {}, h('a', { href: '#/' }, 'Terug naar de start')));

/** '/k/:ch' → RegExp met benoemde groepen. */
export function compile(path) {
  const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${pattern}/?$`);
}

/** Zoekt de route bij een pad; geeft { route, params } of null. */
export function matchRoute(compiled, path) {
  for (const route of compiled) {
    const m = route.re.exec(path);
    if (m) return { route, params: { ...m.groups } };
  }
  return null;
}

/** '#/k/13/o/lasa?opnieuw' → { path: '/k/13/o/lasa', query } */
export function parseHash(hash) {
  const [rawPath, rawQuery = ''] = String(hash ?? '').replace(/^#/, '').split('?');
  return { path: rawPath || '/', query: new URLSearchParams(rawQuery) };
}

/**
 * @param root    element waarin de pagina komt
 * @param routes  zie boven
 * @param after(path)  na het tekenen (menu bijwerken, teller, scrollen)
 */
export function createRouter({ root, routes, after = () => {} }) {
  const compiled = routes.map((r) => ({ ...r, re: compile(r.path) }));
  let controller = null;
  let current = null;

  function render() {
    const { path, query } = parseHash(location.hash);
    controller?.abort();
    controller = new AbortController();
    const found = matchRoute(compiled, path);
    const out = found ? found.route.view({ params: found.params, query, signal: controller.signal }) : null;
    const el = out ?? notFound();
    current = found?.route ?? null;
    // Leesoefeningen krijgen op brede schermen tekst en vragen naast elkaar.
    root.classList.toggle('wide', !!el.querySelector?.('.reading-layout'));
    root.replaceChildren(el);
    after(path);
  }

  return {
    render,
    /** Opnieuw tekenen als de huidige pagina dat wil (zie refresh). */
    refresh() {
      if (current?.refresh) render();
    },
    start() {
      window.addEventListener('hashchange', render);
      render();
    },
  };
}
