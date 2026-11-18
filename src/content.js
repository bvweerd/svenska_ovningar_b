import index from '../content/index.yaml';
import verbData from '../content/verbs.yaml';
import { buildCourse } from './build.js';

const files = import.meta.glob('../content/chapters/*.yaml', { eager: true, import: 'default' });

export const course = buildCourse(index, Object.values(files));
export const verbs = verbData.verbs;
export const levels = index.levels ?? [];

/** Alle losse vragen die buiten hun oefening te gebruiken zijn (geen leesteksten of schrijfopdrachten). */
export function practiceEntries(chapters = course) {
  return chapters
    .filter((c) => c.available)
    .flatMap((chapter) => chapter.exercises
      .filter((ex) => !ex.text)
      .flatMap((ex) => ex.items.map((item, idx) => ({ chapter, ex, idx, item })).filter(({ item }) => item.type !== 'free')));
}
