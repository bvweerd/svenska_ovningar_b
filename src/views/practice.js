// Extra oefenvormen: dagelijkse herhaling, werkwoordtrainer, flitskaarten, toetsen en snelle rondes.
import { h } from '../dom.js';
import { course, verbs, practiceEntries } from '../content.js';
import { crumbs, practiceView, exerciseRunner, findTopic } from '../ui.js';
import { itemCard } from '../render/item-card.js';
import { shuffle } from '../build.js';
import {
  dueItems, srsStats, streak, weakItems, recordItem, saveTest, getTest, saveGame, getGame,
  getPref, setPref, INTERVALS,
} from '../progress.js';
import { TENSES, KINDS, pickVerbItem, pretOptions } from '../verbs.js';
import { trackEvent, scoreBucket } from '../analytics.js';
import { speak, speechSupported } from '../speech.js';

const available = () => course.filter((c) => c.available);
const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

/** Ruimt een toetsenbord-luisteraar op zodra de pagina niet meer getoond wordt. */
function onKeys(root, handler) {
  const listener = (e) => {
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', listener);
      return;
    }
    handler(e);
  };
  document.addEventListener('keydown', listener);
}

export function dueCount() {
  return dueItems(practiceEntries()).length;
}

export function streakText() {
  const s = streak();
  if (!s.days) return 'Oefen vandaag en begin een reeks.';
  const base = `${plural(s.days, 'dag', 'dagen')} op rij geoefend`;
  return s.today ? `${base}. Goed bezig!` : `${base}. Oefen vandaag om je reeks vast te houden.`;
}

// ---------- Overzicht ----------
export function viewPracticeHub() {
  document.title = 'Oefenen · Svenska övningar';
  const entries = practiceEntries();
  const due = dueItems(entries).length;
  const known = srsStats(entries).reduce((a, b) => a + b, 0);
  const weak = available().reduce((n, c) => n + weakItems(c).filter(({ ex }) => !ex.text).length, 0);
  const tool = (href, title, text, badge) =>
    h('a', { class: 'tool-card', href },
      h('span', { class: 'tool-title' }, title, badge ? h('span', { class: 'count' }, String(badge)) : null),
      h('span', { class: 'tool-text' }, text));
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Oefenen'),
      h('p', { class: 'lead' }, 'Herhalen, trainen en spelen, met de stof uit alle hoofdstukken.'),
      h('p', { class: 'streak' }, streakText())),
    h('div', { class: 'tools' },
      tool('#/oefenen/herhaling', 'Dagelijkse herhaling',
        due ? `${plural(due, 'vraag staat', 'vragen staan')} voor vandaag klaar.` : known ? 'Voor vandaag ben je klaar. Morgen staan er weer vragen klaar.' : 'Maak eerst een paar oefeningen: die komen hier vanzelf terug.', due),
      tool('#/herhalen', 'Oefen je fouten', weak ? `${plural(weak, 'vraag', 'vragen')} die je eerder fout had.` : 'Geen openstaande fouten.', weak),
      tool('#/oefenen/werkwoorden', 'Werkwoordtrainer', 'Oefen werkwoordsvormen zo lang je wilt, met de tijden die jij kiest.'),
      tool('#/oefenen/spel', 'Snelle rondes', '60 seconden: en of ett, betekenis of verleden tijd. Haal je record?'),
      tool('#/oefenen/luisteren', 'Dictee', 'Luister naar een zin of woord en schrijf op wat je hoort.'),
      tool('#/luisteren', 'Luisteren instellen', 'Kies een Zweedse stem en lees hoe je voorlezen aanzet in jouw browser.'),
    ),
    h('section', { class: 'block' },
      h('h2', {}, 'Flitskaarten'),
      h('p', { class: 'muted' }, 'De woordenlijst van een hoofdstuk: omdraaien en zelf aangeven of je het wist.'),
      h('div', { class: 'chip-links' }, available().filter((c) => c.vocab?.length).map((c) =>
        h('a', { class: 'chip-link', href: `#/k/${c.chapter}/kaarten` }, c.title)))),
    h('section', { class: 'block' },
      h('h2', {}, 'Toetsen'),
      h('p', { class: 'muted' }, 'Twintig vragen per hoofdstuk, zonder tips, met een rapport per onderwerp.'),
      h('div', { class: 'chip-links' }, available().map((c) => {
        const t = getTest(c.chapter);
        return h('a', { class: 'chip-link', href: `#/k/${c.chapter}/toets` }, c.title, t ? h('span', { class: 'chip-score' }, `${Math.round(t.best * 100)}%`) : null);
      }))),
  );
}

// ---------- Dagelijkse herhaling ----------
export function viewDaily() {
  document.title = 'Dagelijkse herhaling · Svenska övningar';
  const entries = practiceEntries();
  const due = dueItems(entries);
  if (!due.length) {
    const boxes = srsStats(entries);
    const total = boxes.reduce((a, b) => a + b, 0);
    const when = (box) => (INTERVALS[box] === 1 ? 'morgen' : `over ${INTERVALS[box]} dagen`);
    return h('div', {},
      crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Dagelijkse herhaling' }),
      h('header', { class: 'page-head' },
        h('h1', {}, 'Dagelijkse herhaling'),
        h('p', { class: 'instruction' }, total
          ? 'Voor vandaag ben je klaar! Morgen staan er weer vragen voor je klaar.'
          : 'Hier komen de vragen terug die je in de oefeningen hebt gemaakt. Maak eerst een paar oefeningen.')),
      total
        ? h('section', { class: 'block' },
            h('h2', {}, 'Hoe goed ken je de stof?'),
            h('p', { class: 'muted' }, 'Elke vraag zit in een doos. Heb je hem in één keer goed, dan gaat hij een doos hoger en komt hij later pas terug. Fout? Dan komt hij morgen weer.'),
            h('ul', { class: 'boxes' }, boxes.map((n, box) => (box === 0 || !n ? null : h('li', {},
              h('span', { class: 'box-label' }, `Doos ${box}`),
              h('span', { class: 'bar' }, h('span', { style: `width:${Math.round((n / total) * 100)}%` })),
              h('span', { class: 'box-n' }, `${n} · terug ${when(box)}`))))))
        : h('a', { class: 'btn primary', href: '#/' }, 'Naar de hoofdstukken'),
    );
  }
  return practiceView(null, {
    title: 'Dagelijkse herhaling',
    instruction: `${plural(due.length, 'vraag staat', 'vragen staan')} klaar. Heb je een vraag in één keer goed, dan komt hij pas later terug.`,
    entries: due.slice(0, 20),
    again: `#/oefenen/herhaling?${Date.now()}`,
    empty: '',
  });
}

// ---------- Werkwoordtrainer ----------
export function viewVerbTrainer() {
  document.title = 'Werkwoordtrainer · Svenska övningar';
  const settings = getPref('verbs', { tenses: ['pres', 'pret', 'sup'], kinds: Object.keys(KINDS) });
  let done = 0;
  let good = 0;
  let run = 0;
  let bestRun = 0;
  let last = null;
  const stats = h('div', { class: 'score', 'aria-live': 'polite' });
  const list = h('div', { class: 'items' });
  const updateStats = () => {
    stats.replaceChildren(h('span', {}, `${done} gedaan · ${good} in één keer goed · reeks ${run} (beste ${bestRun})`));
  };
  const next = () => {
    const q = pickVerbItem(verbs, settings, Math.random, last);
    if (!q) {
      list.replaceChildren(h('p', { class: 'muted' }, 'Kies minstens één tijd en één soort werkwoord.'));
      return;
    }
    last = q.verb.inf;
    const card = itemCard(q.item, { topic: q.item.topic, findTopic: (t) => findTopic(t) }, done + 1, (r) => {
      done++;
      trackEvent(`werkwoord/${q.tense}/${q.verb.inf}/${r.firstTry ? 'goed' : r.revealed ? 'bekeken' : 'fout'}`, `${q.verb.inf} (${q.verb.nl}) · ${TENSES[q.tense].label}`);
      if (r.firstTry) {
        good++;
        run++;
        bestRun = Math.max(bestRun, run);
      } else run = 0;
      updateStats();
      setTimeout(next, r.revealed ? 1800 : 600);
    });
    list.prepend(card);
    [...list.children].slice(3).forEach((c) => c.remove());
    [...list.children].slice(1).forEach((c) => c.classList.add('previous'));
    card.focusFirst({ scroll: false });
  };
  const checkbox = (group, key, label) => {
    const box = h('input', {
      type: 'checkbox',
      checked: settings[group].includes(key),
      onchange: () => {
        settings[group] = box.checked ? [...new Set([...settings[group], key])] : settings[group].filter((k) => k !== key);
        setPref('verbs', settings);
        list.replaceChildren();
        next();
      },
    });
    return h('label', { class: 'option inline' }, box, h('span', {}, label));
  };
  const view = h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Oefenen', href: '#/oefenen' }, { label: 'Werkwoordtrainer' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Werkwoordtrainer'),
      h('p', { class: 'instruction' }, `Typ de gevraagde vorm en druk op Enter. Er zijn ${verbs.length} werkwoorden; de vragen gaan door zolang je wilt.`)),
    h('details', { class: 'settings', open: true },
      h('summary', {}, 'Instellingen'),
      h('fieldset', {}, h('legend', {}, 'Tijden'), h('div', { class: 'options row' }, Object.entries(TENSES).map(([k, t]) => checkbox('tenses', k, t.label)))),
      h('fieldset', {}, h('legend', {}, 'Soorten werkwoorden'), h('div', { class: 'options row' }, Object.entries(KINDS).map(([k, l]) => checkbox('kinds', k, l))))),
    stats, list,
  );
  updateStats();
  setTimeout(next, 0);
  return view;
}

// ---------- Flitskaarten ----------
export function viewFlashcards(ch) {
  document.title = `Flitskaarten · ${ch.title}`;
  const vocab = ch.vocab ?? [];
  const ex = ch.exercises.find((e) => e.id === 'woorden-sv-nl');
  let dir = getPref('cardsDir', 'sv');
  let deck;
  let current;
  let flipped;
  let known;
  let wrongOnce;
  const total = vocab.length;

  const face = h('div', { class: 'flash-face' });
  const card = h('button', { type: 'button', class: 'flashcard', 'aria-live': 'polite', onclick: () => flip() }, face);
  const actions = h('div', { class: 'actions flash-actions' });
  const progress = h('div', { class: 'score' });
  const summary = h('div', { class: 'summary', hidden: true });

  const front = (v) => (dir === 'sv' ? v.sv : v.nl);
  const back = (v) => (dir === 'sv' ? v.nl : v.sv);

  const show = () => {
    progress.textContent = `${known} van ${total} gekend · nog ${deck.length + (current ? 1 : 0)} kaarten`;
    if (!current) {
      card.hidden = true;
      actions.replaceChildren();
      summary.hidden = false;
      summary.replaceChildren(
        h('h2', {}, 'Alle kaarten gekend!'),
        h('p', {}, wrongOnce.size ? `${plural(wrongOnce.size, 'woord', 'woorden')} moest je vaker zien. Die komen terug in de dagelijkse herhaling.` : 'Je kende alles in één keer. Knap!'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Nog een keer'),
          ex ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/o/woorden-nl-sv` }, 'Oefen de woorden met typen') : null));
      setTimeout(() => summary.querySelector('.btn.primary')?.focus(), 0);
      return;
    }
    card.hidden = false;
    summary.hidden = true;
    card.classList.toggle('flipped', flipped);
    face.replaceChildren(
      h('span', { class: 'flash-main', lang: dir === 'sv' && !flipped ? 'sv' : dir === 'nl' && flipped ? 'sv' : 'nl' }, flipped ? back(current.v) : front(current.v)),
      h('span', { class: 'flash-hint' }, flipped ? front(current.v) : 'Klik of druk op spatie om om te draaien'),
    );
    actions.replaceChildren(...(flipped
      ? [h('button', { type: 'button', class: 'btn primary', onclick: () => rate(true) }, 'Wist ik (1)'),
         h('button', { type: 'button', class: 'btn ghost', onclick: () => rate(false) }, 'Nog niet (2)')]
      : [h('button', { type: 'button', class: 'btn ghost', onclick: () => flip() }, 'Omdraaien (spatie)')]),
      speechSupported() ? h('button', { type: 'button', class: 'btn ghost', onclick: () => speak(current.v.sv) }, 'Luister (L)') : '');
  };
  const flip = () => {
    if (!current) return;
    flipped = !flipped;
    show();
  };
  const rate = (ok) => {
    if (!current || !flipped) return;
    if (ex && !current.rated) recordItem(ch.chapter, ex, current.i, ok ? 'good' : 'wrong');
    current.rated = true;
    if (ok) known++;
    else {
      wrongOnce.add(current.i);
      deck.splice(Math.min(3, deck.length), 0, current);
    }
    current = deck.shift() ?? null;
    flipped = false;
    show();
    card.focus();
  };
  function start() {
    deck = shuffle(vocab.map((v, i) => ({ v, i, rated: false })));
    current = deck.shift() ?? null;
    flipped = false;
    known = 0;
    wrongOnce = new Set();
    show();
    card.focus();
  }
  const dirBtn = (value, label) => h('button', {
    type: 'button',
    class: `btn ${dir === value ? 'primary' : 'ghost'} small`,
    onclick: () => {
      dir = value;
      setPref('cardsDir', value);
      dirButtons.forEach((b) => b.className = `btn ${b.dataset.dir === dir ? 'primary' : 'ghost'} small`);
      start();
    },
    'data-dir': value,
  }, label);
  const dirButtons = [dirBtn('sv', 'Zweeds → Nederlands'), dirBtn('nl', 'Nederlands → Zweeds')];

  const view = h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: 'Flitskaarten' }),
    h('header', { class: 'page-head' },
      h('h1', {}, `Flitskaarten: ${ch.title}`),
      h('p', { class: 'instruction' }, 'Draai de kaart om en geef eerlijk aan of je het wist. Wat je nog niet wist, komt een paar kaarten later terug.'),
      h('div', { class: 'actions' }, dirButtons)),
    progress, card, actions, summary,
  );
  onKeys(view, (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' || (e.key === 'Enter' && e.target === card)) {
      e.preventDefault();
      flip();
    } else if (e.key === '1' || e.key.toLowerCase() === 'j') rate(true);
    else if (e.key === '2' || e.key.toLowerCase() === 'n') rate(false);
    else if (e.key.toLowerCase() === 'l' && current) speak(current.v.sv);
  });
  if (!total) return h('div', {}, h('p', {}, 'Dit hoofdstuk heeft geen woordenlijst.'));
  start();
  setTimeout(() => card.focus(), 0);
  return view;
}

// ---------- Toets ----------
export function viewTest(ch) {
  document.title = `Toets · ${ch.title}`;
  const pool = practiceEntries([ch]);
  const picked = shuffle(pool).slice(0, 20);
  const results = [];
  const items = picked.map(({ item, ex, idx, chapter }) => ({
    item,
    ref: { ch: chapter.chapter, ex, idx },
    topic: item.topic ?? ex.topic ?? 'woordenschat',
    label: ex.instruction.replace(/\*\*|\*/g, ''),
    ctx: { topic: ex.topic, testMode: true, findTopic: (t) => findTopic(t, chapter) },
  }));
  const prev = getTest(ch.chapter);
  const [list, score, summary] = exerciseRunner(items, {
    advanceAfterReveal: true,
    onItem: (entry, r) => results.push({ topic: entry.topic, ok: r.firstTry }),
    onFinish: () => {
      const good = results.filter((r) => r.ok).length;
      const perTopic = {};
      for (const r of results) {
        perTopic[r.topic] = perTopic[r.topic] ?? { good: 0, total: 0 };
        perTopic[r.topic].total++;
        if (r.ok) perTopic[r.topic].good++;
      }
      saveTest(ch.chapter, good, results.length, perTopic);
      trackEvent(`toets/${ch.chapter}/klaar/${scoreBucket(good / Math.max(results.length, 1))}`, `Toets ${ch.title}`);
      const rows = Object.entries(perTopic)
        .map(([topic, s]) => ({ topic, ...s, ratio: s.good / s.total, found: findTopic(topic, ch) }))
        .sort((a, b) => a.ratio - b.ratio);
      const pct = Math.round((good / Math.max(results.length, 1)) * 100);
      return [
        h('h2', {}, `Je score: ${good} van ${results.length} (${pct}%)`),
        h('p', {}, pct >= 80 ? 'Uitstekend! Dit hoofdstuk zit er goed in.' : pct >= 55 ? 'Voldoende. Kijk hieronder welke onderwerpen nog aandacht nodig hebben.' : 'Nog even oefenen. Begin bij de onderwerpen bovenaan de lijst.'),
        prev ? h('p', { class: 'muted' }, `Je vorige beste score was ${Math.round(prev.best * 100)}%.`) : null,
        h('div', { class: 'table-wrap' }, h('table', { class: 'report' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Onderwerp'), h('th', {}, 'Goed'), h('th', {}, ''))),
          h('tbody', {}, rows.map((r) => h('tr', { class: r.ratio < 0.6 ? 'weak' : '' },
            h('td', {}, r.found ? r.found.card.title : r.topic === 'woordenschat' ? 'Woordenschat' : r.topic),
            h('td', {}, `${r.good} / ${r.total}`),
            h('td', {}, r.found ? h('a', { href: r.found.href }, 'Uitleg') : null)))))),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/toets?${Date.now()}` }, 'Nieuwe toets'),
          h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk')),
      ];
    },
  });
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: 'Toets' }),
    h('header', { class: 'page-head' },
      h('h1', {}, `Toets: ${ch.title}`),
      h('p', { class: 'instruction' }, `${items.length} willekeurige vragen. Je hebt één poging per vraag en krijgt geen tips. Aan het eind zie je per onderwerp hoe het ging.`)),
    score, list, summary,
  );
}

// ---------- Snelle rondes ----------
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
      const verb = verbs[Math.floor(Math.random() * verbs.length)];
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
        h('span', { class: 'tool-text' }, best ? `Record: ${best}` : 'Nog geen record'));
    })),
  );
}

export function viewGame(id) {
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
    stage.replaceChildren(
      h('p', { class: 'lead' }, game.intro),
      h('p', { class: 'muted' }, best ? `Je record: ${best}` : 'Nog geen record.'),
      h('button', { type: 'button', class: 'btn primary big', onclick: start }, 'Start (Enter)'),
    );
    setTimeout(() => stage.querySelector('button')?.focus(), 0);
  };

  const nextQuestion = () => {
    if (Date.now() >= endAt) return; // tijd is op: de uitslag blijft staan
    let tries = 0;
    do q = game.make();
    while (recent.includes(q.prompt) && tries++ < 10);
    recent.push(q.prompt);
    if (recent.length > 8) recent.shift();
    locked = false;
    const buttons = q.options.map((o, i) => h('button', { type: 'button', class: 'game-option', onclick: () => answer(i) }, h('kbd', {}, String(i + 1)), h('span', { lang: id === 'betekenis' ? 'nl' : 'sv' }, o)));
    stage.replaceChildren(
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
    stage.replaceChildren(
      h('h2', {}, `Tijd! Je score: ${score}`),
      h('p', {}, record && score > 0 ? 'Nieuw record!' : `Je record: ${getGame(id)?.best ?? score}`),
      mistakes.length ? h('div', {}, h('p', {}, 'Deze had je fout:'), h('ul', { class: 'mistakes', lang: 'sv' }, [...new Set(mistakes)].map((m) => h('li', {}, m)))) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Nog een keer (Enter)'),
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
      if (!document.body.contains(stage)) return clearInterval(timer);
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
  onKeys(view, (e) => {
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
  });
  intro();
  return view;
}

