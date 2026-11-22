// Prestaties (badges): vaste lijst, afgeleid uit de voortgang. Puur.
//
// Spelregels: een badge hangt alleen aan wat de app zelf nakijkt (vragen, kan-doen-doelen, afgeronde
// oefeningen, toetsen, dictee, snelle rondes), nooit aan zelfbeoordeling (flitskaarten). Nadruk op
// beheersing; oefendagen tellen in totaal, niet „op rij”, zodat een gemiste dag niets afpakt.
// Een behaalde badge blijft staan (state.badges[id] = tijdstip), ook als de inhoud later verandert.
// De id's staan vast, net als vraag-id's: verander ze niet.
import { canDoStatus } from '../progress/cando.js';
import { chapterDone } from '../progress/record.js';

const open = (course) => course.filter((c) => c.available);
const count = {
  exercises: (s) => Object.values(s.ex ?? {}).filter((r) => r.completedAt).length,
  goals: (s, course) => open(course).reduce((n, ch) => n + canDoStatus(s, ch).filter((x) => x.done).length, 0),
  chapters: (s, course) => open(course).filter((ch) => chapterDone(s, ch)).length,
  mastered: (s) => Object.values(s.srs ?? {}).filter((r) => r.box >= 4).length,
  tests80: (s) => Object.values(s.tests ?? {}).filter((t) => t.best >= 0.8).length,
  tests100: (s) => Object.values(s.tests ?? {}).filter((t) => t.best >= 1).length,
  days: (s) => (s.days ?? []).length,
  dictation: (s) => Object.values(s.dictee ?? {}).filter((x) => x === 'good').length,
  game: (s) => Math.max(0, ...Object.values(s.games ?? {}).map((g) => g.best ?? 0)),
};

/** Een reeks badges voor hetzelfde getal: brons, zilver, goud. */
const tiered = (group, icon, measure, levels, describe) => levels.map(([n, title], i) => ({
  id: `${group}-${n}`,
  group,
  tier: levels.length > 1 ? i + 1 : 0,
  icon,
  title,
  text: describe(n),
  measure,
  goal: n,
}));

const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

export const BADGES = [
  ...tiered('oefening', '🌱', count.exercises, [[1, 'Eerste stap'], [25, 'Op dreef'], [100, 'Doorzetter']],
    (n) => (n === 1 ? 'Rond je eerste oefening af.' : `Rond ${n} oefeningen af.`)),
  ...tiered('doelen', '🎯', count.goals, [[1, 'Doel bereikt'], [10, 'Doelgericht'], [25, 'Kan het allemaal']],
    (n) => `Behaal ${plural(n, 'kan-doen-doel', 'kan-doen-doelen')} (de app vinkt ze af als je de vragen beheerst).`),
  ...tiered('hoofdstuk', '📗', count.chapters, [[1, 'Hoofdstuk af'], [3, 'Drie op rij'], [6, 'Halverwege de berg'], [12, 'Bijna alles']],
    (n) => `Maak ${plural(n, 'hoofdstuk', 'hoofdstukken')} helemaal af.`),
  ...tiered('beheerst', '🧠', count.mastered, [[50, 'Het blijft hangen'], [250, 'Stevig geheugen'], [1000, 'Olifantengeheugen']],
    (n) => `Krijg ${n} vragen in doos 4 of hoger: vier keer achter elkaar in één keer goed, ook in de herhaling.`),
  ...tiered('toets', '📝', count.tests80, [[1, 'Geslaagd'], [5, 'Toetsbestendig']],
    (n) => (n === 1 ? 'Haal 80% of meer in een hoofdstuktoets.' : `Haal 80% of meer in ${n} hoofdstuktoetsen.`)),
  ...tiered('foutloos', '🏆', count.tests100, [[1, 'Foutloos']], () => 'Maak een hoofdstuktoets helemaal foutloos.'),
  ...tiered('dagen', '📅', count.days, [[5, 'Vaste gewoonte'], [20, 'Trouwe oefenaar'], [50, 'Volhouder']],
    (n) => `Oefen op ${n} verschillende dagen (hoeven niet achter elkaar).`),
  ...tiered('dictee', '🎧', count.dictation, [[25, 'Goed geluisterd']], (n) => `Schrijf ${n} zinnen of woorden goed op bij het dictee.`),
  ...tiered('snel', '⚡', count.game, [[15, 'Snelle denker']], (n) => `Haal ${n} goede antwoorden in één snelle ronde.`),
];

/** Stand van één badge: { earned, at, done, goal }. */
export function badgeStatus(state, course, badge) {
  const at = state.badges?.[badge.id] ?? null;
  const value = badge.measure(state, course);
  return { earned: !!at || value >= badge.goal, at, done: Math.min(value, badge.goal), goal: badge.goal };
}

/** Alle badges met hun stand. */
export const badgeOverview = (state, course) => BADGES.map((b) => ({ ...b, ...badgeStatus(state, course, b) }));

/**
 * Badges die nu gehaald zijn maar nog niet in de voortgang staan. Geeft de nieuwe toestand (met de
 * badges erin) en de lijst nieuwe badges. → { state, fresh }
 */
export function awardBadges(state, course, now = Date.now()) {
  const have = state.badges ?? {};
  // Elke maat hooguit één keer uitrekenen (meer badges delen dezelfde maat).
  const memo = new Map();
  const value = (b) => {
    if (!memo.has(b.measure)) memo.set(b.measure, b.measure(state, course));
    return memo.get(b.measure);
  };
  const fresh = BADGES.filter((b) => !have[b.id] && value(b) >= b.goal);
  if (!fresh.length) return { state, fresh };
  const badges = { ...have, ...Object.fromEntries(fresh.map((b) => [b.id, now])) };
  return { state: { ...state, badges }, fresh };
}
