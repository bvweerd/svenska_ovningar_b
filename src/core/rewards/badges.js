// Prestaties (badges): vaste lijst, afgeleid uit de voortgang. Puur.
//
// Spelregels: een badge hangt alleen aan wat de app zelf nakijkt (vragen, kan-doen-doelen, afgeronde
// oefeningen, toetsen, dictee, snelle rondes), niet aan de flitskaarten (losse woordjes). Nadruk op
// beheersing en op de vier strands (lezen, luisteren, zeggen en schrijven, vlot); oefendagen en dagdoelen
// tellen in totaal, niet „op rij”, zodat een gemiste dag niets afpakt.
// Een behaalde badge blijft staan (state.badges[id] = tijdstip), ook als de inhoud later verandert.
// De id's staan vast, net als vraag-id's: verander ze niet.
import { canDoStatus } from '../progress/cando.js';
import { chapterDone } from '../progress/record.js';
import { srsStats } from '../progress/srs.js';
import { practiceEntries } from '../content/entries.js';
import { plural } from '../text.js';

const open = (course) => course.filter((c) => c.available);

// Soorten oefeningen voor de badges per strand (lezen, luisteren, zeggen, schrijven, taak).
const KINDS = {
  lezen: (ex) => ex.kind === 'makkelijk',
  luisteren: (ex) => !!ex.listen,
  zeggen: (ex) => ex.kind === 'situatie',
  taak: (ex) => ex.kind === 'taak',
  schrijven: (ex) => ex.items?.at(-1)?.type === 'free',
};
const exercisesOf = (course, kind) => open(course).flatMap((ch) => (ch.exercises ?? []).filter(KINDS[kind]).map((ex) => [ch, ex]));
const memoByCourse = (fn) => {
  const memo = new WeakMap();
  return (course) => {
    if (!memo.has(course)) memo.set(course, fn(course));
    return memo.get(course);
  };
};
// Zelf afgerond: een oefening die de plaatsingstoets heeft overgeslagen (placed), telt hier niet.
const doneOf = (kind) => (s, course) => exercisesOf(course, kind)
  .filter(([ch, ex]) => { const r = s.ex?.[`${ch.chapter}/${ex.id}`]; return r?.completedAt && !r.placed; }).length;
const totalOf = (kind) => memoByCourse((course) => exercisesOf(course, kind).length);

/** Deel van de vragen van een hoofdstuk dat in doos 4 of hoger moet staan om het hoofdstuk te beheersen. */
export const CHAPTER_MASTERY = 0.9;
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
  gameBest: (id) => (s) => s.games?.[id]?.best ?? 0,
  goalDays: (s) => (s.goalDays ?? []).length,
  masteredChapters: (s, course) => open(course).filter((ch) => {
    const entries = practiceEntries([ch]);
    if (!entries.length) return false;
    const boxes = srsStats(s, entries);
    return boxes.reduce((n, v, box) => n + (box >= 4 ? v : 0), 0) >= CHAPTER_MASTERY * entries.length;
  }).length,
  lezen: doneOf('lezen'),
  luisteren: doneOf('luisteren'),
  zeggen: doneOf('zeggen'),
  taak: doneOf('taak'),
  schrijven: doneOf('schrijven'),
};

const openChapters = memoByCourse((course) => open(course).length);


/**
 * Een reeks badges voor hetzelfde getal: brons, zilver, goud.
 * @param max  hoeveel er op deze site te halen is (course → getal): een niveau daarboven verschijnt niet.
 */
const tiered = (group, measure, levels, describe, max) => levels.map(([n, title], i) => ({
  id: `${group}-${n}`,
  group,
  tier: levels.length > 1 ? i + 1 : 0,
  title,
  text: describe(n),
  measure,
  goal: n,
  ...(max ? { max } : {}),
}));
const done = (n, one, many) => (n === 1 ? one : many.replace('#', n));

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

  // Per strand (Nation): lezen, luisteren, zeggen en schrijven. Alleen oefeningen die je zelf afrondt.
  ...tiered('lezen', count.lezen, [[1, 'Boekenwurm'], [10, 'Lezer'], [30, 'Veellezer']],
    (n) => done(n, 'Lees een makkelijke tekst en beantwoord de vragen.', 'Rond # makkelijke teksten af.'), totalOf('lezen')),
  ...tiered('luisteren', count.luisteren, [[1, 'Een en al oor'], [5, 'Goede luisteraar']],
    (n) => done(n, 'Rond een luisteroefening af.', 'Rond # luisteroefeningen af.'), totalOf('luisteren')),
  ...tiered('zeggen', count.zeggen, [[1, 'Wat zeg je?'], [5, 'Gevat'], [12, 'Altijd een antwoord']],
    (n) => done(n, 'Rond een oefening „Wat zeg je?” af.', 'Rond # oefeningen „Wat zeg je?” af.'), totalOf('zeggen')),
  ...tiered('schrijven', count.schrijven, [[1, 'Pen op papier'], [10, 'Schrijver']],
    (n) => done(n, 'Rond een schrijfopdracht af.', 'Rond # schrijfopdrachten af.'), totalOf('schrijven')),
  ...tiered('taak', count.taak, [[1, 'Geregeld'], [5, 'Redt zich overal']],
    (n) => done(n, 'Rond een doeltaak af.', 'Rond # doeltaken af.'), totalOf('taak')),

  // Herhalen en onthouden.
  ...tiered('dagdoel', count.goalDays, [[5, 'Dagelijkse kost'], [25, 'Vaste prik'], [75, 'Huismerk']],
    (n) => `Haal het dagdoel van de dagelijkse herhaling op ${n} dagen (hoeven niet achter elkaar).`),
  ...tiered('hoofdstukbeheerst', count.masteredChapters, [[1, 'Kent het van buiten'], [3, 'Drie in de pocket']],
    (n) => `Krijg in ${plural(n, 'hoofdstuk', 'hoofdstukken')} minstens 9 van de 10 vragen in doos 4 of hoger.`, openChapters),

  // Vlot: per snelle ronde.
  ...tiered('vlot', count.gameBest('vlot'), [[25, 'Vlot'], [40, 'Bliksemsnel']],
    (n) => `Haal ${n} goede antwoorden in één ronde Vlot herhalen.`),
  ...tiered('en-ett', count.gameBest('en-ett'), [[25, 'En of ett'], [40, 'Lidwoordkenner']],
    (n) => `Haal ${n} goede antwoorden in één ronde En of ett?.`),

  // Alle hoofdstukken van deze site af.
  {
    id: 'hoofdstuk-alle', group: 'alles', tier: 0, title: 'Skål!',
    text: 'Maak alle hoofdstukken van deze site helemaal af.', measure: count.chapters, goal: openChapters,
  },
];

/** Doel van een badge op deze site (een getal, of uit de inhoud afgeleid). */
const goalOf = (b, course) => (typeof b.goal === 'function' ? b.goal(course) : b.goal);
/** Te halen op deze site: genoeg oefeningen of hoofdstukken (de B-site heeft bijvoorbeeld geen doeltaken). */
const reachable = (b, course) => goalOf(b, course) > 0 && (!b.max || b.max(course) >= goalOf(b, course));

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
  return BADGES.filter((b) => state.badges?.[b.id] || reachable(b, course)).map((b) => {
    const at = state.badges?.[b.id] ?? null;
    const v = value(b);
    const goal = goalOf(b, course);
    return { ...b, earned: !!at || v >= goal, at, done: Math.min(v, goal), goal };
  });
}

/**
 * Badges die nu gehaald zijn maar nog niet in de voortgang staan. Geeft de nieuwe toestand (met de
 * badges erin) en de lijst nieuwe badges. → { state, fresh }
 */
export function awardBadges(state, course, now = Date.now()) {
  const have = state.badges ?? {};
  const value = measurer(state, course);
  const fresh = BADGES.filter((b) => !have[b.id] && reachable(b, course) && value(b) >= goalOf(b, course));
  if (!fresh.length) return { state, fresh };
  const badges = { ...have, ...Object.fromEntries(fresh.map((b) => [b.id, now])) };
  return { state: { ...state, badges }, fresh };
}
