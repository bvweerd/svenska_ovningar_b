// Register van renderers per vraagtype. Elke renderer geeft terug:
//   { el, check() → resultaat, reveal(), lock() }
// Een resultaat met { correct: true, advance: true } betekent: volgende fase van dezelfde vraag.
// De pure kant van elk type (controle, antwoordhash, nakijkhulp) staat in core/items/.
import { h, isTouch } from '../dom.js';
import { isGradable } from '../../core/items/index.js';
import { mc, multi, sort, truefalse } from './choice.js';
import { gap, translate, transform, table, free, findError } from './text.js';
import { listen } from './listen.js';
import { clock } from './clock.js';
import { order } from './order.js';
import { match, dialogue } from './tap.js';

// ---------- Samengestelde vraag ----------
// Per stap wordt bijgehouden hoeveel ervan bij de eerste poging goed was (1 = in één keer goed, een
// deel bij een stap met meer vakjes, 0 bij hulp of een bekeken antwoord). share() geeft het gemiddelde:
// zo telt een taak met vier van de vijf stappen in één keer goed als 0,8 in de score (issue #32).
// Een vrije schrijfstap (geleid schrijven) kijkt de app niet na: die telt niet mee.
function steps(item, ctx) {
  const box = h('div', { class: 'steps' });
  const rendered = [];
  const scores = []; // per stap: undefined zolang de stap loopt zonder fout, anders het deel dat goed was
  let current = 0;
  const addStep = (i) => {
    const r = RENDERERS[item.steps[i].type](item.steps[i], ctx);
    rendered[i] = r;
    const step = h('div', { class: 'step' }, h('span', { class: 'step-no' }, `Stap ${i + 1}`), r.el);
    box.append(step);
    // Niet scrollen en op een telefoon geen toetsenbord openen; de stap komt rustig in beeld.
    const first = r.el.querySelector('input, select, textarea, button');
    const touch = isTouch();
    if (first && !(touch && first.matches('input[type="text"], textarea'))) first.focus({ preventScroll: true });
    if (i > 0) requestAnimationFrame(() => step.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  };
  // Na de laatste stap: alles op slot. Anders de volgende stap erbij.
  const next = () => {
    rendered[current].lock();
    if (current >= item.steps.length - 1) return false;
    current++;
    addStep(current);
    return true;
  };
  addStep(0);
  return {
    el: box,
    check() {
      const r = rendered[current];
      const res = r.check();
      if (res.correct && res.advance) return res;
      if (res.correct) {
        scores[current] ??= 1;
        if (current < item.steps.length - 1) {
          next();
          return { correct: true, advance: true, newStep: true };
        }
        return res;
      }
      // Fout (niet: leeg of „probeer opnieuw”): het deel dat bij de eerste poging goed was.
      if (!res.empty && !res.retry && !res.neutral) scores[current] ??= res.share ?? 0;
      return res;
    },
    // Alleen de huidige stap tonen en dan door naar de volgende: de rest doet de leerling zelf.
    // → true als er nog een stap komt, false als dit de laatste was.
    revealStep() {
      rendered[current].reveal();
      scores[current] = 0;
      return next();
    },
    // De stap die nu loopt (voor de regel bij een fout en de knop Controleer).
    currentStep: () => item.steps[current],
    // Hint of hulp bij de huidige stap: die stap telt niet als in één keer goed.
    noteHelp() {
      scores[current] ??= 0;
    },
    share() {
      const graded = item.steps.map((s, i) => i).filter((i) => isGradable(item.steps[i]));
      return graded.length ? graded.reduce((sum, i) => sum + (scores[i] ?? 0), 0) / graded.length : undefined;
    },
    // Hele antwoord tonen (toets): ook de stappen die nog komen.
    reveal() {
      rendered[current].reveal();
      rendered[current].lock();
      scores[current] = 0;
      for (let i = current + 1; i < item.steps.length; i++) {
        addStep(i);
        rendered[i].reveal();
        rendered[i].lock();
      }
      current = item.steps.length - 1;
    },
    lock() {
      rendered.forEach((r) => r.lock());
    },
  };
}

export const RENDERERS = { mc, multi, gap, translate, transform, listen, sort, clock, order, dialogue, match, table, truefalse, free, steps, findError };
