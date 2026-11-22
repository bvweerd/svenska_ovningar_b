// Het register van vraagtypen (core/items/) en de renderers (ui/items/) horen bij elkaar.
import { describe, it, expect } from 'vitest';
import { ITEM_TYPES, answerPart, selfChecking, isGradable, typeName } from '../src/core/items/index.js';
import { RENDERERS } from '../src/ui/items/index.js';

describe('register van vraagtypen', () => {
  it('elk type heeft een renderer en andersom', () => {
    expect(Object.keys(RENDERERS).sort()).toEqual(Object.keys(ITEM_TYPES).sort());
  });

  it('elk type heeft een naam en een controle', () => {
    for (const t of Object.values(ITEM_TYPES)) {
      expect(typeof t.name, t.type).toBe('string');
      expect(typeof t.validate, t.type).toBe('function');
    }
  });

  it('antwoorddeel zonder eigen regel: type en antwoorden', () => {
    expect(answerPart({ type: 'translate', prompt: 'x', answers: ['a'] })).toEqual(['translate', ['a']]);
    expect(answerPart({ type: 'steps', steps: [{ type: 'mc', options: ['a', 'b'], answer: 1 }, { type: 'free' }] }))
      .toEqual(['steps', [['mc', 'b'], ['free']]]);
  });

  it('zelf nakijken en nakijkbaar', () => {
    expect(selfChecking({ type: 'mc' })).toBe(true);
    expect(selfChecking({ type: 'gap', gaps: [{ answers: ['a'] }] })).toBe(false);
    expect(selfChecking({ type: 'steps', steps: [{ type: 'listen', options: ['a'] }] })).toBe(true);
    expect(isGradable({ type: 'free' })).toBe(false);
    expect(isGradable({ type: 'gap' })).toBe(true);
    expect(typeName('findError')).toBe('zoek de fout');
  });
});
