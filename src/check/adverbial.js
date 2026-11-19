// Een tijdsbepaling mag in het Zweeds vooraan (met inversie) of achteraan staan:
//   „På kvällen tittar Bram på tv.” = „Bram tittar på tv på kvällen.”
// Deze module maakt bij een goed antwoord de andere volgorde, zodat de nakijker die ook goedkeurt.
// Bewust voorzichtig: alleen bij een eenvoudige hoofdzin, en nooit als daardoor een
// zinsbijwoord als „inte” vóór het werkwoord belandt (een typische fout die de site juist afkeurt).
// Werkt op genormaliseerde tekst (kleine letters, zonder leestekens, „i dag” al samengevoegd tot „idag”).

/** Losse woorden die als tijdsbepaling vooraan of achteraan kunnen. */
const TIME_WORDS = new Set([
  'idag', 'igår', 'imorgon', 'ikväll', 'inatt', 'imorse', 'iår', 'ifjol', 'iförrgår', 'iövermorgon',
  'ibland', 'nu', 'då', 'sedan', 'sen', 'snart', 'förut', 'senare', 'tidigt', 'sent',
]);

/** Woorden die een tijdsbepaling kunnen beginnen (voorzetsels en dergelijke). */
const TIME_START = new Set([
  'på', 'i', 'om', 'under', 'efter', 'före', 'vid', 'från', 'till', 'sedan', 'varje', 'klockan', 'nästa', 'förra', 'hela', 'en', 'ett', 'någon',
]);

/** Zelfstandige naamwoorden voor tijd (begin van het woord). */
const TIME_NOUN = /^((mån|tis|ons|tors|fre|lör|sön)dag|dag|morgon|morgn|förmiddag|eftermiddag|kväll|natt|nätt|helg|veck|månad|år|sommar|somr|vinter|vintr|vår|höst|jul|påsk|midsommar|nyår|timm|minut|sekund|lunch|middag|frukost|semester|stund|gång|januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|\d)/;

/** Zinsbijwoorden: horen niet bij het onderwerp. */
const SENTENCE_ADVERBS = new Set([
  'inte', 'aldrig', 'alltid', 'ofta', 'också', 'bara', 'redan', 'gärna', 'nog', 'väl', 'ju', 'sällan',
  'kanske', 'verkligen', 'ibland', 'fortfarande', 'heller', 'ens', 'just', 'nästan',
]);

/** Voegwoorden: bij een samengestelde zin verschuift de betekenis, dus dan niets doen. */
const CONJUNCTIONS = new Set([
  'att', 'som', 'när', 'om', 'eftersom', 'därför', 'men', 'och', 'eller', 'för', 'så', 'innan', 'medan', 'fast', 'tills', 'utan', 'fastän', 'trots',
]);

const MAX_ADVERBIAL = 4;
const MAX_SUBJECT = 3;

/** Is dit stuk een tijdsbepaling? */
export function isTimeAdverbial(words) {
  if (!words.length || words.length > MAX_ADVERBIAL) return false;
  if (words.length === 1) return TIME_WORDS.has(words[0]);
  return TIME_START.has(words[0]) && words.slice(1).some((w) => TIME_NOUN.test(w));
}

const plainSubject = (words) => words.length > 0 && words.every((w) => !SENTENCE_ADVERBS.has(w) && !CONJUNCTIONS.has(w));
const simpleRest = (words) => words.every((w) => !CONJUNCTIONS.has(w));

/**
 * Andere goede woordvolgordes van één genormaliseerd antwoord.
 *   vooraan → achteraan:  A V S R  →  S V R A
 *   achteraan → vooraan:  S V R A  →  A V S R
 */
export function movedAdverbials(answer) {
  const w = answer.split(' ').filter(Boolean);
  const out = new Set();
  if (w.length < 3) return [];
  for (let a = 1; a <= MAX_ADVERBIAL; a++) {
    for (let s = 1; s <= MAX_SUBJECT; s++) {
      // Vooraan → achteraan
      if (a + 1 + s <= w.length) {
        const A = w.slice(0, a);
        const V = w[a];
        const S = w.slice(a + 1, a + 1 + s);
        const R = w.slice(a + 1 + s);
        if (isTimeAdverbial(A) && plainSubject(S) && simpleRest(R) && !CONJUNCTIONS.has(V)) {
          out.add([...S, V, ...R, ...A].join(' '));
        }
      }
      // Achteraan → vooraan
      if (s + 1 + a <= w.length) {
        const S = w.slice(0, s);
        const V = w[s];
        const R = w.slice(s + 1, w.length - a);
        const A = w.slice(w.length - a);
        if (isTimeAdverbial(A) && plainSubject(S) && simpleRest(R) && !CONJUNCTIONS.has(V)) {
          out.add([...A, V, ...S, ...R].join(' '));
        }
      }
    }
  }
  out.delete(answer);
  return [...out];
}
