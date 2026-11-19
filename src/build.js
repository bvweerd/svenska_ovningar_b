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

/** Lange woordenlijsten worden per ronde van zoveel woorden geoefend (zie pickRound in progress.js). */
export const VOCAB_ROUND = 15;

export const list = (x) => [].concat(x ?? []);
/** Eerste betekenis zonder lidwoord en toelichting: "een klok, een horloge" → "klok". */
const firstSense = (nl) => nlBare(nl.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim());
const BOLD = /\*\*([^*]+)\*\*/g;

/**
 * Woord in een voorbeeldzin: ex = "Jag tar **bussen** varje morgon." (precies één vet stuk).
 * Geeft { text, answer } met ___ op de plek van het vette stuk, of null.
 */
export function exampleGap(ex) {
  const hits = [...String(ex ?? '').matchAll(BOLD)];
  if (hits.length !== 1) return null;
  return { text: ex.replace(BOLD, '___'), answer: hits[0][1] };
}

/**
 * Woord-entry in content: { sv, nl, def?, pl?, alt?, ex?, exNl? }
 *   def  bepaalde vorm enkelvoud (bilen; of een lijst als beide goed zijn), pl  meervoud (bilar; of een lijst als beide goed zijn),
 *   ex   Zweedse voorbeeldzin met het woord **vet**, exNl  de Nederlandse vertaling daarvan.
 * @param nounTopic    onderwerp voor de en/ett-oefening: "substantiv" als de cursus daar een
 *                     uitlegkaart voor heeft (A1–A2), anders "woordenschat". Zo ook pluralTopic.
 */
export function vocabExercises(vocab, chapterNo, { nounTopic = 'woordenschat', pluralTopic = 'woordenschat' } = {}) {
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
    roundSize: VOCAB_ROUND,
    items: vocab.map((v) => {
      const pool = shuffle(vocab.filter((o) => o.nl !== v.nl), rand);
      const same = pool.filter((o) => kind(o) === kind(v));
      const others = [...same, ...pool.filter((o) => kind(o) !== kind(v))].slice(0, 3).map((o) => o.nl);
      return { id: v.sv, type: 'mc', prompt: v.sv, say: v.sv, options: [v.nl, ...others], answer: 0 };
    }),
  });

  exercises.push({
    id: 'woorden-nl-sv',
    title: 'Hoe zeg je het in het Zweeds?',
    instruction: 'Vertaal naar het Zweeds. Schrijf bij zelfstandige naamwoorden het lidwoord (en/ett) erbij, bij werkwoorden „att”.',
    topic: 'woordenschat',
    generated: true,
    shuffle: true,
    roundSize: VOCAB_ROUND,
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
      return { id: v.sv, type: 'translate', prompt: v.nl, answers: [v.sv, ...(v.alt ?? [])], feedback };
    }),
  });

  const nouns = vocab.filter((v) => article(v.sv) && v.def);
  if (nouns.length) {
    exercises.push({
      id: 'woorden-en-ett',
      title: 'En of ett? En de bepaalde vorm',
      instruction: 'Kies het lidwoord en schrijf daarna de bepaalde vorm.',
      topic: nounTopic,
      generated: true,
      shuffle: true,
      roundSize: VOCAB_ROUND,
      items: nouns.map((v) => ({
        id: v.sv,
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
            gaps: [{ answers: list(v.def) }],
          },
        ],
      })),
    });
  }

  const plurals = vocab.filter((v) => article(v.sv) && v.pl);
  if (plurals.length) {
    exercises.push({
      id: 'woorden-meervoud',
      title: 'Meervoud van de woorden',
      instruction: 'Schrijf het meervoud (onbepaald, zonder lidwoord).',
      topic: pluralTopic,
      generated: true,
      shuffle: true,
      roundSize: VOCAB_ROUND,
      items: plurals.map((v) => {
        const pl = list(v.pl);
        const feedback = [];
        if (!pl.includes(bare(v.sv))) feedback.push({ match: [bare(v.sv), v.sv], tip: 'Dat is nog enkelvoud. Welke uitgang krijgt dit woord in het meervoud?' });
        for (const d of list(v.def).filter((d) => !pl.includes(d))) feedback.push({ match: d, tip: 'Dat is de bepaalde vorm enkelvoud. Gevraagd wordt het meervoud.' });
        return {
          id: v.sv,
          type: 'gap',
          text: `${v.sv} (${firstSense(v.nl)}) → meervoud: ___`,
          gaps: [{ answers: pl, feedback }],
        };
      }),
    });
  }

  const examples = vocab.map((v) => ({ v, gap: exampleGap(v.ex) })).filter(({ gap }) => gap);
  if (examples.length) {
    exercises.push({
      id: 'woorden-in-zin',
      title: 'Woorden in een zin',
      instruction: 'Vul het woord in de goede vorm in. De Nederlandse zin helpt je op weg.',
      topic: 'woordenschat',
      generated: true,
      shuffle: true,
      roundSize: VOCAB_ROUND,
      items: examples.map(({ v, gap }) => ({
        id: v.sv,
        type: 'gap',
        prompt: v.exNl,
        text: gap.text,
        // Woorden die niet verbuigen (nu, snart, varje …) zouden met het grondwoord als hint
        // hun antwoord verklappen: geef daar de Nederlandse betekenis.
        hint: `(${kind(v) === 'other' ? firstSense(v.nl) : bare(v.sv)})`,
        gaps: [{ answers: [gap.answer] }],
      })),
    });
  }
  return exercises;
}

export function buildChapter(raw, opts = {}) {
  const sections = (raw.sections ?? []).map((s) => ({ ...s, exercises: [...(s.exercises ?? [])] }));
  const generated = vocabExercises(raw.vocab, raw.chapter, opts);
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
  const hasCard = (id) => rawChapters.some((c) => c.grammar?.some((g) => g.id === id));
  const nounTopic = hasCard('substantiv') ? 'substantiv' : 'woordenschat';
  const pluralTopic = hasCard('plural') ? 'plural' : 'woordenschat';
  const byNo = new Map(rawChapters.map((c) => [c.chapter, buildChapter(c, { nounTopic, pluralTopic })]));
  return index.chapters.map((meta) => ({
    ...meta,
    ...(byNo.get(meta.chapter) ?? {}),
    title: `Hoofdstuk ${meta.chapter}`,
    available: byNo.has(meta.chapter),
  }));
}
