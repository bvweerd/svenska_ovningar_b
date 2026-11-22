// Alle pagina's van de site. Zie ui/router.js voor wat een route is.
import { chapterByNo } from './shared.js';
import { viewHome } from './views/home.js';
import { viewChapter } from './views/chapter.js';
import { viewExercise } from './views/exercise.js';
import { viewMix, viewWeak, viewWeakAll } from './views/review.js';
import { viewGrammarIndex, viewGrammar } from './views/grammar.js';
import { viewAbout } from './views/about.js';
import { viewLink } from './views/sync.js';
import { viewBadges } from './views/badges.js';
import { viewListenSettings, viewDictation } from './views/listen.js';
import { viewPracticeHub } from './views/practice/hub.js';
import { viewDaily } from './views/practice/daily.js';
import { viewVerbTrainer } from './views/practice/verbs.js';
import { viewFlashcards } from './views/practice/flashcards.js';
import { viewTest } from './views/practice/test.js';
import { viewGames, viewGame, GAMES } from './views/practice/games.js';

/** Route binnen een hoofdstuk: alleen als het hoofdstuk bestaat en open is. */
const inChapter = (view) => ({ params, ...rest }) => {
  const ch = chapterByNo(params.ch);
  return ch?.available ? view(ch, { params, ...rest }) : null;
};

export const routes = [
  { path: '/', view: () => viewHome(), refresh: true },
  { path: '/over', view: () => viewAbout() },
  { path: '/koppel', view: () => viewLink() },
  { path: '/koppel/:code', view: ({ params }) => viewLink(params.code) },
  { path: '/luisteren', view: () => viewListenSettings() },
  { path: '/grammatica', view: () => viewGrammarIndex() },
  { path: '/herhalen', view: () => viewWeakAll(), refresh: true },
  { path: '/prestaties', view: () => viewBadges(), refresh: true },
  { path: '/oefenen', view: () => viewPracticeHub(), refresh: true },
  { path: '/oefenen/herhaling', view: () => viewDaily() },
  { path: '/oefenen/werkwoorden', view: () => viewVerbTrainer() },
  { path: '/oefenen/luisteren', view: ({ query }) => viewDictation(query) },
  { path: '/oefenen/spel', view: () => viewGames() },
  { path: '/oefenen/spel/:id', view: ({ params, signal }) => (GAMES[params.id] ? viewGame(params.id, { signal }) : null) },
  { path: '/k/:ch', view: inChapter((ch) => viewChapter(ch)), refresh: true },
  { path: '/k/:ch/o/:ex', view: inChapter((ch, { params, query }) => {
    const ex = ch.exercises.find((e) => e.id === params.ex);
    return ex ? viewExercise(ch, ex, query) : null;
  }) },
  { path: '/k/:ch/g/:id', view: inChapter((ch, { params }) => {
    const card = ch.grammar.find((g) => g.id === params.id);
    return card ? viewGrammar(ch, card) : null;
  }) },
  { path: '/k/:ch/mix', view: inChapter((ch) => viewMix(ch)) },
  { path: '/k/:ch/fouten', view: inChapter((ch) => viewWeak(ch)) },
  { path: '/k/:ch/toets', view: inChapter((ch) => viewTest(ch)) },
  { path: '/k/:ch/kaarten', view: inChapter((ch, { signal }) => viewFlashcards(ch, { signal })) },
];
