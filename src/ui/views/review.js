// Herhalen: mix van een hoofdstuk, je fouten per hoofdstuk en uit alle hoofdstukken.
import { course, practiceEntries, balancedSample } from '../../app/content.js';
import { practiceView, plural } from '../shared.js';
import { shuffle } from '../../core/content/build.js';
import { weakItems } from '../../app/progress.js';

export function viewMix(ch) {
  document.title = `Mix · ${ch.title}`;
  const pool = practiceEntries([ch]);
  return practiceView(ch, {
    title: 'Mix',
    instruction: 'Tien willekeurige vragen uit het hele hoofdstuk.',
    entries: balancedSample(pool, 10, shuffle),
    again: `#/k/${ch.chapter}/mix?${Date.now()}`,
    empty: 'Dit hoofdstuk heeft nog geen vragen voor een mix.',
  });
}

export function viewWeak(ch) {
  document.title = `Je fouten · ${ch.title}`;
  // Vragen bij een leestekst hebben de tekst nodig; die laten we hier weg.
  const entries = weakItems(ch).filter(({ ex }) => !ex.text);
  return practiceView(ch, {
    title: 'Oefen je fouten',
    instruction: 'Vragen die je eerder fout had. Heb je er een in één keer goed, dan verdwijnt hij uit deze lijst.',
    entries: shuffle(entries).slice(0, 15),
    again: `#/k/${ch.chapter}/fouten?${Date.now()}`,
    empty: 'Er staan geen fouten meer open in dit hoofdstuk. Goed bezig!',
    left: {
      count: () => weakItems(ch).filter(({ ex }) => !ex.text).length,
      more: (n) => `Er ${n === 1 ? 'staat' : 'staan'} in dit hoofdstuk nog ${plural(n, 'fout', 'fouten')} open.`,
      done: 'Alle fouten in dit hoofdstuk zijn opgelost. Goed bezig!',
    },
  });
}

export function viewWeakAll() {
  document.title = 'Herhalen · Svenska övningar';
  const entries = course.filter((c) => c.available).flatMap((c) =>
    weakItems(c).filter(({ ex }) => !ex.text).map((w) => ({ ...w, chapter: c })));
  return practiceView(null, {
    title: 'Herhalen',
    instruction: 'Je openstaande fouten uit alle hoofdstukken. Heb je een vraag in één keer goed, dan verdwijnt hij uit de lijst.',
    entries: shuffle(entries).slice(0, 15),
    again: `#/herhalen?${Date.now()}`,
    left: {
      count: () => course.filter((c) => c.available).reduce((n, c) => n + weakItems(c).filter(({ ex }) => !ex.text).length, 0),
      more: (n) => `Er ${n === 1 ? 'staat' : 'staan'} nog ${plural(n, 'fout', 'fouten')} open.`,
      done: 'Alle fouten zijn opgelost. Goed bezig!',
    },
    empty: 'Er staan geen fouten open. Vragen die je fout hebt of waarvan je het antwoord bekijkt, komen hier vanzelf terug.',
  });
}
