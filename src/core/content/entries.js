// Losse vragen die buiten hun oefening te gebruiken zijn (geen leesteksten of schrijfopdrachten):
// voor de dagelijkse herhaling, mix, toetsen en prestaties. Puur.
import { isGradable } from '../items/index.js';

// Per hoofdstuk één keer opbouwen: de inhoud verandert niet terwijl de app draait.
const perChapter = new WeakMap();

function chapterEntries(chapter) {
  if (!perChapter.has(chapter)) {
    perChapter.set(chapter, chapter.exercises
      .filter((ex) => !ex.text)
      .flatMap((ex) => ex.items.map((item, idx) => ({ chapter, ex, idx, item })).filter(({ item }) => isGradable(item))));
  }
  return perChapter.get(chapter);
}

/** [{ chapter, ex, idx, item }] van de open hoofdstukken. */
export const practiceEntries = (chapters) => chapters.filter((c) => c.available).flatMap(chapterEntries);
