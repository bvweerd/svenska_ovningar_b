import { describe, it, expect } from 'vitest';
import { parentOf, ancestors, nextStack } from '../src/nav.js';

const go = (...hrefs) => hrefs.reduce((s, h) => nextStack(s, h), ['#/']);

describe('terugknop in de app: bovenliggende pagina', () => {
  it('kent de ouder van elke soort pagina', () => {
    expect(parentOf('#/')).toBe(null);
    expect(parentOf('#/k/13')).toBe('/');
    expect(parentOf('#/k/13/o/passiv')).toBe('/k/13');
    expect(parentOf('#/k/13/g/passiv?x=1')).toBe('/k/13');
    expect(parentOf('#/k/13/toets')).toBe('/k/13');
    expect(parentOf('#/oefenen/herhaling')).toBe('/oefenen');
    expect(parentOf('#/oefenen/spel/snel')).toBe('/oefenen/spel');
    expect(parentOf('#/over')).toBe('/');
    expect(ancestors('#/oefenen/spel/snel')).toEqual(['/', '/oefenen', '/oefenen/spel']);
  });

  it('verder waar je gebleven was: hoofdstuk komt ertussen', () => {
    expect(go('#/k/13/o/passiv')).toEqual(['#/', '#/k/13', '#/k/13/o/passiv']);
  });

  it('naar de volgende oefening: terug is het hoofdstuk', () => {
    expect(go('#/k/13', '#/k/13/o/a', '#/k/13/o/b')).toEqual(['#/', '#/k/13', '#/k/13/o/b']);
  });

  it('uitleg vanuit een oefening: terug is de oefening', () => {
    expect(go('#/k/13/o/a', '#/k/13/g/passiv')).toEqual(['#/', '#/k/13', '#/k/13/o/a', '#/k/13/g/passiv']);
    expect(go('#/grammatica', '#/k/20/g/x')).toEqual(['#/', '#/grammatica', '#/k/20/g/x']);
  });

  it('naar een ander onderdeel via het menu: alleen wat erboven hoort blijft', () => {
    expect(go('#/k/13/o/a', '#/oefenen/werkwoorden')).toEqual(['#/', '#/oefenen', '#/oefenen/werkwoorden']);
    expect(go('#/k/13/o/a', '#/k/14')).toEqual(['#/', '#/k/14']);
  });

  it('naar een pagina die al op de stapel staat: terug naar die plek', () => {
    expect(go('#/k/13/o/a', '#/k/13/g/x', '#/k/13')).toEqual(['#/', '#/k/13']);
    expect(go('#/k/13', '#/')).toEqual(['#/']);
  });

  it('opnieuw beginnen blijft niet op de stapel staan', () => {
    expect(go('#/k/13/o/a?opnieuw', '#/k/13/g/x')).toEqual(['#/', '#/k/13', '#/k/13/o/a', '#/k/13/g/x']);
    expect(go('#/oefenen/luisteren?set=a&opnieuw')).toEqual(['#/', '#/oefenen', '#/oefenen/luisteren?set=a']);
  });
});
