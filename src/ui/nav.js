// Terugknop in de geïnstalleerde app (Android): naar de bovenliggende pagina, zoals in een app,
// niet naar de vorige pagina zoals in een browser. In een gewoon browsertabblad verandert er niets.
//
// De app houdt zelf een stapel pagina's bij (bijv. start → hoofdstuk → oefening). De browsergeschiedenis
// heeft steeds hooguit twee items: de start en de huidige pagina. Terug haalt de bovenste pagina van de
// stapel en zet de pagina eronder weer als huidig item; op de start sluit terug de app.
//
// - Naar een pagina die al op de stapel staat: terug naar die plek (de rest valt eraf).
// - Anders vallen pagina's die er niet boven horen eraf, en komen ontbrekende bovenliggende pagina's erbij:
//   van een oefening naar de volgende oefening is terug dus het hoofdstuk, niet de vorige oefening.
// - Uitleg (grammatica) is naslag: die komt bovenop wat er al stond, zodat terug weer bij de oefening uitkomt.

const pathOf = (href) => String(href ?? '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '') || '/';

// Losse pagina's die bij een overzichtspagina horen.
const PARENT = { statistieken: '/voortgang', prestaties: '/voortgang', luisteren: '/instellingen' };

/** Bovenliggende pagina van een pad, of null voor de start. */
export function parentOf(href) {
  const p = pathOf(href).split('/').filter(Boolean);
  if (!p.length) return null;
  if (p[0] === 'k' && p.length > 2) return `/k/${p[1]}`;
  if (p[0] === 'oefenen' && p[1] === 'spel' && p[2]) return '/oefenen/spel';
  if (p[0] === 'oefenen' && p[1]) return '/oefenen';
  if (PARENT[p[0]]) return PARENT[p[0]];
  return '/';
}

/** Alle bovenliggende pagina's, van de start tot en met de directe ouder. */
export function ancestors(href) {
  const out = [];
  for (let p = parentOf(href); p; p = parentOf(p)) out.unshift(p);
  return out;
}

/** Href zonder eenmalige opdrachten (?opnieuw): terugkomen op een oefening begint die niet opnieuw. */
function stored(href) {
  const [p, q] = String(href).split('?');
  if (!q) return p;
  const params = new URLSearchParams(q);
  params.delete('opnieuw');
  const rest = params.toString();
  return rest ? `${p}?${rest}` : p;
}

const isLookup = (href) => /^\/(k\/\d+\/g\/|grammatica$)/.test(pathOf(href));

/** Nieuwe stapel (lijst van hrefs, onderaan '#/') na het openen van href. */
export function nextStack(stack, href) {
  const path = pathOf(href);
  const item = stored(href);
  const at = stack.findIndex((h) => pathOf(h) === path);
  if (at >= 0) return [...stack.slice(0, at), item];
  if (isLookup(href) && stack.length > 1) return [...stack, item];
  const up = ancestors(href);
  const kept = [...stack];
  while (kept.length > 1 && !up.includes(pathOf(kept[kept.length - 1]))) kept.pop();
  const missing = up.slice(up.indexOf(pathOf(kept[kept.length - 1])) + 1).map((a) => `#${a}`);
  return [...kept, ...missing, item];
}

let navigateImpl = (href) => { location.hash = href; };

/** Naar een pagina binnen de site (gebruik dit in plaats van location.hash = …). */
export const navigate = (href) => navigateImpl(href);

/**
 * Zet de app-navigatie aan (alleen in de geïnstalleerde app aanroepen).
 * Pagina's worden getekend via het gewone hashchange-event.
 */
export function initAppNav() {
  const fire = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const home = '#/';
  const first = location.hash || home;
  let stack = nextStack([home], first);
  let onTop = false; // staat er een pagina-item boven het start-item in de browsergeschiedenis?
  let goingHome = false;

  const show = (href) => {
    const top = href ?? stack[stack.length - 1];
    if (stack.length === 1) {
      if (onTop) {
        goingHome = true;
        history.back(); // popstate → start; de app sluit bij de volgende keer terug
      } else {
        history.replaceState(null, '', home);
        fire();
      }
      return;
    }
    if (onTop) history.replaceState(null, '', top);
    else history.pushState(null, '', top);
    onTop = true;
    fire();
  };

  history.replaceState(null, '', home);
  if (stack.length > 1) {
    history.pushState(null, '', first);
    onTop = true;
  }

  window.addEventListener('popstate', () => {
    onTop = false;
    if (goingHome) {
      goingHome = false;
      return; // hashchange tekent de start
    }
    stack = stack.slice(0, -1);
    if (stack.length > 1) {
      history.pushState(null, '', stack[stack.length - 1]);
      onTop = true;
    }
    // De browser stuurt hierna zelf een hashchange met de nieuwe pagina.
  });

  navigateImpl = (href) => {
    stack = nextStack(stack, href);
    show(stack.length > 1 ? href : undefined);
  };

  // Links binnen de site via de stapel, niet via de browsergeschiedenis.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a || a.target) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });
}
