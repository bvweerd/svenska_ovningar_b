// Zinsbouw met woordtegels.
import { h } from '../dom.js';
import { displayAnswer } from '../../core/check/normalize.js';
import { shuffle } from '../../core/content/build.js';
import { gradeOrder } from '../../core/check/grade.js';
import { tileBoard } from './tiles.js';
import { prompt } from './fields.js';

// ---------- Zinsbouw ----------
/** De tegels in de volgorde van het eerste goede antwoord (voor het meten van de zinsregel). */
function orderedTokens(item) {
  const answer = ` ${String(item.answers?.[0] ?? '').toLowerCase()}`;
  const at = (t) => answer.indexOf(` ${t.toLowerCase()}`) >>> 0;
  return [...item.tokens].sort((a, b) => at(a) - at(b));
}

export function order(item, ctx) {
  const board = tileBoard({
    tiles: shuffle(item.tokens.map((t, i) => ({ t, i }))),
    start: item.start,
    label: 'Jouw zin',
    placeholder: 'Tik de woorden aan in de goede volgorde.',
    needed: item.tokens.length,
    sample: orderedTokens(item),
    onComplete: () => ctx.ready?.(),
  });
  const el = h('div', {}, prompt(item.prompt), board.el);
  return {
    el,
    check() {
      const res = gradeOrder(board.tokens(), item, ctx);
      board.mark(res.empty ? undefined : res.correct);
      return res;
    },
    reveal() {
      board.reveal(displayAnswer(item.answers));
    },
    lock: () => board.lock(),
  };
}
