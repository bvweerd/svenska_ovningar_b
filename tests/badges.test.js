import { describe, it, expect } from 'vitest';
import { BADGES, awardBadges, badgeOverview } from '../src/core/rewards/badges.js';
import { empty } from '../src/core/progress/schema.js';
import { mergeStates } from '../src/core/progress/merge.js';
import { badgeIconSvg, BADGE_ICON_GROUPS } from '../src/ui/components/badge-icon.js';
import { recordItem } from '../src/core/progress/record.js';
import { DAILY_GOAL } from '../src/core/progress/srs.js';
import { parseProgress, answerHash } from '../src/core/progress/schema.js';

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

  // Een klein hoofdstuk met van elke soort oefening één.
  const mc = (id) => ({ id, type: 'mc', prompt: '?', options: ['a', 'b'], answer: 0 });
  const chapter = {
    chapter: 1,
    available: true,
    exercises: [
      { id: 'lees', kind: 'makkelijk', text: 'Hej.', items: [mc('l1')] },
      { id: 'zeg', kind: 'situatie', items: [mc('z1')] },
      { id: 'taak', kind: 'taak', items: [mc('t1')] },
      { id: 'hor', listen: true, items: [mc('h1')] },
      { id: 'skriv', items: [mc('s1'), { id: 's2', type: 'free', prompt: 'Schrijf.' }] },
      { id: 'gram', items: [mc('g1'), mc('g2'), mc('g3'), mc('g4'), mc('g5'), mc('g6'), mc('g7'), mc('g8'), mc('g9'), mc('g10')] },
    ],
  };
  const one = [chapter];
  const done = (...ids) => ({ ...empty(), ex: Object.fromEntries(ids.map((id) => [`1/${id}`, { best: 1, completedAt: 5 }])) });
  const fresh = (s, c = one) => awardBadges(s, c).fresh.map((b) => b.id);

  it('een badge per strand: lezen, zeggen, taak, luisteren en schrijven', () => {
    expect(fresh(done('lees'))).toEqual(['oefening-1', 'lezen-1']);
    expect(fresh(done('zeg', 'taak', 'hor', 'skriv'))).toEqual(['oefening-1', 'luisteren-1', 'zeggen-1', 'schrijven-1', 'taak-1']);
  });

  it('overgeslagen door de plaatsingstoets telt niet als zelf gelezen', () => {
    const s = { ...empty(), ex: { '1/lees': { best: 0, completedAt: 5, placed: 1 } } };
    expect(fresh(s)).not.toContain('lezen-1');
  });

  it('een niveau dat op deze site niet te halen is, verschijnt niet', () => {
    const ids = badgeOverview(empty(), one).map((b) => b.id);
    expect(ids).toContain('taak-1');
    expect(ids).not.toContain('taak-5');
    expect(ids).not.toContain('hoofdstukbeheerst-3');
    // Zonder doeltaken (zoals de B-site) geen taakbadges, maar een al behaalde blijft staan.
    const noTask = [{ ...chapter, exercises: chapter.exercises.filter((e) => e.kind !== 'taak') }];
    expect(badgeOverview(empty(), noTask).map((b) => b.id)).not.toContain('taak-1');
    expect(badgeOverview({ ...empty(), badges: { 'taak-1': 3 } }, noTask).find((b) => b.id === 'taak-1').earned).toBe(true);
  });

  it('alle hoofdstukken af: het doel is het aantal open hoofdstukken van de site', () => {
    const all = done(...chapter.exercises.map((e) => e.id));
    expect(fresh(all)).toContain('hoofdstuk-alle');
    const two = [chapter, { ...chapter, chapter: 2 }];
    expect(badgeOverview(all, two).find((b) => b.id === 'hoofdstuk-alle')).toMatchObject({ earned: false, done: 1, goal: 2 });
  });

  it('hoofdstuk beheerst: minstens 90% van de vragen in doos 4 of hoger', () => {
    const srs = (n) => {
      const out = {};
      let k = 0;
      for (const ex of chapter.exercises.filter((e) => !e.text)) {
        for (const it of ex.items.filter((i) => i.type === 'mc')) if (k++ < n) out[`1/${ex.id}/${it.id}`] = { box: 4, due: '2099-01-01', h: answerHash(it) };
      }
      return out;
    };
    // 14 losse vragen (zonder de leestekst en de vrije tekst): 12 is te weinig, 13 is genoeg.
    expect(fresh({ ...empty(), srs: srs(12) })).not.toContain('hoofdstukbeheerst-1');
    expect(fresh({ ...empty(), srs: srs(13) })).toContain('hoofdstukbeheerst-1');
  });

  it('snelle rondes hebben elk hun eigen badge', () => {
    const s = { ...empty(), games: { vlot: { best: 26 }, 'en-ett': { best: 12 } } };
    expect(fresh(s, [])).toEqual(['snel-15', 'vlot-25']);
  });

  it('het dagdoel van de herhaling: een dag telt één keer, ook op twee apparaten', () => {
    const ex = { id: 'gram', items: Array.from({ length: DAILY_GOAL + 2 }, (_, i) => mc(`q${i}`)) };
    const now = new Date(2026, 10, 24, 12).getTime();
    let s = empty();
    for (let i = 0; i < DAILY_GOAL - 1; i++) s = recordItem(s, 1, ex, i, 'good', { review: true, outside: true, now });
    expect(s.goalDays).toEqual([]);
    s = recordItem(s, 1, ex, DAILY_GOAL - 1, 'good', { review: true, outside: true, now });
    expect(s.goalDays).toEqual(['2026-11-24']);
    s = recordItem(s, 1, ex, DAILY_GOAL, 'good', { review: true, outside: true, now });
    expect(s.goalDays).toEqual(['2026-11-24']);
    const other = { ...empty(), goalDays: ['2026-11-20', '2026-11-24'] };
    expect(mergeStates(s, other).goalDays).toEqual(['2026-11-20', '2026-11-24']);
    expect(parseProgress(JSON.stringify(mergeStates(s, other))).goalDays).toHaveLength(2);
    const five = { ...empty(), goalDays: ['2026-01-01', '2026-01-02', '2026-01-05', '2026-02-01', '2026-03-01'] };
    expect(fresh(five, [])).toEqual(['dagdoel-5']);
  });
});
