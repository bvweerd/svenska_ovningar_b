// Register van vraagtypen: alles wat de app over een type weet zonder scherm. Een nieuw type krijgt
// hier een definitie (en in ui/items/index.js een renderer); validatie, antwoordhash, voorlezen,
// het moeilijkheidsrapport en de vraagkaart lezen het register in plaats van een eigen switch.
//
// Een definitie: {
//   type, name             naam in het Nederlands (in het overzicht van een hoofdstuk)
//   validate(item, err, recurse)   foutmeldingen via err(tekst); recurse(deelvraag, label) voor stappen
//   answerPart(item, recurse)      wat bepaalt wat goed is (antwoordhash); standaard [type, answers]
//   spoken(item, recurse)          de goede Zweedse zin om voor te lezen, of null
//   selfChecking(item, recurse)    kijkt zichzelf na zodra je kiest (geen knop Controleer nodig)
//   produce                        telt als „zelf maken” (moeilijkheidsrapport)
//   answerSentence                 lengte van het eerste goede antwoord telt als antwoordzin
//   gradable                       false: de app kijkt het niet na (vrij schrijven)
// }
// Nakijken zelf staat in core/check/grade.js; de renderers roepen dat aan.
import * as choice from './choice.js';
import * as text from './text.js';
import * as other from './other.js';

const steps = {
  type: 'steps',
  name: 'in stappen',
  selfChecking: (item, recurse) => recurse(item.steps?.[0] ?? {}),
  validate(item, err, recurse) {
    if (!item.steps?.length || item.steps.length < 2) err('steps heeft minstens 2 stappen nodig');
    item.steps?.forEach((s, i) => recurse(s, `stap ${i + 1}`));
  },
  answerPart: (item, recurse) => ['steps', (item.steps ?? []).map(recurse)],
  spoken: (item, recurse) => [...item.steps].reverse().map(recurse).find(Boolean) ?? null,
};

export const ITEM_TYPES = Object.freeze(Object.fromEntries(
  [...Object.values(choice), ...Object.values(text), ...Object.values(other), steps].map((t) => [t.type, t]),
));

export const itemType = (type) => ITEM_TYPES[type] ?? null;
export const isKnownType = (type) => Object.hasOwn(ITEM_TYPES, type);

/** Het deel van een vraag dat bepaalt wat goed is (voor de antwoordhash). */
export function answerPart(item) {
  if (!item || typeof item !== 'object') return item ?? null;
  const t = itemType(item.type);
  return t?.answerPart ? t.answerPart(item, answerPart) : [item.type, item.answers ?? null];
}

/** De goede Zweedse zin bij een vraag, of null als er niets zinnigs voor te lezen is. */
export function spokenText(item) {
  if (!item) return null;
  if (item.say) return item.say;
  return itemType(item.type)?.spoken?.(item, spokenText) ?? null;
}

/** Kijkt de vraag zichzelf na zodra je kiest? (Enter blijft werken.) */
export function selfChecking(item) {
  return !!itemType(item?.type)?.selfChecking?.(item, selfChecking);
}

/** Kijkt de app deze vraag na? (Niet bij vrij schrijven.) */
export const isGradable = (item) => itemType(item?.type)?.gradable !== false;

/** Telt als „zelf maken” in het moeilijkheidsrapport. */
export const isProduce = (item) => !!itemType(item?.type)?.produce;

/** Telt de lengte van het eerste goede antwoord als antwoordzin? */
export const hasAnswerSentence = (item) => !!itemType(item?.type)?.answerSentence;

/** Nederlandse naam van een type. */
export const typeName = (type) => itemType(type)?.name ?? type;
