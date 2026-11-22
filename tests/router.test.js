import { describe, it, expect } from 'vitest';
import { compile, matchRoute, parseHash } from '../src/ui/router.js';

const routes = ['/', '/k/:ch', '/k/:ch/o/:ex', '/oefenen/spel/:id'].map((path) => ({ path, re: compile(path) }));

describe('router', () => {
  it('leest pad en query uit de hash', () => {
    const { path, query } = parseHash('#/k/13/o/lasa?opnieuw');
    expect(path).toBe('/k/13/o/lasa');
    expect(query.has('opnieuw')).toBe(true);
    expect(parseHash('').path).toBe('/');
  });

  it('vindt de route met parameters', () => {
    expect(matchRoute(routes, '/')?.route.path).toBe('/');
    expect(matchRoute(routes, '/k/13')?.params).toEqual({ ch: '13' });
    expect(matchRoute(routes, '/k/13/o/lasa-annons')?.params).toEqual({ ch: '13', ex: 'lasa-annons' });
    expect(matchRoute(routes, '/k/13/')?.params).toEqual({ ch: '13' });
    expect(matchRoute(routes, '/k/13/x')).toBe(null);
    expect(matchRoute(routes, '/onbekend')).toBe(null);
  });
});
