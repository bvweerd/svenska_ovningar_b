// Werkwoordtrainer en spelvragen: vragen genereren uit content/verbs.yaml.

export const TENSES = {
  pres: { label: 'presens', topic: 'presens' },
  pret: { label: 'preteritum', topic: 'preteritum' },
  sup: { label: 'supinum (har …)', topic: 'supinum' },
  imp: { label: 'gebiedende wijs', topic: 'imperativ' },
};

export const KINDS = {
  ar: 'op -ar (jobba)',
  er: 'op -er (köpa, ringa)',
  kort: 'kort (bo, tro)',
  sterk: 'sterk en onregelmatig (gå, äta)',
};

const list = (x) => [].concat(x ?? []);

/** Vormen die een leerling vaak "regelmatig" raadt. */
export function naiveForms(verb, tense) {
  const stem = verb.inf.endsWith('a') ? verb.inf.slice(0, -1) : verb.inf;
  const forms = {
    pres: [`${verb.inf}r`, `${stem}er`, `${stem}ar`],
    pret: [`${stem}ade`, `${stem}de`, `${stem}te`, `${verb.inf}dde`],
    sup: [`${stem}at`, `${stem}t`, `${verb.inf}tt`, `${stem}it`],
    imp: [verb.inf, stem, `${stem}a`],
  }[tense];
  const correct = new Set(list(verb[tense]));
  return [...new Set(forms)].filter((f) => !correct.has(f) && f.length > 1);
}

function kindTip(verb, tense) {
  if (verb.kind === 'sterk') return `${verb.inf} is een sterk of onregelmatig werkwoord. Deze vorm moet je uit je hoofd leren.`;
  if (tense === 'pres') {
    return {
      ar: 'Een -ar-werkwoord: infinitief + r.',
      er: 'Bij dit werkwoord wordt de -a een -er.',
      kort: 'Een kort werkwoord: alleen -r erachter.',
    }[verb.kind];
  }
  if (tense === 'imp') {
    return {
      ar: 'Bij een -ar-werkwoord is de gebiedende wijs gelijk aan de infinitief.',
      er: 'Bij een -er-werkwoord haal je de -a van de infinitief weg.',
      kort: 'Bij een kort werkwoord is de gebiedende wijs gelijk aan de infinitief.',
    }[verb.kind];
  }
  return {
    ar: 'Een -ar-werkwoord: -ade in de preteritum, -at in de supinum.',
    er: 'Een -er-werkwoord: stam + -de of -te (k, p, s, t, x → -te), supinum: stam + -t.',
    kort: 'Een kort werkwoord: -dde in de preteritum, -tt in de supinum.',
  }[verb.kind];
}

/** Maakt een invulvraag voor één werkwoord en één tijd. */
export function verbItem(verb, tense) {
  const forms = list(verb[tense]);
  const answers = tense === 'sup' ? forms.map((f) => `[har ]${f}`) : forms;
  const feedback = [];
  for (const [other, info] of Object.entries(TENSES)) {
    if (other === tense) continue;
    const otherForms = list(verb[other]).filter((f) => !forms.includes(f));
    if (otherForms.length) feedback.push({ match: otherForms, tip: `Dat is de ${info.label}. Gevraagd wordt de ${TENSES[tense].label}.` });
  }
  const naive = naiveForms(verb, tense).filter((f) => !feedback.some((fb) => fb.match.includes(f)));
  if (naive.length) feedback.push({ match: naive, tip: kindTip(verb, tense) });
  return {
    type: 'gap',
    topic: verb.kind === 'sterk' && tense !== 'imp' ? (tense === 'sup' ? 'supinum' : 'starka-verb') : TENSES[tense].topic,
    text: `**${verb.inf}** (${verb.nl}) → ${TENSES[tense].label}: ___`,
    gaps: [{ answers, feedback }],
  };
}

/** Kiest een willekeurige vraag volgens de instellingen. */
export function pickVerbItem(verbs, { tenses, kinds }, rand = Math.random, avoid = null) {
  const pool = verbs.filter((v) => kinds.includes(v.kind));
  const pairs = pool.flatMap((v) => tenses.filter((t) => v[t]).map((t) => ({ verb: v, tense: t })));
  if (!pairs.length) return null;
  const fresh = pairs.filter((p) => p.verb.inf !== avoid);
  const from = fresh.length ? fresh : pairs;
  const pick = from[Math.floor(rand() * from.length)];
  return { ...pick, item: verbItem(pick.verb, pick.tense) };
}

/** Drie opties voor het spel "verleden tijd": de goede vorm en twee aannemelijke fouten. */
export function pretOptions(verb, rand = Math.random) {
  const correct = list(verb.pret)[0];
  const wrong = naiveForms(verb, 'pret').filter((f) => !list(verb.pret).includes(f));
  const picked = [];
  const pool = [...wrong];
  while (picked.length < 2 && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return { correct, options: [correct, ...picked] };
}
