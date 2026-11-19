import './styles.css';
import { h } from './dom.js';
import { markdown, inline } from './md.js';
import { course, levels } from './content.js';
import { SITE_TEXT, SIBLING } from './config.js';
import { reportConfigured } from './report.js';
import { speakButton, speedSelect } from './render/speak.js';
import { speechSupported } from './speech.js';
import { setKnownWords, getInputMode, setInputMode } from './render/tiles.js';
import { expand } from './check/normalize.js';
import { viewListenSettings, viewDictation, reportSpeechStatus } from './views/listen.js';
import { itemCard } from './render/item-card.js';
import { createMenu } from './menu.js';
import { initPwa, installSection, isStandalone, syncThemeColor } from './pwa.js';
import { initAnalytics, trackPage, trackEvent, scoreBucket, analyticsConfigured, optedOut, setOptOut } from './analytics.js';
import {
  viewPracticeHub, viewDaily, viewVerbTrainer, viewFlashcards, viewTest, viewGames, viewGame, GAMES, dueCount, streakText,
} from './views/practice.js';
import { chapterByNo, findTopic, crumbs, progressBar, exerciseRunner, practiceView, splitTheme, plural } from './ui.js';
import { shuffle } from './build.js';
import {
  getResult, chapterProgress, resetProgress, recordItem, runState, startRun, completeRun, pickRound,
  weakItems, setLast, getLast, exportProgress, importProgress, migrateToIds,
} from './progress.js';

const app = document.getElementById('app');

// ---------- Startpagina ----------
function viewHome() {
  document.title = 'Svenska övningar';
  const last = getLast();
  return h('div', { class: 'home' },
    h('section', { class: 'hero' },
      h('h1', {}, 'Svenska övningar'),
      h('p', { class: 'lead' }, SITE_TEXT.lead),
      h('p', { class: 'muted' }, SIBLING.home[0], h('a', { href: SIBLING.href }, SIBLING.home[1]), SIBLING.home[2]),
    ),
    h('div', { class: 'today' },
      last
        ? h('a', { class: 'continue', href: last.href },
            h('span', { class: 'eyebrow' }, 'Verder waar je gebleven was'),
            h('strong', {}, last.title), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'))
        : null,
      (() => {
        const due = dueCount();
        return h('a', { class: 'continue alt', href: due ? '#/oefenen/herhaling' : '#/oefenen' },
          h('span', { class: 'eyebrow' }, due ? 'Dagelijkse herhaling' : 'Oefenen'),
          h('strong', {}, due ? `${due} ${due === 1 ? 'vraag staat' : 'vragen staan'} voor je klaar` : 'Werkwoordtrainer, flitskaarten en snelle rondes'),
          h('span', { class: 'streak-line' }, streakText()));
      })(),
    ),
    (levels.length ? levels : [{ id: null }]).map((lv) => [
      lv.id ? h('div', { class: 'level-head' }, h('h2', {}, lv.title), lv.intro ? h('p', { class: 'muted' }, lv.intro) : null) : null,
      h('ol', { class: 'chapters', start: course.find((c) => !lv.id || c.level === lv.id)?.chapter },
      course.filter((c) => !lv.id || c.level === lv.id).map((ch) => {
        const p = ch.available ? chapterProgress(ch) : null;
        const { name, topics } = splitTheme(ch.theme);
        const inner = [
          h('span', { class: 'ch-num' }, ch.title),
          h('span', { class: 'ch-title' }, name),
          topics ? h('span', { class: 'ch-theme' }, topics) : null,
          ch.available
            ? (p.itemsDone
                ? [progressBar(p.itemsDone, p.itemsTotal, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt`),
                   h('span', { class: 'ch-stats' }, `${p.completed} van ${p.exercises} oefeningen afgerond`)]
                : h('span', { class: 'ch-stats' }, plural(p.exercises, 'oefening', 'oefeningen')))
            : h('span', { class: 'soon' }, 'Binnenkort'),
        ];
        return h('li', { class: `ch-card${ch.available ? '' : ' disabled'}` },
          ch.available ? h('a', { href: `#/k/${ch.chapter}` }, inner) : h('div', {}, inner));
      }),
    )]),
  );
}

// ---------- Hoofdstuk ----------
function exerciseBadge(ch, ex) {
  const run = runState(ch.chapter, ex);
  const res = getResult(ch.chapter, ex.id);
  const inProgress = run.started && run.done.size > 0 && run.done.size < run.total;
  if (inProgress) return h('span', { class: 'badge mid', title: 'Bezig' }, `${run.done.size}/${run.total}`);
  if (res?.completedAt) return h('span', { class: `badge ${res.best >= 0.8 ? 'good' : 'mid'}`, title: 'Beste score' }, `${Math.round(res.best * 100)}%`);
  return null;
}

function viewChapter(ch) {
  document.title = `${ch.title} · Svenska övningar`;
  const p = chapterProgress(ch);
  const weak = weakItems(ch);
  const { name, topics } = splitTheme(ch.theme);
  // Waar ga je verder? De oefening die bezig is, anders de eerste die nog niet af is.
  const next = ch.exercises.find((ex) => { const r = runState(ch.chapter, ex); return r.started && r.done.size > 0 && r.done.size < r.total; })
    ?? ch.exercises.find((ex) => !getResult(ch.chapter, ex.id)?.completedAt);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title }),
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, ch.title),
      h('h1', {}, name),
      topics ? h('p', { class: 'lead' }, topics) : null,
      ch.goal || ch.writing
        ? h('ul', { class: 'goals' },
            ch.goal ? h('li', {}, h('strong', {}, 'Doel: '), ch.goal) : null,
            ch.writing ? h('li', {}, h('strong', {}, 'Schrijven: '), ch.writing) : null)
        : null,
      p.itemsDone
        ? h('div', { class: 'chapter-progress' },
            progressBar(p.itemsDone, p.itemsTotal, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt`),
            h('span', { class: 'muted' }, `${p.itemsDone} van ${p.itemsTotal} vragen gemaakt · ${p.completed} van ${p.exercises} oefeningen afgerond`))
        : null,
      h('div', { class: 'actions chapter-actions' },
        next ? h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/o/${next.id}` }, p.itemsDone ? `Verder: ${next.title}` : `Begin: ${next.title}`) : null,
        weak.length ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/fouten` }, `Oefen je fouten (${weak.length})`) : null,
        h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/mix` }, 'Mix'),
        h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/toets` }, 'Toets'),
        ch.vocab?.length ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/kaarten` }, 'Flitskaarten') : null),
    ),
    ch.grammar.length
      ? h('section', { class: 'block' },
          h('h2', {}, 'Grammatica'),
          h('ul', { class: 'cards' }, ch.grammar.map((g) =>
            h('li', {}, h('a', { class: 'card', href: `#/k/${ch.chapter}/g/${g.id}` }, h('strong', {}, g.title), h('span', { html: inline(g.summary) }))))),
        )
      : null,
    ch.sections.map((s) =>
      h('section', { class: 'block' },
        h('h2', {}, s.title),
        s.intro ? h('p', { class: 'muted' }, s.intro) : null,
        h('ol', { class: 'exercise-list' }, s.exercises.map((ex) => {
          const types = [...new Set(ex.items.flatMap((i) => (i.type === 'steps' ? i.steps.map((s) => s.type) : [i.type])))];
          return h('li', {},
            h('a', { href: `#/k/${ch.chapter}/o/${ex.id}` },
              h('span', { class: 'ex-title' }, ex.title),
              h('span', { class: 'ex-meta' }, `${plural(ex.items.length, 'vraag', 'vragen')}${ex.roundSize && ex.items.length > ex.roundSize ? `, ${ex.roundSize} per ronde` : ''} · ${types.map(typeName).join(', ')}`),
              exerciseBadge(ch, ex),
            ));
        })),
      ),
    ),
  );
}

const TYPE_NAMES = {
  mc: 'meerkeuze', multi: 'meerdere antwoorden', gap: 'invullen', translate: 'vertalen', order: 'zinsbouw',
  match: 'koppelen', table: 'tabel', truefalse: 'rätt/fel', clock: 'klok', dialogue: 'dialoog', free: 'schrijven', findError: 'zoek de fout',
  transform: 'omvormen', listen: 'luisteren', sort: 'sorteren',
};
const typeName = (t) => TYPE_NAMES[t] ?? t;

// ---------- Oefening ----------
function viewExercise(ch, ex, query) {
  document.title = `${ex.title} · ${ch.title}`;
  const href = `#/k/${ch.chapter}/o/${ex.id}`;
  setLast(href, `${ch.title} · ${ex.title}`);

  let run = runState(ch.chapter, ex);
  const restart = query.has('opnieuw');
  if (restart) history.replaceState(null, '', href);
  // Lange oefening (roundSize, bijv. een woordenlijst): een ronde met een deel van de vragen.
  const partial = ex.roundSize && ex.items.length > ex.roundSize;
  if (restart || !run.started || run.done.size >= run.total) {
    startRun(ch.chapter, ex, partial ? pickRound(ch.chapter, ex, ex.roundSize) : null);
    run = runState(ch.chapter, ex);
  }
  const resumed = run.done.size > 0;
  const goodBefore = [...run.done.values()].filter((s) => s === 'good').length;

  const remaining = ex.items.map((item, idx) => ({ item, idx })).filter(({ idx }) => run.inRound(idx) && !run.done.has(idx));
  const ordered = ex.shuffle ? shuffle(remaining) : remaining;
  const items = ordered.map(({ item, idx }) => ({
    item,
    ref: { ch: ch.chapter, ex, idx },
    ctx: { topic: ex.topic, fixedOrder: !!ex.fixedOrder, findTopic: (t) => findTopic(t, ch) },
  }));

  const pos = ch.exercises.indexOf(ex);
  const next = ch.exercises[pos + 1];
  const topicCard = ex.topic ? findTopic(ex.topic, ch) : null;
  const [list, score, summary] = exerciseRunner(items, {
    offset: { done: run.done.size, good: goodBefore, total: run.total },
    onFinish: () => {
      const { score: good, total } = completeRun(ch.chapter, ex);
      trackEvent(`oefening/${ch.chapter}/${ex.id}/klaar/${total ? scoreBucket(good / total) : 'schrijven'}`, `H${ch.chapter} · ${ex.title}`);
      return [
        h('h2', {}, total ? `Klaar! ${good} van ${total} in één keer goed.` : 'Klaar!'),
        h('p', {}, !total || good / total >= 0.8 ? 'Knap gedaan.' : 'Wat je fout had, kun je straks herhalen via „Oefen je fouten” bij het hoofdstuk.'),
        partial
          ? h('div', { class: 'actions' },
              h('a', { class: 'btn primary', href: `${href}?opnieuw` }, 'Volgende ronde'),
              next ? h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}/o/${next.id}` }, `Volgende: ${next.title}`) : h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk'))
          : h('div', { class: 'actions' },
              next ? h('a', { class: 'btn primary', href: `#/k/${ch.chapter}/o/${next.id}` }, `Volgende: ${next.title}`) : h('a', { class: 'btn primary', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk'),
              h('a', { class: 'btn ghost', href: `${href}?opnieuw` }, 'Opnieuw')),
      ];
    },
  });
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: ex.title }),
    h('header', { class: 'page-head' },
      h('h1', {}, ex.title),
      h('p', { class: 'instruction', html: inline(ex.instruction) }),
      run.total < ex.items.length
        ? h('p', { class: 'muted' }, `Een ronde van ${run.total} van de ${ex.items.length} vragen: eerst wat nieuw is of fout ging. Daarna kies je „Volgende ronde”.`)
        : null,
      topicCard ? h('p', { class: 'muted' }, 'Uitleg: ', h('a', { href: topicCard.href }, topicCard.card.title)) : null,
    ),
    resumed
      ? h('div', { class: 'resume' },
          h('span', {}, `Je gaat verder waar je gebleven was: ${run.done.size} van ${run.total} vragen al gedaan.`),
          h('a', { href: `${href}?opnieuw` }, 'Opnieuw beginnen'))
      : null,
    ex.text && !ex.listen
      ? h('div', { class: 'reading-layout' }, passage(ex), h('div', { class: 'reading-questions' }, score, list, summary), textButton(ex))
      : [ex.text ? passage(ex) : null, score, list, summary],
  );
}

/** Leestekst met voorleesknop. Bij een luisteroefening is de tekst eerst verborgen. */
function passage(ex) {
  const listenMode = ex.listen && speechSupported();
  const body = h('div', { class: 'passage-body', html: markdown(ex.text) });
  const read = speakButton(ex.text, { label: listenMode ? 'Luister naar de tekst' : 'Lees voor', className: listenMode ? 'big' : '' });
  const head = h('div', { class: 'passage-head' }, ex.textTitle ? h('h2', {}, ex.textTitle) : null,
    // speech-extra: verborgen als er geen Zweedse stem is (zie speech.js).
    read ? h('div', { class: 'passage-controls speech-extra', lang: 'nl' }, read, speedSelect()) : null);
  if (!listenMode) return h('section', { class: 'passage', lang: 'sv' }, head, body);
  return h('section', { class: 'passage listen', lang: 'sv' }, head,
    h('details', { class: 'passage-toggle' }, h('summary', { lang: 'nl' }, 'Toon de tekst'), body),
    h('p', { class: 'muted small', lang: 'nl' }, 'Werkt het voorlezen niet goed? ', h('a', { href: '#/luisteren' }, 'Luisteren instellen')));
}

/**
 * Telefoon: een zwevende knop „Tekst” zodra de leestekst uit beeld is.
 * Opent de tekst in een paneel, zodat je niet hoeft terug te scrollen.
 */
function textButton(ex) {
  const sheet = h('dialog', { class: 'text-sheet', 'aria-label': ex.textTitle ?? 'Tekst' },
    h('div', { class: 'text-sheet-head' },
      h('strong', {}, ex.textTitle ?? 'Tekst'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => sheet.close() }, 'Sluiten')),
    h('div', { class: 'passage-body', lang: 'sv', html: markdown(ex.text) }));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  const btn = h('button', { type: 'button', class: 'text-fab', hidden: true, onclick: () => sheet.showModal() }, '📄 Tekst');
  // Pas tonen als de tekst zelf uit beeld is.
  setTimeout(() => {
    const target = btn.parentElement?.querySelector('.passage');
    if (!target || typeof IntersectionObserver !== 'function') return;
    const watcher = new IntersectionObserver(([entry]) => {
      if (!btn.isConnected) return watcher.disconnect(); // pagina is weg
      btn.hidden = entry.isIntersecting;
    });
    watcher.observe(target);
  }, 0);
  return [btn, sheet];
}

function viewMix(ch) {
  document.title = `Mix · ${ch.title}`;
  const pool = ch.exercises
    .filter((ex) => !ex.text)
    .flatMap((ex) => ex.items.map((item, idx) => ({ item, ex, idx })).filter(({ item }) => item.type !== 'free'));
  return practiceView(ch, {
    title: 'Mix',
    instruction: 'Tien willekeurige vragen uit het hele hoofdstuk.',
    entries: shuffle(pool).slice(0, 10),
    again: `#/k/${ch.chapter}/mix?${Date.now()}`,
    empty: 'Dit hoofdstuk heeft nog geen vragen voor een mix.',
  });
}

function viewWeak(ch) {
  document.title = `Je fouten · ${ch.title}`;
  // Vragen bij een leestekst hebben de tekst nodig; die laten we hier weg.
  const entries = weakItems(ch).filter(({ ex }) => !ex.text);
  return practiceView(ch, {
    title: 'Oefen je fouten',
    instruction: 'Vragen die je eerder fout had. Heb je er een in één keer goed, dan verdwijnt hij uit deze lijst.',
    entries: shuffle(entries).slice(0, 15),
    again: `#/k/${ch.chapter}/fouten?${Date.now()}`,
    empty: 'Er staan geen fouten meer open in dit hoofdstuk. Goed bezig!',
  });
}

function viewWeakAll() {
  document.title = 'Herhalen · Svenska övningar';
  const entries = course.filter((c) => c.available).flatMap((c) =>
    weakItems(c).filter(({ ex }) => !ex.text).map((w) => ({ ...w, chapter: c })));
  return practiceView(null, {
    title: 'Herhalen',
    instruction: 'Je openstaande fouten uit alle hoofdstukken. Heb je een vraag in één keer goed, dan verdwijnt hij uit de lijst.',
    entries: shuffle(entries).slice(0, 15),
    again: `#/herhalen?${Date.now()}`,
    empty: 'Er staan geen fouten open. Vragen die je fout hebt of waarvan je het antwoord bekijkt, komen hier vanzelf terug.',
  });
}

function viewGrammarIndex() {
  document.title = 'Grammatica · Svenska övningar';
  const chapters = course.filter((c) => c.available && c.grammar.length);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Grammatica' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Grammatica'),
      h('p', { class: 'lead' }, 'Alle uitleg op een rij, per hoofdstuk.')),
    chapters.map((ch) =>
      h('section', { class: 'block' },
        h('h2', {}, h('a', { href: `#/k/${ch.chapter}`, class: 'plain' }, ch.title), h('span', { class: 'h2-sub' }, ch.theme)),
        h('ul', { class: 'cards' }, ch.grammar.map((g) =>
          h('li', {}, h('a', { class: 'card', href: `#/k/${ch.chapter}/g/${g.id}` }, h('strong', {}, g.title), h('span', { html: inline(g.summary) }))))),
      ),
    ),
  );
}

// ---------- Grammatica ----------
function viewGrammar(ch, card) {
  document.title = `${card.title} · ${ch.title}`;
  const related = ch.exercises.filter((e) => e.topic === card.id || e.items.some((i) => i.topic === card.id));
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: card.title }),
    h('article', { class: 'grammar' },
      h('p', { class: 'eyebrow' }, 'Grammatica'),
      h('h1', {}, card.title),
      h('p', { class: 'summary-rule', html: inline(card.summary) }),
      h('div', { class: 'prose', html: markdown(card.body) }),
    ),
    related.length
      ? h('section', { class: 'block' }, h('h2', {}, 'Oefen dit'),
          h('ul', { class: 'exercise-list' }, related.map((e) => h('li', {}, h('a', { href: `#/k/${ch.chapter}/o/${e.id}` }, h('span', { class: 'ex-title' }, e.title))))))
      : null,
  );
}

function viewAbout() {
  document.title = 'Over · Svenska övningar';
  return h('div', { class: 'prose about' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Over deze site' }),
    h('h1', {}, 'Over deze site'),
    h('p', {}, SITE_TEXT.about),
    h('p', {}, SIBLING.about[0], h('a', { href: SIBLING.href }, SIBLING.about[1]), SIBLING.about[2]),
    h('h2', {}, 'Luisteren'),
    h('p', {}, 'De site leest Zweeds voor met de spraakfunctie van je eigen browser. Hoe goed dat klinkt, hangt af van de Zweedse stemmen op je apparaat. ', h('a', { href: '#/luisteren' }, 'Luisteren instellen'), ' legt per browser uit hoe je een goede stem krijgt.'),
    h('p', {}, 'Alle oefenzinnen, teksten en uitleg op deze site zijn zelf geschreven. De site is niet verbonden aan een uitgever of lesmethode.'),
    h('h2', {}, 'Hoe werkt het nakijken?'),
    h('ul', {},
      h('li', {}, 'Hoofdletters, leestekens en extra spaties tellen niet mee.'),
      h('li', {}, 'Bij een fout krijg je eerst een tip, bijvoorbeeld over de woordvolgorde, een uitgang of de puntjes op de å, ä en ö.'),
      h('li', {}, 'Na een tweede fout zie je de regel met een link naar de uitleg. Na drie pogingen kun je het antwoord laten zien.'),
      h('li', {}, 'Bij een schrijfopdracht controleert de site alleen een paar dingen en krijg je een voorbeeldantwoord om mee te vergelijken.'),
    ),
    h('h2', {}, 'Snel werken'),
    h('ul', {},
      h('li', {}, 'Meerkeuze, keuzelijsten, koppelen en zinsbouw worden meteen nagekeken zodra je antwoord compleet is.'),
      h('li', {}, 'Typ je antwoord en druk op Enter. Bij meerkeuze kun je de cijfertoetsen 1–9 gebruiken.'),
      h('li', {}, 'Na een goed antwoord ga je vanzelf door naar de volgende vraag; aan het eind brengt Enter je naar de volgende oefening.'),
    ),
    h('h2', {}, 'Oefenvormen'),
    h('ul', {},
      h('li', {}, 'Dagelijkse herhaling: wat je in één keer goed hebt, komt steeds later terug (na 1, 2, 4, 7, 14 … dagen). Wat je fout had, komt de volgende dag terug.'),
      h('li', {}, 'Werkwoordtrainer: eindeloos werkwoordsvormen oefenen, met de tijden en soorten werkwoorden die jij kiest.'),
      h('li', {}, 'Zoek de fout: klik op het foute woord en verbeter de zin.'),
      h('li', {}, 'Toets: twintig vragen per hoofdstuk zonder tips, met een rapport per onderwerp.'),
      h('li', {}, 'Flitskaarten: woorden omdraaien en zelf aangeven of je ze wist.'),
      h('li', {}, 'Snelle rondes: zoveel mogelijk goede antwoorden in 60 seconden.'),
    ),
    reportConfigured() ? [
      h('h2', {}, 'Een fout melden'),
      h('p', {}, 'Klopt er iets niet in een vraag, of wordt een goed antwoord fout gerekend? Klik bij de vraag op „Fout gezien?” en schrijf kort wat er mis is. De vraag en je antwoord worden automatisch meegestuurd. Je hebt geen account nodig. Je melding wordt een openbaar issue op GitHub, dus zet er geen persoonlijke gegevens in. Tegen spam controleert Cloudflare Turnstile of je een mens bent.'),
    ] : null,
    h('h2', {}, 'Antwoorden invoeren'),
    h('p', {}, 'Bij langere antwoorden kun je typen of woordtegels in de goede volgorde aantikken. Op een telefoon of tablet staan standaard de tegels aan.'),
    (() => {
      const sel = h('select', { class: 'answer-input', 'aria-label': 'Invoer bij zinnen', onchange: () => setInputMode(sel.value) },
        [['auto', 'Automatisch (tegels op een touchscreen)'], ['tiles', 'Altijd woordtegels'], ['type', 'Altijd typen']]
          .map(([v, l]) => h('option', { value: v, selected: getInputMode() === v }, l)));
      return sel;
    })(),
    h('h2', {}, 'Privacy en statistieken'),
    analyticsConfigured()
      ? h('div', {},
          h('p', {}, 'Om de site te verbeteren tellen we anoniem mee welke pagina\'s bezocht worden en welke vragen vaak goed of fout gaan. Daarvoor gebruiken we GoatCounter: zonder cookies, zonder persoonsgegevens en zonder je antwoorden zelf.'),
          (() => {
            const box = h('input', { type: 'checkbox', checked: !optedOut(), onchange: () => setOptOut(!box.checked) });
            return h('label', { class: 'option inline' }, box, h('span', {}, 'Anoniem meetellen'));
          })())
      : h('p', {}, 'Deze site verzamelt geen statistieken.'),
    installSection(),
    h('h2', {}, 'Voortgang'),
    h('p', {}, `Je voortgang wordt per vraag opgeslagen ${isStandalone() ? 'in deze app' : 'in deze browser'}. Ga je halverwege een oefening weg, dan ga je later verder waar je gebleven was. Wil je op een ander apparaat verder, exporteer dan je voortgang naar een bestand en importeer dat daar.`),
    progressTools(),
  );
}

function progressTools() {
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      importProgress(await f.text());
      migrateToIds(course);
      status.textContent = 'Voortgang geïmporteerd.';
    } catch (e) {
      status.textContent = `Importeren mislukt: ${e.message}`;
    }
    file.value = '';
  });
  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `svenska-ovningar-voortgang-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status.textContent = 'Bestand gedownload.';
  };
  return h('div', {},
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onclick: download }, 'Exporteren'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => file.click() }, 'Importeren'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (confirm('Alle voortgang wissen?')) { resetProgress(); status.textContent = 'Voortgang gewist.'; } } }, 'Voortgang wissen'),
    ),
    file, status);
}

function notFound() {
  return h('div', { class: 'prose' }, h('h1', {}, 'Pagina niet gevonden'), h('p', {}, h('a', { href: '#/' }, 'Terug naar de start')));
}

// ---------- Router ----------
function route() {
  const [rawPath, rawQuery = ''] = location.hash.replace(/^#/, '').split('?');
  const path = rawPath || '/';
  const query = new URLSearchParams(rawQuery);
  const parts = path.split('/').filter(Boolean);
  let view;
  if (!parts.length) view = viewHome();
  else if (parts[0] === 'over') view = viewAbout();
  else if (parts[0] === 'luisteren') view = viewListenSettings();
  else if (parts[0] === 'grammatica') view = viewGrammarIndex();
  else if (parts[0] === 'herhalen') view = viewWeakAll();
  else if (parts[0] === 'oefenen') {
    if (!parts[1]) view = viewPracticeHub();
    else if (parts[1] === 'herhaling') view = viewDaily();
    else if (parts[1] === 'werkwoorden') view = viewVerbTrainer();
    else if (parts[1] === 'luisteren') view = viewDictation(query);
    else if (parts[1] === 'spel' && !parts[2]) view = viewGames();
    else if (parts[1] === 'spel' && GAMES[parts[2]]) view = viewGame(parts[2]);
    else view = notFound();
  }
  else if (parts[0] === 'k') {
    const ch = chapterByNo(parts[1]);
    if (!ch?.available) view = notFound();
    else if (parts.length === 2) view = viewChapter(ch);
    else if (parts[2] === 'o') {
      const ex = ch.exercises.find((e) => e.id === parts[3]);
      view = ex ? viewExercise(ch, ex, query) : notFound();
    } else if (parts[2] === 'g') {
      const card = ch.grammar.find((g) => g.id === parts[3]);
      view = card ? viewGrammar(ch, card) : notFound();
    } else if (parts[2] === 'mix') view = viewMix(ch);
    else if (parts[2] === 'fouten') view = viewWeak(ch);
    else if (parts[2] === 'toets') view = viewTest(ch);
    else if (parts[2] === 'kaarten') view = viewFlashcards(ch);
    else view = notFound();
  } else view = notFound();
  // Leesoefeningen krijgen op brede schermen tekst en vragen naast elkaar.
  app.classList.toggle('wide', !!view.querySelector?.('.reading-layout'));
  app.replaceChildren(view);
  updateMenu(path);
  trackPage(path, document.title);
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

// ---------- Å Ä Ö-knoppen ----------
function charBar() {
  const bar = h('div', { class: 'charbar', hidden: true, role: 'toolbar', 'aria-label': 'Zweedse letters' });
  let target = null;
  for (const c of ['å', 'ä', 'ö', 'Å', 'Ä', 'Ö']) {
    bar.append(h('button', {
      type: 'button',
      onmousedown: (e) => e.preventDefault(),
      onclick: () => {
        if (!target) return;
        const s = target.selectionStart ?? target.value.length;
        const e = target.selectionEnd ?? s;
        target.value = target.value.slice(0, s) + c + target.value.slice(e);
        target.setSelectionRange(s + 1, s + 1);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
      },
    }, c));
  }
  // De balk staat direct onder het invoerveld (in de pagina, niet zwevend), zodat hij nooit
  // achter het schermtoetsenbord verdwijnt. Als het toetsenbord opent, scrollt de pagina mee.
  let settleUntil = 0; // alleen kort na focus of toetsenbord bijsturen, nooit tijdens gewoon scrollen
  const keepVisible = () => {
    if (bar.hidden || Date.now() > settleUntil) return;
    const vv = window.visualViewport;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const r = bar.getBoundingClientRect();
    if (r.bottom > bottom - 8) window.scrollBy({ top: r.bottom - bottom + 8 });
  };
  // Het toetsenbord schuift de eerste keer met een animatie omhoog en de browser scrollt zelf
  // naar het veld: daarom een paar keer kort na elkaar controleren.
  const settle = () => {
    settleUntil = Date.now() + 1200;
    [60, 250, 500, 900].forEach((ms) => setTimeout(keepVisible, ms));
  };
  window.visualViewport?.addEventListener('resize', settle);
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches('input[type="text"], textarea')) return;
    target = e.target;
    // Onder de hele zin of het zinsveld; in een tabelcel direct onder het veld.
    const anchor = target.closest('td') ? target : target.closest('.sentence-input, .gap-text') ?? target;
    if (bar.previousElementSibling !== anchor) anchor.after(bar);
    bar.hidden = false;
    settle();
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!document.activeElement?.matches('input[type="text"], textarea')) bar.hidden = true;
    }, 150);
  });
}

// ---------- Thema ----------
// Gedeeld met de andere site (zelfde domein): één keuze voor licht of donker.
const THEME_KEY = 'svensk-ovningar:theme';

function themeToggle() {
  const btn = document.getElementById('theme');
  const apply = (t) => {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    syncThemeColor();
  };
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* */ }
  apply(saved);
  btn?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const t = dark ? 'light' : 'dark';
    apply(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* */ }
  });
}

// Woorden uit de oefenstof: met kleine letter midden in een zin, en namen (hoofdletter midden in een zin).
function knownWords() {
  const out = new Set();
  const names = new Set();
  const add = (pattern) => {
    const ws = expand(String(pattern))[0].split(/\s+/).slice(1);
    for (const w of ws) {
      const clean = w.replace(/[^\p{L}-]/gu, '');
      if (clean && clean === clean.toLowerCase()) out.add(clean);
      else if (clean) names.add(clean);
    }
  };
  const visit = (item) => {
    for (const a of item.answers ?? []) add(a);
    for (const a of item.correction?.answers ?? []) add(a);
    for (const g of item.gaps ?? []) for (const a of g.answers ?? []) add(a);
    (item.steps ?? []).forEach(visit);
  };
  for (const ch of course) for (const ex of ch.exercises ?? []) ex.items.forEach(visit);
  return [out, names];
}

setKnownWords(...knownWords());
// Oude voortgang (opgeslagen op de plek van een vraag) eenmalig omzetten naar vraag-id's.
migrateToIds(course);
const updateMenu = createMenu(course);
initAnalytics();
initPwa();
reportSpeechStatus();
window.addEventListener('hashchange', route);
charBar();
themeToggle();
route();
