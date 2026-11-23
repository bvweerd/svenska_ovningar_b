import { describe, it, expect } from 'vitest';
import { BADGES, awardBadges, badgeOverview } from '../src/core/rewards/badges.js';
import { empty } from '../src/core/progress/schema.js';
import { mergeStates } from '../src/core/progress/merge.js';
import { badgeIconSvg, BADGE_ICON_GROUPS } from '../src/ui/components/badge-icon.js';

const course = [];

describe('prestaties', () => {
  it('vaste, unieke id\'s', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('oefening-1');
  });

  it('elke badge heeft een plaatje', () => {
    for (const b of BADGES) {
      expect(BADGE_ICON_GROUPS).toContain(b.group);
      expect(badgeIconSvg(b)).toMatch(/^<svg [^>]*viewBox="0 0 64 64".*<\/svg>$/s);
    }
  });

  it('een afgeronde oefening geeft de eerste badge, één keer', () => {
    const s = { ...empty(), ex: { '13/a': { best: 1, completedAt: 5 } } };
    const first = awardBadges(s, course, 100);
    expect(first.fresh.map((b) => b.id)).toEqual(['oefening-1']);
    expect(first.state.badges['oefening-1']).toBe(100);
    expect(awardBadges(first.state, course, 200).fresh).toEqual([]);
  });

  it('oefendagen tellen in totaal, niet op rij', () => {
    const s = { ...empty(), days: ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'] };
    expect(awardBadges(s, course).fresh.map((b) => b.id)).toEqual(['dagen-5']);
  });

  it('een behaalde badge blijft staan, ook als de voortgang daalt', () => {
    const s = { ...empty(), badges: { 'dagen-5': 1 } };
    const b = badgeOverview(s, course).find((x) => x.id === 'dagen-5');
    expect(b.earned).toBe(true);
    expect(b.at).toBe(1);
  });

  it('samenvoegen houdt badges van beide kanten, met het vroegste tijdstip', () => {
    const a = { ...empty(), badges: { 'oefening-1': 50, 'dagen-5': 10 } };
    const b = { ...empty(), badges: { 'oefening-1': 20, 'snel-15': 30 } };
    expect(mergeStates(a, b).badges).toEqual({ 'oefening-1': 20, 'dagen-5': 10, 'snel-15': 30 });
  });
});
