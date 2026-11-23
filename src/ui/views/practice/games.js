// Snelle rondes.
import { h, fill } from '../../dom.js';
import { verbs } from '../../../app/content.js';
import { crumbs } from '../../shared.js';
import { shuffle } from '../../../core/content/build.js';
import { saveGame, getGame } from '../../../app/progress.js';
import { pretOptions } from '../../../core/verbs.js';
import { trackEvent } from '../../../platform/analytics.js';
import { available } from './common.js';

const GAME_SECONDS = 60;

function vocabPool() {
  const seen = new Set();
  return available().flatMap((c) => c.vocab ?? []).filter((v) => !seen.has(v.sv) && seen.add(v.sv));
}

export const GAMES = {
  'en-ett': {
    title: 'En of ett?',
    intro: 'Kies het lidwoord bij het zelfstandig naamwoord.',
    make() {
      const nouns = vocabPool().filter((v) => /^(en|ett) /.test(v.sv));
      if (!nouns.length) return null;
      const v = nouns[Math.floor(Math.random() * nouns.length)];
      const isEtt = v.sv.startsWith('ett ');
      return { prompt: v.sv.replace(/^(en|ett) /, ''), sub: v.nl, options: ['en', 'ett'], answer: isEtt ? 1 : 0, solution: v.sv };
    },
  },
  betekenis: {
    title: 'Wat betekent het?',
    intro: 'Kies de juiste Nederlandse vertaling.',
    make() {
      const pool = vocabPool();
      if (pool.length < 2) return null;
      const v = pool[Math.floor(Math.random() * pool.length)];
      // Foute keuzes van dezelfde soort (met lidwoord bij een zelfstandig naamwoord), zodat het lidwoord niets verraadt.
      const kind = (x) => (/^(en|ett) /.test(x.sv) ? 'noun' : x.sv.startsWith('att ') ? 'verb' : 'other');
      const rest = shuffle(pool.filter((o) => o.nl !== v.nl));
      const others = [...rest.filter((o) => kind(o) === kind(v)), ...rest.filter((o) => kind(o) !== kind(v))].slice(0, 3).map((o) => o.nl);
      const options = shuffle([v.nl, ...others]);
      return { prompt: v.sv, options, answer: options.indexOf(v.nl), solution: `${v.sv} = ${v.nl}` };
    },
  },
  preteritum: {
    title: 'Verleden tijd',
    intro: 'Kies de juiste preteritum.',
    make() {
      // Partikelwerkwoorden niet: daar zijn de fouten dezelfde als bij het werkwoord zelf.
      const pool = verbs.filter((v) => v.kind !== 'partikel');
      if (!pool.length) return null;
      const verb = pool[Math.floor(Math.random() * pool.length)];
      const { correct, options } = pretOptions(verb);
      const opts = shuffle(options);
      return { prompt: verb.inf, sub: verb.nl, options: opts, answer: opts.indexOf(correct), solution: `${verb.inf} – ${correct}` };
    },
  },
};

export function viewGames() {
  document.title = 'Snelle rondes · Svenska övningar';
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Snelle rondes' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Snelle rondes'),
      h('p', { class: 'instruction' }, `Zoveel mogelijk goede antwoorden in ${GAME_SECONDS} seconden. Antwoorden kan met de cijfertoetsen.`)),
    h('div', { class: 'tools' }, Object.entries(GAMES).map(([id, g]) => {
      const best = getGame(id)?.best;
      return h('a', { class: 'tool-card', href: `#/oefenen/spel/${id}` },
        h('span', { class: 'tool-title' }, g.title),
        h('span', { class: 'tool-text' }, g.intro),
        best ? h('span', { class: 'tool-text' }, `Record: ${best}`) : null);
    })),
  );
}

export function viewGame(id, { signal } = {}) {
  const game = GAMES[id];
  document.title = `${game.title} · Snelle rondes`;
  const stage = h('div', { class: 'game' });
  let score;
  let mistakes;
  let q;
  let endAt;
  let timer;
  let pending; // de ingeplande volgende vraag na een antwoord
  let restartAfter = 0;
  let locked;
  const recent = [];

  const timebar = h('div', { class: 'timebar' }, h('span', {}));
  const status = h('div', { class: 'game-status' });

  const intro = () => {
    const best = getGame(id)?.best;
    fill(stage, 
      h('p', { class: 'lead' }, game.intro),
      h('p', { class: 'muted' }, best ? `Je record: ${best}` : 'Nog geen record.'),
      h('button', { type: 'button', class: 'btn primary big', onclick: start }, 'Start', h('span', { class: 'kbd-only' }, ' (Enter)')),
    );
    setTimeout(() => stage.querySelector('button')?.focus(), 0);
  };

  const nextQuestion = () => {
    if (Date.now() >= endAt) return; // tijd is op: de uitslag blijft staan
    let tries = 0;
    do q = game.make();
    while (q && recent.includes(q.prompt) && tries++ < 10);
    if (!q) {
      fill(stage, h('p', {}, 'Voor dit spel is er nog te weinig oefenstof.'));
      clearInterval(timer);
      return;
    }
    recent.push(q.prompt);
    if (recent.length > 8) recent.shift();
    locked = false;
    const buttons = q.options.map((o, i) => h('button', { type: 'button', class: 'game-option', onclick: () => answer(i) }, h('kbd', {}, String(i + 1)), h('span', { lang: id === 'betekenis' ? 'nl' : 'sv' }, o)));
    fill(stage, 
      timebar, status,
      h('div', { class: 'game-prompt', lang: 'sv' }, q.prompt, q.sub ? h('span', { class: 'game-sub', lang: 'nl' }, q.sub) : null),
      h('div', { class: `game-options n${q.options.length}` }, buttons),
    );
    updateStatus();
  };

  const updateStatus = () => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    status.textContent = `Score: ${score} · nog ${left} s`;
    timebar.firstChild.style.width = `${Math.max(0, ((endAt - Date.now()) / (GAME_SECONDS * 1000)) * 100)}%`;
  };

  const answer = (i) => {
    if (locked || !q) return;
    locked = true;
    const buttons = stage.querySelectorAll('.game-option');
    if (i === q.answer) {
      score++;
      buttons[i].classList.add('ok');
      pending = setTimeout(nextQuestion, 180);
    } else {
      mistakes.push(q.solution);
      buttons[i].classList.add('bad');
      buttons[q.answer].classList.add('ok');
      pending = setTimeout(nextQuestion, 900);
    }
    updateStatus();
  };

  const finish = () => {
    clearInterval(timer);
    clearTimeout(pending);
    q = null;
    const record = saveGame(id, score);
    trackEvent(`spel/${id}/klaar`, `${game.title} · score ${score}`);
    fill(stage, 
      h('h2', {}, `Tijd! Je score: ${score}`),
      h('p', {}, record && score > 0 ? 'Nieuw record!' : `Je record: ${getGame(id)?.best ?? score}`),
      mistakes.length ? h('div', {}, h('p', {}, 'Deze had je fout:'), h('ul', { class: 'mistakes', lang: 'sv' }, [...new Set(mistakes)].map((m) => h('li', {}, m)))) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Nog een keer', h('span', { class: 'kbd-only' }, ' (Enter)')),
        h('a', { class: 'btn ghost', href: '#/oefenen/spel' }, 'Andere rondes')),
    );
    // Even geen nieuwe ronde: een tik of toets die nog voor de laatste vraag bedoeld was, start hem niet.
    restartAfter = Date.now() + 1000;
    const again = stage.querySelector('.btn.primary');
    again.disabled = true;
    setTimeout(() => { again.disabled = false; again.focus(); }, 1000);
  };

  function start() {
    score = 0;
    mistakes = [];
    endAt = Date.now() + GAME_SECONDS * 1000;
    clearInterval(timer);
    timer = setInterval(() => {
      if (Date.now() >= endAt) finish();
      else updateStatus();
    }, 100);
    nextQuestion();
  }

  const view = h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Snelle rondes', href: '#/oefenen/spel' }, { label: game.title }),
    h('header', { class: 'page-head' }, h('h1', {}, game.title)),
    stage,
  );
  // Pagina verlaten: klok en ingeplande volgende vraag stoppen (één luisteraar, ook na „Nog een keer”).
  signal?.addEventListener('abort', () => { clearInterval(timer); clearTimeout(pending); }, { once: true });
  document.addEventListener('keydown', (e) => {
    if (!q && e.key === 'Enter' && Date.now() >= restartAfter && !e.target.matches('a, button, input, textarea, select')) {
      e.preventDefault();
      start();
      return;
    }
    if (q && /^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < q.options.length) {
        e.preventDefault();
        answer(i);
      }
    }
  }, { signal });
  intro();
  return view;
}
