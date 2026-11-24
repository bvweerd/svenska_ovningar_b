// De app laadt twee externe scripts (GoatCounter, Turnstile). In happy-dom kan dat niet en het geeft een
// lange foutmelding in de log. Deze helper onderschept ze: ze worden onthouden, niet in de pagina gezet.
export const externalScripts = [];

const append = HTMLHeadElement.prototype.append;
HTMLHeadElement.prototype.append = function appendWithoutExternal(...nodes) {
  const external = nodes.filter((n) => n?.tagName === 'SCRIPT' && /^https?:/.test(n.src));
  externalScripts.push(...external);
  return append.apply(this, nodes.filter((n) => !external.includes(n)));
};
