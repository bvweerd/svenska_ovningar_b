// Prestaties (badges): vaste lijst, afgeleid uit de voortgang. Puur.
//
// Spelregels: een badge hangt alleen aan wat de app zelf nakijkt (vragen, kan-doen-doelen, afgeronde
// oefeningen, toetsen, dictee, snelle rondes), niet aan de flitskaarten (losse woordjes). Nadruk op
// beheersing; oefendagen tellen in totaal, niet „op rij”, zodat een gemiste dag niets afpakt.
// Een behaalde badge blijft staan (state.badges[id] = tijdstip), ook als de inhoud later verandert.
// De id's staan vast, net als vraag-id's: verander ze niet.
import { canDoStatus } from '../progress/cando.js';
import { chapterDone } from '../progress/record.js';
import { srsStats } from '../progress/srs.js';
import { practiceEntries } from '../content/entries.js';
import { plural } from '../text.js';

const open = (course) => course.filter((c) => c.available);
const count = {
  exercises: (s) => Object.values(s.ex ?? {}).filter((r) => r.completedAt).length,
  goals: (s, course) => open(course).reduce((n, ch) => n + canDoStatus(s, ch).filter((x) => x.done).length, 0),
  chapters: (s, course) => open(course).filter((ch) => chapterDone(s, ch)).length,
  // Zelfde telling als de dozen op de pagina Statistieken (alleen actuele vragen).
  mastered: (s, course) => srsStats(s, practiceEntries(course)).reduce((n, v, box) => n + (box >= 4 ? v : 0), 0),
  tests80: (s) => Object.values(s.tests ?? {}).filter((t) => t.best >= 0.8).length,
  tests100: (s) => Object.values(s.tests ?? {}).filter((t) => t.best >= 1).length,
  days: (s) => (s.days ?? []).length,
  dictation: (s) => Object.values(s.dictee ?? {}).filter((x) => x === 'good').length,
  game: (s) => Math.max(0, ...Object.values(s.games ?? {}).map((g) => g.best ?? 0)),
};

/** Een reeks badges voor hetzelfde getal: brons, zilver, goud. */
const tiered = (group, measure, levels, describe) => levels.map(([n, title], i) => ({
  id: `${group}-${n}`,
  group,
  tier: levels.length > 1 ? i + 1 : 0,
  title,
  text: describe(n),
  measure,
  goal: n,
}));

export const BADGES = [
  ...tiered('oefening', count.exercises, [[1, 'Eerste stap'], [25, 'Op dreef'], [100, 'Doorzetter']],
    (n) => (n === 1 ? 'Rond je eerste oefening af.' : `Rond ${n} oefeningen af.`)),
  ...tiered('doelen', count.goals, [[1, 'Doel bereikt'], [10, 'Doelgericht'], [25, 'Kan het allemaal']],
    (n) => `Behaal ${plural(n, 'kan-doen-doel', 'kan-doen-doelen')} (de app vinkt ze af als je de vragen beheerst).`),
  ...tiered('hoofdstuk', count.chapters, [[1, 'Hoofdstuk af'], [3, 'Drie op rij'], [6, 'Halverwege de berg'], [12, 'Bijna alles']],
    (n) => `Maak ${plural(n, 'hoofdstuk', 'hoofdstukken')} helemaal af.`),
  ...tiered('beheerst', count.mastered, [[50, 'Het blijft hangen'], [250, 'Stevig geheugen'], [1000, 'Olifantengeheugen']],
    (n) => `Krijg ${n} vragen in doos 4 of hoger: de eerste keer en daarna nog twee keer in de herhaling in één keer goed.`),
  ...tiered('toets', count.tests80, [[1, 'Geslaagd'], [5, 'Toetsbestendig']],
    (n) => (n === 1 ? 'Haal 80% of meer in een hoofdstuktoets.' : `Haal 80% of meer in ${n} hoofdstuktoetsen.`)),
  ...tiered('foutloos', count.tests100, [[1, 'Foutloos']], () => 'Maak een hoofdstuktoets helemaal foutloos.'),
  ...tiered('dagen', count.days, [[5, 'Vaste gewoonte'], [20, 'Trouwe oefenaar'], [50, 'Volhouder']],
    (n) => `Oefen op ${n} verschillende dagen (hoeven niet achter elkaar).`),
  ...tiered('dictee', count.dictation, [[25, 'Goed geluisterd']], (n) => `Schrijf ${n} zinnen of woorden goed op bij het dictee.`),
  ...tiered('snel', count.game, [[15, 'Snelle denker']], (n) => `Haal ${n} goede antwoorden in één snelle ronde.`),
];

/** Waarde van een maat, hooguit één keer uitgerekend (meer badges delen dezelfde maat). */
function measurer(state, course) {
  const memo = new Map();
  return (b) => {
    if (!memo.has(b.measure)) memo.set(b.measure, b.measure(state, course));
    return memo.get(b.measure);
  };
}

/** Alle badges met hun stand: { …badge, earned, at, done, goal }. */
export function badgeOverview(state, course) {
  const value = measurer(state, course);
  return BADGES.map((b) => {
    const at = state.badges?.[b.id] ?? null;
    const v = value(b);
    return { ...b, earned: !!at || v >= b.goal, at, done: Math.min(v, b.goal), goal: b.goal };
  });
}

/**
 * Badges die nu gehaald zijn maar nog niet in de voortgang staan. Geeft de nieuwe toestand (met de
 * badges erin) en de lijst nieuwe badges. → { state, fresh }
 */
export function awardBadges(state, course, now = Date.now()) {
  const have = state.badges ?? {};
  const value = measurer(state, course);
  const fresh = BADGES.filter((b) => !have[b.id] && value(b) >= b.goal);
  if (!fresh.length) return { state, fresh };
  const badges = { ...have, ...Object.fromEntries(fresh.map((b) => [b.id, now])) };
  return { state: { ...state, badges }, fresh };
}
