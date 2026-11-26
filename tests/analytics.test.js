// @vitest-environment happy-dom
// Anonieme telling van nieuwe browsers: één keer per browser, en nooit bij wie meten uitzette.
import { describe, it, expect, beforeEach } from 'vitest';
import './helpers/external-scripts.js';
import { trackFirstVisit, setOptOut } from '../src/platform/analytics.js';

const NOW = new Date('2026-11-26T12:00:00Z');

beforeEach(() => localStorage.clear());

describe('trackFirstVisit', () => {
  it('telt een nieuwe browser één keer, met de maand', () => {
    expect(trackFirstVisit(false, NOW)).toBe('nieuw/2026-11');
    expect(trackFirstVisit(false, NOW)).toBeNull();
  });

  it('telt een browser die de site al gebruikte apart', () => {
    expect(trackFirstVisit(true, NOW)).toBe('nieuw/al-bezig');
  });

  it('telt niet bij wie meten uitzette, en later aanzetten telt dan als bestaande browser', () => {
    localStorage.setItem('svensk-ovningar:analytics-opt-out', '1');
    expect(trackFirstVisit(false, NOW)).toBeNull();
    setOptOut(false);
    expect(trackFirstVisit(true, NOW)).toBe('nieuw/al-bezig');
  });
});
