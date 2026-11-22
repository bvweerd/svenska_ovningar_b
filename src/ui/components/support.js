// Steun via Ko-fi.
import { h } from '../dom.js';
import { course } from '../../app/content.js';
import { trackEvent } from '../../platform/analytics.js';
import { getPref, setPref } from '../../app/progress.js';
import { chapterDone } from '../../app/course-progress.js';

export const KOFI_URL = 'https://ko-fi.com/bvweerd';

/**
 * Vraag om steun, onder de uitslag van de oefening waarmee een hoofdstuk af is: de eerste keer vanaf
 * 3 afgeronde hoofdstukken, nog één keer vanaf 10 als de vraag toen is overgeslagen. Na „Nee, dank je”
 * of een klik op Ko-fi nooit meer. Geen venster: een blokje onder de knoppen. Per apparaat (prefs).
 * supportAsked: 0 = nog niet, 1 = één keer getoond, 2 = twee keer, 99 = beantwoord.
 */
export function supportAsk(ch) {
  if (!chapterDone(ch)) return null;
  const asked = getPref('supportAsked', 0);
  const done = course.filter(chapterDone).length;
  if (!((asked === 0 && done >= 3) || (asked === 1 && done >= 10))) return null;
  setPref('supportAsked', asked + 1);
  trackEvent(`steun/getoond/${asked + 1}`, 'Steun: vraag getoond');
  const box = h('div', { class: 'support-ask' });
  const answered = (what) => {
    setPref('supportAsked', 99);
    trackEvent(`steun/${what}`, what === 'kofi' ? 'Steun: naar Ko-fi' : 'Steun: nee, dank je');
  };
  box.append(
    h('p', {}, h('strong', {}, `Al ${done} hoofdstukken af, knap!`), ' Deze site is gratis en zonder reclame. Wil je iets terugdoen? Een kleine bijdrage helpt om de site te onderhouden en uit te breiden.'),
    h('div', { class: 'actions' },
      h('a', { class: 'btn ghost', href: KOFI_URL, target: '_blank', rel: 'noopener', onclick: () => {
        answered('kofi');
        // Pas na de klik vervangen: een link die tijdens de klik uit de pagina verdwijnt, opent niet.
        setTimeout(() => box.replaceChildren(h('p', {}, 'Dank je wel! ❤')), 0);
      } }, 'Steun via Ko-fi ☕'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => {
        answered('nee');
        box.remove();
      } }, 'Nee, dank je')),
  );
  return box;
}
