// Algemene foutanalyse: zoekt uit wát er mis is aan een fout antwoord en geeft een tip
// zonder meteen het hele antwoord te verklappen.
import { tokens } from './normalize.js';

export function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const FOLD = { å: 'a', ä: 'a', ö: 'o' };
export const fold = (s) => s.replace(/[åäö]/g, (c) => FOLD[c]);

const sorted = (arr) => [...arr].sort().join(' ');

const ORDER_TIPS = {
  vragen:
    'Alle woorden kloppen, alleen de volgorde niet. In een ja/nee-vraag staat het werkwoord vooraan, direct gevolgd door het onderwerp.',
  inte: 'Alle woorden kloppen, alleen de volgorde niet. Let op de plaats van „inte”.',
  default:
    'Alle woorden kloppen, alleen de volgorde niet. Denk aan de V2-regel: in een hoofdzin staat het werkwoord altijd op plaats 2.',
};

const GENDER_PAIRS = new Set(['en|ett', 'ett|en', 'den|det', 'det|den']);

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Analyse van één fout woord ten opzichte van het verwachte woord. */
function wordDiagnosis(got, want) {
  if (GENDER_PAIRS.has(`${got}|${want}`)) {
    return {
      kind: 'gender',
      tip: `Kijk naar „${got}”: hoort dit bij een en-woord of bij een ett-woord?`,
    };
  }
  if (fold(got) === fold(want)) {
    const i = [...got].findIndex((c, k) => c !== want[k]);
    return {
      kind: 'diacritic',
      tip: `Bijna goed! Let op de puntjes en het rondje: in „${got}” hoort een „${want[i]}”, geen „${got[i]}”.`,
    };
  }
  // Eén letter te veel of te weinig midden in het woord: een tikfout, geen uitgang.
  const suffix = commonPrefix([...got].reverse().join(''), [...want].reverse().join(''));
  if (Math.abs(got.length - want.length) === 1 && suffix >= 1 && levenshtein(got, want) === 1) {
    return { kind: 'spelling', tip: `Bijna goed! Controleer de spelling van „${got}”.` };
  }
  const p = commonPrefix(got, want);
  const gotEnd = got.slice(p);
  const wantEnd = want.slice(p);
  if (p >= 3 && (gotEnd.length > 0 || wantEnd.length > 0) && gotEnd.length <= 4 && wantEnd.length <= 4) {
    const genderEnd =
      (gotEnd === 'en' && wantEnd === 'et') ||
      (gotEnd === 'et' && wantEnd === 'en') ||
      (gotEnd === 'n' && wantEnd === 't') ||
      (gotEnd === 't' && wantEnd === 'n');
    if (genderEnd) {
      return {
        kind: 'gender',
        tip: `De uitgang van „${got}” klopt niet. Is het een en-woord (-en/-n) of een ett-woord (-et/-t)?`,
      };
    }
    return {
      kind: 'ending',
      tip: gotEnd
        ? `Het begin „${got.slice(0, p)}-” klopt, maar de uitgang „-${gotEnd}” niet.`
        : `Het begin „${got}” klopt, maar er moet nog een uitgang achter.`,
    };
  }
  if (levenshtein(got, want) <= (want.length >= 8 ? 2 : 1)) {
    return { kind: 'spelling', tip: `Bijna goed! Controleer de spelling van „${got}”.` };
  }
  return null;
}

const HA = { är: 'har', var: 'hade' };

/**
 * „är/var + voltooid deelwoord” waar het goede antwoord „har/hade” + datzelfde woord heeft: een typische
 * fout van Nederlandstaligen (ik ben gegaan, ik was geweest).
 */
function auxiliaryDiagnosis(ti, te) {
  for (let k = 0; k < ti.length - 1; k++) {
    const want = HA[ti[k]];
    if (!want) continue;
    const next = ti[k + 1];
    const pairs = te.slice(0, -1).map((w, j) => `${w} ${te[j + 1]}`);
    if (pairs.includes(`${want} ${next}`) && !pairs.includes(`${ti[k]} ${next}`)) {
      return {
        kind: 'auxiliary',
        tip: `Let op „${ti[k]} ${next}”: in het Zweeds gebruik je bij de voltooide tijd altijd „ha” (${want}), ook waar het Nederlands „zijn” gebruikt (ik ben gegaan → jag har gått).`,
      };
    }
  }
  return null;
}

/**
 * @param {string} input     genormaliseerde invoer
 * @param {string[]} expected genormaliseerde goede varianten
 * @param {{topic?: string}} ctx
 * @returns {{kind: string, tip: string} | null}
 */
export function diagnose(input, expected, { topic } = {}) {
  if (!expected.length) return null;
  const want = expected.reduce((best, e) =>
    levenshtein(input, e) < levenshtein(input, best) ? e : best,
  );
  const ti = tokens(input);
  const te = tokens(want);

  // Zelfde woorden, andere volgorde
  if (ti.length === te.length && ti.length > 1 && sorted(ti) === sorted(te)) {
    const withoutInte = (arr) => arr.filter((w) => w !== 'inte').join(' ');
    if (ti.includes('inte') && withoutInte(ti) === withoutInte(te)) {
      return {
        kind: 'inte',
        tip: 'De woorden kloppen, maar „inte” staat op de verkeerde plek. In een hoofdzin staat „inte” na het werkwoord, en na het onderwerp als dat achter het werkwoord staat.',
      };
    }
    return { kind: 'order', tip: ORDER_TIPS[topic] ?? ORDER_TIPS.default };
  }

  // „Jag är gått” (naar „ik ben gegaan”): in het Zweeds altijd ha bij de voltooide tijd.
  const aux = auxiliaryDiagnosis(ti, te);
  if (aux) return aux;

  // Eén woord anders
  if (ti.length === te.length) {
    const diffs = ti.map((w, k) => k).filter((k) => ti[k] !== te[k]);
    if (diffs.length === 1) {
      const k = diffs[0];
      const d = wordDiagnosis(ti[k], te[k]);
      if (d) return d;
      return ti.length > 1
        ? { kind: 'word', tip: `Bijna: één woord klopt niet, namelijk „${ti[k]}”.` }
        : null;
    }
  }

  // Woord vergeten of te veel
  if (te.length - ti.length === 1) {
    const missing = te.filter((w) => !ti.includes(w));
    if (missing.length === 1 && ti.every((w) => te.includes(w))) {
      if (['en', 'ett'].includes(missing[0])) {
        return { kind: 'article', tip: 'Vergeet het lidwoord („en” of „ett”) niet.' };
      }
      if (missing[0] === 'att') {
        return { kind: 'missing', tip: 'Er ontbreekt één klein woordje: denk aan „att”.' };
      }
      return { kind: 'missing', tip: 'Er ontbreekt één woord.' };
    }
  }
  if (ti.length - te.length === 1 && te.every((w) => ti.includes(w))) {
    return { kind: 'extra', tip: 'Er staat één woord te veel.' };
  }

  if (levenshtein(input, want) <= 2 && want.length >= 6) {
    return { kind: 'spelling', tip: 'Bijna goed! Controleer de spelling.' };
  }
  return null;
}
