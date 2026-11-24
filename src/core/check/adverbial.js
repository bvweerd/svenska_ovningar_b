// Een tijdsbepaling mag in het Zweeds vooraan (met inversie) of achteraan staan:
//   „På kvällen tittar Bram på tv.” = „Bram tittar på tv på kvällen.”
// Deze module maakt bij een goed antwoord de andere volgorde, zodat de nakijker die ook goedkeurt.
// Bewust voorzichtig: alleen bij één enkelvoudige hoofdzin (zonder komma, voegwoord of bijzin), alleen
// tussen plaats 1 (met inversie) en het eind van die hoofdzin, met een herkenbaar onderwerp, en nooit als
// daardoor een zinsbijwoord als „inte” vóór het werkwoord belandt (een typische fout die de site afkeurt).
// Werkt op een antwoord met leestekens (komma's tellen als zinsgrens) of op genormaliseerde tekst.
import { normalize } from './normalize.js';

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
const TIME_NOUN = /^((mån|tis|ons|tors|fre|lör|sön)dag|dag|morgon|morgn|förmiddag|eftermiddag|kväll|natt|nätt|helg(?!dag)|veck|månad|år|sommar|somr|vinter|vintr|vår|höst|jul|påsk|midsommar|nyår|timm|minut|sekund|lunch|middag|frukost|semester|stund|gång|januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|\d)/;

/** Getallen na „klockan” („klockan sex”, „klockan halv sju”). */
const CLOCK_NUMBERS = new Set(['ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv']);
/** Telwoorden binnen een tijdsbepaling („i trettio år”). */
const NUMBER = /^(\d+|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv|tretton|fjorton|femton|sexton|sjutton|arton|nitton|tjugo|trettio|fyrtio|femtio|sextio|sjuttio|åttio|nittio|hundra)$/;
const CLOCK_PARTS = new Set(['halv', 'kvart', 'över', 'nästan', 'ungefär', 'cirka']);

/** Zinsbijwoorden: horen niet bij het onderwerp. */
const SENTENCE_ADVERBS = new Set([
  'inte', 'aldrig', 'alltid', 'ofta', 'också', 'bara', 'redan', 'gärna', 'nog', 'väl', 'ju', 'sällan',
  'kanske', 'verkligen', 'ibland', 'fortfarande', 'heller', 'ens', 'just', 'nästan',
]);

/**
 * Voegwoorden en andere woorden die een bijzin of tweede zin beginnen (ook „trots att”, „så att”, „för att”
 * via att). Bij een samengestelde zin kan de tijdsbepaling bij de bijzin horen, dus dan niets doen.
 */
const CONJUNCTIONS = new Set([
  'att', 'som', 'när', 'om', 'eftersom', 'därför', 'men', 'och', 'eller', 'för', 'så', 'innan', 'medan', 'fast', 'tills', 'utan', 'fastän', 'trots',
  'där', 'dit', 'varifrån', 'vars', 'vilken', 'vilket', 'vilka', 'hur', 'vad', 'vem', 'vems', 'varför', 'ifall', 'huruvida', 'sedan', 'än', 'samt',
]);

/** Vraagwoorden die geen voegwoord zijn, als onderwerp uitgesloten (var = waar, maar ook „was”: als werkwoord wel goed). */
const QUESTION_WORDS = new Set(['var', 'vart', 'varifrån']);

/** Persoonlijke voornaamwoorden die alleen onderwerp zijn. */
const SUBJECT_PRONOUNS = new Set(['jag', 'du', 'han', 'hon', 'vi', 'ni', 'man']);

/** Werkwoorden waarna vaak een bijzin zonder att volgt („Jag tror Olle kommer imorgon”). */
const SAY_THINK = new Set([
  'tror', 'trodde', 'tycker', 'tyckte', 'vet', 'visste', 'säger', 'sa', 'hoppas', 'hoppades', 'menar', 'antar', 'undrar', 'märker', 'hörde', 'hör', 'lovar', 'lovade',
]);

/** Voorzetsels: daarmee begint geen onderwerp. */
const PREPOSITIONS = new Set([
  'på', 'i', 'om', 'under', 'efter', 'före', 'vid', 'från', 'till', 'av', 'med', 'hos', 'för', 'mot', 'över', 'genom',
  'bakom', 'framför', 'mellan', 'inom', 'utanför', 'runt', 'utan', 'sedan', 'klockan',
]);

/** Woorden die alleen met een zelfstandig naamwoord erachter onderwerp zijn („min bror”, niet „min”). */
const NEEDS_NOUN = new Set([
  'en', 'ett', 'min', 'mitt', 'mina', 'din', 'ditt', 'dina', 'sin', 'sitt', 'sina', 'hans', 'hennes', 'dess', 'deras',
  'vår', 'vårt', 'våra', 'er', 'ert', 'era', 'denna', 'detta', 'dessa', 'varje', 'hela', 'samma',
]);

/** Woorden waarmee een onderwerp van meer woorden begint („de flesta robotar”, „två barn”). */
const DETERMINERS = new Set([
  ...NEEDS_NOUN, 'den', 'det', 'de', 'alla', 'många', 'några', 'någon', 'något', 'ingen', 'inget', 'inga', 'vissa', 'båda',
  'flera', 'andra', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio',
]);

const MAX_ADVERBIAL = 4;
const MAX_SUBJECT = 7; // twee woordgroepen van hoogstens 3 woorden met „och”

/**
 * Woorden binnen een tijdsbepaling: tijdwoorden, getallen, lidwoorden, voorzetsels en bijvoeglijke vormen
 * („om tio år”, „under de senaste åren”, „klockan sex på måndag”), geen plaats als „till skolan förra veckan”.
 */
const timeInner = (w) => !CONJUNCTIONS.has(w) && !TIME_WORDS.has(w) && w !== 'inte' && w !== 'aldrig' && (
  TIME_NOUN.test(w) || NUMBER.test(w) || TIME_START.has(w) || DETERMINERS.has(w) || CLOCK_PARTS.has(w) || /[ae]$/.test(w));

/** Is dit stuk een tijdsbepaling? */
export function isTimeAdverbial(words) {
  if (!words.length || words.length > MAX_ADVERBIAL) return false;
  if (words.length === 1) return TIME_WORDS.has(words[0]);
  // Het tijdwoord sluit de tijdsbepaling af („varje kväll”, „om tio år”), anders slokt hij werkwoord en
  // onderwerp mee op („varje kväll tittar Bram”).
  const inner = words.slice(1, -1);
  const last = words.at(-1);
  const timeEnd = TIME_NOUN.test(last) || (words.includes('klockan') && CLOCK_NUMBERS.has(last));
  // „på middag” (uitgenodigd voor het eten) is geen tijd; „efter middagen” wel.
  if (/^(lunch|middag|frukost)/.test(last) && !['efter', 'före', 'vid', 'under'].includes(words[0])) return false;
  // „till 1177” is een telefoonnummer, geen tijd.
  if (words[0] === 'till' && /^\d+$/.test(last)) return false;
  return TIME_START.has(words[0]) && timeEnd
    && inner.every(timeInner);
}

const plainWord = (w) => !SENTENCE_ADVERBS.has(w) && !CONJUNCTIONS.has(w);

/**
 * Kern na een genitief („Olles fru”, „Brams nya jobb”). Een genitief is niet te onderscheiden van een naam op
 * -s („Nils spelar fotboll”), dus alleen bij deze woorden; ze zijn nooit het werkwoord.
 */
const GENITIVE_HEADS = new Set([
  'fru', 'man', 'mamma', 'pappa', 'son', 'söner', 'dotter', 'döttrar', 'syster', 'systrar', 'bror', 'bröder', 'barn', 'föräldrar',
  'mormor', 'morfar', 'farmor', 'farfar', 'moster', 'faster', 'morbror', 'farbror', 'kusin', 'kusiner', 'vän', 'vänner',
  'flickvän', 'pojkvän', 'sambo', 'familj', 'familjen', 'hund', 'katt', 'kollega', 'kollegor', 'chef', 'granne', 'grannar',
  'lärare', 'jobb', 'bil', 'hus', 'lägenhet',
]);

/** Genitief van een naam of zelfstandig naamwoord: „Olles”, „Brams”, „mammas” (niet hans/hennes: die staan bij DETERMINERS). */
const genitive = (w) => w.length > 2 && w.endsWith('s') && !DETERMINERS.has(w) && !SUBJECT_PRONOUNS.has(w);

/**
 * Eén woordgroep als onderwerp: één woord (jag, Bram, det), lidwoord/bezittelijk voornaamwoord of genitief
 * + zelfstandig naamwoord, eventueel met één bijvoeglijk naamwoord ertussen („min gamla bil”, „Olles fru”,
 * „den här boken”). Zo wordt „robotar vara” of „min bror tidningen” geen onderwerp.
 */
function nounPhrase(words) {
  if (!words.length || words.length > 3 || !words.every(plainWord)) return false;
  if (words.some((w) => TIME_WORDS.has(w) || PREPOSITIONS.has(w) || QUESTION_WORDS.has(w))) return false;
  const [first, second, third] = words;
  const pronoun = ['den', 'det', 'de'].includes(first);
  const standalone = pronoun || first === 'alla' || first === 'ingen';
  // Eén woord: geen lidwoord of telwoord („många tittar svenskar …”), wel den/det/de, alla, ingen.
  if (words.length === 1) return (standalone || !DETERMINERS.has(first)) && !CLOCK_NUMBERS.has(first) && !CLOCK_PARTS.has(first);
  if (words.slice(1).some((w) => DETERMINERS.has(w) || (SUBJECT_PRONOUNS.has(w) && w !== 'man'))) return false;
  const adjective = /[ae]$/.test(second);
  // Genitief: „Olles fru”, „Brams nya jobb” (niet „Nils fotboll”).
  if (genitive(first)) return GENITIVE_HEADS.has(words.at(-1)) && (words.length === 2 || adjective);
  if (!DETERMINERS.has(first)) return false;
  // den/det/de + naamwoord alleen als „de flesta …”, „den här …” of met bijvoeglijk naamwoord + bepaalde vorm
  // („de gamla möblerna”); niet „de middag” of „det ska bli”.
  if (pronoun) {
    return words.length === 3 && (['flesta', 'här', 'där'].includes(second) || (adjective && /(en|et|na)$/.test(third)));
  }
  return words.length === 2 || adjective;
}

/**
 * Is dit een herkenbaar onderwerp? Eén woordgroep, of twee verbonden met „och”:
 * „Fleur och Bram”, „Erik och jag”, „Bram och hans fru”, „min syster och hennes man”.
 * Een los woord naast „och” moet een voornaamwoord of een naam (hoofdletter) zijn, zodat
 * „Jag duschar och äter frukost” geen onderwerp „jag och äter” oplevert. names: woorden met hoofdletter.
 */
function plainSubject(words, names = new Set()) {
  const i = words.indexOf('och');
  if (i === -1) return nounPhrase(words);
  const conjunct = (part) => nounPhrase(part) && (part.length > 1 || SUBJECT_PRONOUNS.has(part[0]) || part[0] === 'de' || names.has(part[0]));
  return i > 0 && !words.includes('och', i + 1) && conjunct(words.slice(0, i)) && conjunct(words.slice(i + 1));
}

/** Kan dit het vervoegde werkwoord op plaats 2 zijn? (We kennen de werkwoorden niet; sluit het onmogelijke uit.) */
const plainVerb = (w) => plainWord(w) && !DETERMINERS.has(w) && !TIME_WORDS.has(w) && !TIME_START.has(w)
  && !CLOCK_NUMBERS.has(w) && !CLOCK_PARTS.has(w) && !PREPOSITIONS.has(w) && !GENITIVE_HEADS.has(w) && w !== 'här' && w !== 'där';

/**
 * Geen bijzin in de rest. „kommer att + infinitief” is wel goed: daar is att geen voegwoord.
 * De rest eindigt niet op een voorzetsel of lidwoord: dan hoorde de tijdsbepaling bij een groter zinsdeel
 * („bott här i nästan ett år”, „feber sen igår”, „strax efter klockan sex”).
 */
function simpleRest(words, verb, adverbial) {
  // „(från) måndag till torsdag” hoort bij elkaar.
  if (adverbial[0] === 'till' && (words.includes('från') || TIME_NOUN.test(words.at(-1) ?? ''))) return false;
  const last = words.at(-1);
  if (last && (PREPOSITIONS.has(last) || (NEEDS_NOUN.has(last) && last !== 'ett') || CLOCK_PARTS.has(last) || ['sen', 'strax', 'redan'].includes(last))) return false;
  // Een onderwerpsvorm in de rest is een tweede zin zonder att: „Jag tror [att] Olle kommer imorgon”.
  // („hennes man” is geen voornaamwoord.)
  const pronounAt = (w, i) => SUBJECT_PRONOUNS.has(w) && !(w === 'man' && i > 0 && (DETERMINERS.has(words[i - 1]) || genitive(words[i - 1])));
  if (words.some(pronounAt) || [verb, ...words].some((w) => SAY_THINK.has(w))) return false;
  // „dit”/„där” als laatste woord is een plaatsbepaling („Vi åker dit imorgon”), geen bijzin.
  const adverbAt = (w, i) => (w === 'dit' || w === 'där') && i === words.length - 1;
  return words.every((w, i) => !CONJUNCTIONS.has(w) || adverbAt(w, i) || (i === 0 && w === 'att' && verb === 'kommer'));
}

/**
 * Komma, puntkomma of dubbele punt binnen de zin: meer dan één zin of een bijzin. Een vraag
 * („Jobbar Fleur hemma idag?”, „Var bor ni nu?”) heeft geen onderwerp vooraan: ook niets doen.
 */
const hasClauseBreak = (text) => /[,;:]/.test(text.replace(/[\s.!?;:,]+$/u, '')) || text.includes('?');

/**
 * Andere goede woordvolgordes van één antwoord, met de richting:
 *   vooraan → achteraan:  A V S R  →  S V R A   (fronted: false)
 *   achteraan → vooraan:  S V R A  →  A V S R   (fronted: true)
 * Het antwoord mag leestekens bevatten (een komma binnen de zin = geen verplaatsing). opts: zie normalize.
 */
// Bijwoorden van wijze of plaats die gewoonlijk vóór de tijd staan („lagar middag tillsammans på kvällen”).
// Zet de leerling de tijd ervóór („på kvällen tillsammans”), dan is dat minder gangbaar: geen fout, wel een
// tip met de gewone volgorde (mid: true; zie gradeText). Niet bij „också”: daar verandert de betekenis.
const FINAL = new Set(['tillsammans', 'hemma', 'ute', 'inne', 'själv', 'själva', 'ensam', 'igen']);
const beforeFinal = (R, A) => (R.length >= 2 && FINAL.has(R.at(-1)) ? [...R.slice(0, -1), ...A, R.at(-1)] : null);

export function movedAdverbialOrders(answer, opts) {
  if (hasClauseBreak(String(answer ?? ''))) return [];
  const n = normalize(answer, opts);
  const w = n.split(' ').filter(Boolean);
  // Woorden met een hoofdletter in het antwoord (namen; het eerste woord van de zin telt ook mee).
  const names = new Set(String(answer).split(/\s+/).filter((t) => /^\p{Lu}/u.test(t)).map((t) => normalize(t)));
  const out = new Map();
  if (w.length < 3) return [];
  const add = (words, fronted, mid = null) => {
    const text = words.join(' ');
    if (text !== n && !out.has(text)) out.set(text, { text, fronted, ...(mid && { mid: true, ...mid }) });
  };
  for (let a = 1; a <= MAX_ADVERBIAL; a++) {
    for (let s = 1; s <= MAX_SUBJECT; s++) {
      // Vooraan → achteraan
      if (a + 1 + s <= w.length) {
        const A = w.slice(0, a);
        const V = w[a];
        const S = w.slice(a + 1, a + 1 + s);
        const R = w.slice(a + 1 + s);
        // „Idag kommer Olles fru”: het onderwerp is niet alleen „Olles”.
        const cutGenitive = genitive(S.at(-1)) && GENITIVE_HEADS.has(R[0]);
        if (isTimeAdverbial(A) && plainVerb(V) && plainSubject(S, names) && !cutGenitive && simpleRest(R, V, A)) {
          add([...S, V, ...R, ...A], false);
          const mid = beforeFinal(R, A);
          if (mid) add([...S, V, ...mid], false, { final: R.at(-1), time: A.join(' ') });
        }
      }
      // Achteraan → vooraan
      if (s + 1 + a <= w.length) {
        const S = w.slice(0, s);
        const V = w[s];
        const R = w.slice(s + 1, w.length - a);
        const A = w.slice(w.length - a);
        if (isTimeAdverbial(A) && plainVerb(V) && plainSubject(S, names) && simpleRest(R, V, A)) {
          add([...A, V, ...S, ...R], true);
          const mid = beforeFinal(R, A);
          if (mid) add([...S, V, ...mid], false, { final: R.at(-1), time: A.join(' ') });
        }
      }
    }
  }
  return [...out.values()];
}

/** Alleen de andere volgordes (genormaliseerde tekst). */
export function movedAdverbials(answer, opts) {
  return movedAdverbialOrders(answer, opts).map((m) => m.text);
}
