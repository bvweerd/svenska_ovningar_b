// Werkwoordtrainer en spelvragen: vragen genereren uit content/verbs.yaml.

import { list } from './content/build.js';

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
  partikel: 'partikelwerkwoorden (ta upp)',
};

// Partikelwerkwoorden (ta upp, komma överens): het werkwoord is het eerste woord, de rest
// (partikel, voorzetsel, zelfstandig naamwoord) blijft onveranderd achter elke vorm staan.
const head = (s) => s.split(' ')[0];
const tail = (verb) => verb.inf.slice(head(verb.inf).length); // " upp", " överens", " reda på"
const withoutTail = (f, rest) => (f.endsWith(rest) ? f.slice(0, -rest.length) : f);
const withHar = (forms, tense) => (tense === 'sup' ? forms.map((f) => `[har ]${f}`) : forms);

// Soorten die al bestonden voordat de instellingen bijhielden welke soorten iemand al kende.
// Deze lijst nooit uitbreiden: een nieuwe soort in KINDS gaat vanzelf aan voor bestaande gebruikers.
const KINDS_BEFORE_SEEN = ['ar', 'er', 'kort', 'sterk'];

/** Zet soorten aan die er sinds de vorige keer bij kwamen; geeft een nieuw object terug. */
export function withNewKinds(settings, kindKeys) {
  const seen = settings.seen ?? KINDS_BEFORE_SEEN;
  return {
    ...settings,
    kinds: [...new Set([...settings.kinds, ...kindKeys.filter((k) => !seen.includes(k))])],
    seen: [...new Set([...seen, ...kindKeys])],
  };
}

/** Vormen die een leerling vaak "regelmatig" raadt. */
export function naiveForms(verb, tense) {
  const rest = tail(verb);
  if (rest) {
    // Dezelfde fouten als bij het werkwoord zelf, met het partikel erachter.
    const base = { inf: head(verb.inf), [tense]: list(verb[tense]).map((f) => withoutTail(f, rest)) };
    return naiveForms(base, tense).map((f) => f + rest);
  }
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
  if (verb.kind === 'partikel') return `Bij een partikelwerkwoord vervoeg je alleen „${head(verb.inf)}” (sterk of zwak, zoals altijd); „${tail(verb).trim()}” blijft erachter staan.`;
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
  const answers = withHar(forms, tense);
  const rest = tail(verb);
  const feedback = [];
  for (const [other, info] of Object.entries(TENSES)) {
    if (other === tense) continue;
    const otherForms = list(verb[other]).filter((f) => !forms.includes(f));
    if (otherForms.length) feedback.push({ match: otherForms, tip: `Dat is de ${info.label}. Gevraagd wordt de ${TENSES[tense].label}.` });
  }
  const naive = naiveForms(verb, tense).filter((f) => !feedback.some((fb) => fb.match.includes(f)));
  if (naive.length) feedback.push({ match: naive, tip: kindTip(verb, tense) });
  if (rest) {
    // Alleen het werkwoord, zonder partikel: tagit in plaats van tagit upp.
    const bare = forms.map((f) => withoutTail(f, rest)).filter((f) => !forms.includes(f));
    if (bare.length) feedback.push({ match: withHar(bare, tense), tip: `Vergeet „${rest.trim()}” niet: dat hoort bij dit werkwoord.` });
  }
  return {
    type: 'gap',
    topic: verb.kind === 'partikel' ? 'partikelverb' : verb.kind === 'sterk' && tense !== 'imp' ? (tense === 'sup' ? 'supinum' : 'starka-verb') : TENSES[tense].topic,
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
