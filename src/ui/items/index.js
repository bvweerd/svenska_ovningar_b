// Register van renderers per vraagtype. Elke renderer geeft terug:
//   { el, check() → resultaat, reveal(), lock() }
// Een resultaat met { correct: true, advance: true } betekent: volgende fase van dezelfde vraag.
// De pure kant van elk type (controle, antwoordhash, nakijkhulp) staat in core/items/.
import { h, isTouch } from '../dom.js';
import { mc, multi, sort, truefalse } from './choice.js';
import { gap, translate, transform, table, free, findError } from './text.js';
import { listen } from './listen.js';
import { clock } from './clock.js';
import { order } from './order.js';
import { match, dialogue } from './tap.js';

// ---------- Samengestelde vraag ----------
function steps(item, ctx) {
  const box = h('div', { class: 'steps' });
  const rendered = [];
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
  addStep(0);
  return {
    el: box,
    check() {
      const r = rendered[current];
      const res = r.check();
      if (res.correct && res.advance) return res;
      if (res.correct && current < item.steps.length - 1) {
        r.lock();
        current++;
        addStep(current);
        return { correct: true, advance: true };
      }
      return res;
    },
    reveal() {
      rendered[current].reveal();
      rendered[current].lock();
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
