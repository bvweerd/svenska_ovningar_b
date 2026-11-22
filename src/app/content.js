import index from '../../content/index.yaml';
import verbData from '../../content/verbs.yaml';
import { buildCourse } from '../core/content/build.js';
import { isGradable } from '../core/items/index.js';

const files = import.meta.glob('../../content/chapters/*.yaml', { eager: true, import: 'default' });

export const course = buildCourse(index, Object.values(files));
export const verbs = verbData.verbs;
export const levels = index.levels ?? [];

/**
 * Neemt n willekeurige vragen, waarvan hooguit een derde uit automatisch gemaakte
 * woordenschatoefeningen (generated). Anders overheersen die in mix en toets zodra de
 * woordenlijsten groeien, en komt de grammatica van het hoofdstuk nauwelijks aan bod.
 */
export function balancedSample(entries, n, shuffleFn) {
  const vocab = shuffleFn(entries.filter((e) => e.ex.generated));
  const other = shuffleFn(entries.filter((e) => !e.ex.generated));
  const maxVocab = Math.max(Math.floor(n / 3), n - other.length);
  const pickedVocab = vocab.slice(0, maxVocab);
  return shuffleFn([...other.slice(0, n - pickedVocab.length), ...pickedVocab]).slice(0, n);
}

/** Alle losse vragen die buiten hun oefening te gebruiken zijn (geen leesteksten of schrijfopdrachten). */
export function practiceEntries(chapters = course) {
  return chapters
    .filter((c) => c.available)
    .flatMap((chapter) => chapter.exercises
      .filter((ex) => !ex.text)
      .flatMap((ex) => ex.items.map((item, idx) => ({ chapter, ex, idx, item })).filter(({ item }) => isGradable(item))));
}
