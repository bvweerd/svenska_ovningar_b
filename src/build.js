// Zet ruwe hoofdstukinhoud (YAML) om naar het model dat de site gebruikt,
// inclusief automatisch gegenereerde woordenschatoefeningen.

/** Eenvoudige, voorspelbare pseudo-random generator (zodat builds en tests stabiel zijn). */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const article = (sv) => (sv.match(/^(en|ett) /) ?? [])[1];
// Soort woord, zodat de foute keuzes op het goede antwoord lijken (zelfstandig naamwoord met lidwoord, werkwoord …).
const kind = (v) => (article(v.sv) ? 'noun' : v.sv.startsWith('att ') ? 'verb' : 'other');
const nlBare = (nl) => nl.replace(/^(een|de|het) /, '');
const bare = (sv) => sv.replace(/^(en|ett|att) /, '');

export function vocabExercises(vocab, chapterNo) {
  if (!vocab?.length) return [];
  const rand = rng(chapterNo * 7919 + vocab.length);
  const exercises = [];

  exercises.push({
    id: 'woorden-sv-nl',
    title: 'Wat betekent het?',
    instruction: 'Kies de juiste Nederlandse vertaling.',
    topic: 'woordenschat',
    generated: true,
    shuffle: true,
    items: vocab.map((v) => {
      const pool = shuffle(vocab.filter((o) => o.nl !== v.nl), rand);
      const same = pool.filter((o) => kind(o) === kind(v));
      const others = [...same, ...pool.filter((o) => kind(o) !== kind(v))].slice(0, 3).map((o) => o.nl);
      return { type: 'mc', prompt: v.sv, say: v.sv, options: [v.nl, ...others], answer: 0 };
    }),
  });

  exercises.push({
    id: 'woorden-nl-sv',
    title: 'Hoe zeg je het in het Zweeds?',
    instruction: 'Vertaal naar het Zweeds. Schrijf bij zelfstandige naamwoorden het lidwoord (en/ett) erbij, bij werkwoorden „att”.',
    topic: 'woordenschat',
    generated: true,
    shuffle: true,
    items: vocab.map((v) => {
      const feedback = [];
      const art = article(v.sv);
      if (art) {
        feedback.push({ match: bare(v.sv), tip: `Vergeet het lidwoord niet: is „${bare(v.sv)}” een en-woord of een ett-woord?` });
        feedback.push({
          match: `${art === 'en' ? 'ett' : 'en'} ${bare(v.sv)}`,
          tip: `Bijna: „${bare(v.sv)}” is een ${art}-woord.`,
        });
      }
      if (v.sv.startsWith('att ')) {
        feedback.push({ match: bare(v.sv), tip: 'Zet „att” voor de infinitief, net als „te” in het Nederlands.' });
      }
      return { type: 'translate', prompt: v.nl, answers: [v.sv, ...(v.alt ?? [])], feedback };
    }),
  });

  const nouns = vocab.filter((v) => article(v.sv) && v.def);
  if (nouns.length) {
    exercises.push({
      id: 'woorden-en-ett',
      title: 'En of ett? En de bepaalde vorm',
      instruction: 'Kies het lidwoord en schrijf daarna de bepaalde vorm.',
      topic: 'woordenschat',
      generated: true,
      shuffle: true,
      items: nouns.map((v) => ({
        type: 'steps',
        steps: [
          {
            type: 'mc',
            prompt: `„${bare(v.sv)}” (${nlBare(v.nl)}) is een …`,
            options: ['en-woord', 'ett-woord'],
            answer: article(v.sv) === 'en' ? 0 : 1,
            shuffle: false,
            tip: 'Het geslacht moet je per woord leren. Ongeveer drie op de vier woorden zijn en-woorden.',
          },
          {
            type: 'gap',
            text: `${v.sv} → ___`,
            gaps: [{ answers: [v.def] }],
          },
        ],
      })),
    });
  }
  return exercises;
}

export function buildChapter(raw) {
  const sections = (raw.sections ?? []).map((s) => ({ ...s, exercises: [...(s.exercises ?? [])] }));
  const generated = vocabExercises(raw.vocab, raw.chapter);
  if (generated.length) {
    let w = sections.find((s) => s.id === 'woordenschat');
    if (!w) {
      w = { id: 'woordenschat', title: 'Woordenschat', exercises: [] };
      sections.push(w);
    }
    w.exercises.push(...generated);
  }
  const exercises = sections.flatMap((s) => s.exercises);
  return { ...raw, sections, exercises, grammar: raw.grammar ?? [] };
}

export function buildCourse(index, rawChapters) {
  const byNo = new Map(rawChapters.map((c) => [c.chapter, buildChapter(c)]));
  return index.chapters.map((meta) => ({
    ...meta,
    ...(byNo.get(meta.chapter) ?? {}),
    title: `Hoofdstuk ${meta.chapter}`,
    available: byNo.has(meta.chapter),
  }));
}
