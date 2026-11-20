import './styles.css';
import { h } from './dom.js';
import { markdown, inline } from './md.js';
import { course, levels, practiceEntries, balancedSample } from './content.js';
import { SITE_TEXT, SIBLING } from './config.js';
import { reportConfigured } from './report.js';
import { syncConfigured, syncNow, initSync, getCode, setCode, forgetCode, newCode, normalizeCode, formatCode, linkFor, lastSync } from './sync.js';
import { speakButton, speedSelect, voiceNote } from './render/speak.js';
import { speechSupported } from './speech.js';
import { setKnownWords, getInputMode, setInputMode } from './render/tiles.js';
import { expand } from './check/normalize.js';
import { viewListenSettings, viewDictation, reportSpeechStatus } from './views/listen.js';
import { itemCard } from './render/item-card.js';
import { createMenu } from './menu.js';
import { initAppNav, navigate } from './nav.js';
import { initPwa, installSection, isStandalone, syncThemeColor } from './pwa.js';
import { homeNotices, countVisit } from './onboarding.js';
import { initAnalytics, trackPage, trackEvent, scoreBucket, analyticsConfigured, optedOut, setOptOut } from './analytics.js';
import {
  viewPracticeHub, viewDaily, viewVerbTrainer, viewFlashcards, viewTest, viewGames, viewGame, GAMES, dueCount, streakText,
} from './views/practice.js';
import { autoNext, setAutoNext, chapterByNo, findTopic, crumbs, progressBar, exerciseRunner, practiceView, splitTheme, plural, scoreMessage, missedList } from './ui.js';
import { shuffle } from './build.js';
import {
  getResult, chapterProgress, resetProgress, recordItem, runState, startRun, completeRun, pickRound,
  weakItems, setLast, getLast, exportProgress, importProgress, migrateToIds,
  roundProgress, canDoStatus, newCanDo, getPref, setPref, openItems,
} from './progress.js';

const app = document.getElementById('app');

// ---------- Startpagina ----------
function viewHome() {
  document.title = 'Svenska övningar';
  const last = getLast();
  const open = course.filter((c) => c.available);
  const first = open[0];
  // Voortgang over alle hoofdstukken, alleen als er al iets gemaakt is.
  // Als zin, niet als balk: na een paar oefeningen staat een balk over alle stof nog op 0%.
  const totals = open.reduce((t, c) => {
    const p = chapterProgress(c);
    return { done: t.done + p.itemsDone, completed: t.completed + p.completed };
  }, { done: 0, completed: 0 });
  return h('div', { class: 'home' },
    h('section', { class: 'hero' },
      h('h1', {}, 'Svenska övningar'),
      h('p', { class: 'lead' }, SITE_TEXT.lead),
      // Eerste bezoek: meteen een duidelijke knop om te beginnen, nog vóór de uitleg.
      !last && first
        ? h('div', { class: 'actions hero-actions' },
            h('a', { class: 'btn primary', href: `#/k/${first.chapter}` }, `Begin met ${first.title.toLowerCase()}: ${splitTheme(first.theme).name}`))
        : null,
      totals.done
        ? h('p', { class: 'overall' }, totals.completed
            ? `Je hebt al ${plural(totals.completed, 'oefening', 'oefeningen')} afgerond en ${plural(totals.done, 'vraag', 'vragen')} gemaakt.`
            : `Je hebt al ${plural(totals.done, 'vraag', 'vragen')} gemaakt.`)
        : null,
      h('p', { class: 'muted' }, SIBLING.home[0], h('a', { href: SIBLING.href }, SIBLING.home[1]), SIBLING.home[2]),
    ),
    // Verder gaan is het belangrijkste: vóór de meldingen over de app en de uitleg.
    last
      ? h('a', { class: 'continue', href: last.href },
          h('span', { class: 'eyebrow' }, 'Verder waar je gebleven was'),
          h('strong', {}, last.title), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'))
      : null,
    homeNotices(),
    h('div', { class: 'today' },
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
                   h('span', { class: 'ch-stats' }, `${p.completed} van ${p.exercises} oefeningen afgerond${goalsLine(ch)}`)]
                : h('span', { class: 'ch-stats' }, plural(p.exercises, 'oefening', 'oefeningen')))
            : h('span', { class: 'soon' }, 'Binnenkort'),
        ];
        return h('li', { class: `ch-card${ch.available ? '' : ' disabled'}`, style: chapterHue(ch) },
          ch.available ? h('a', { href: `#/k/${ch.chapter}` }, inner) : h('div', {}, inner));
      }),
    )]),
  );
}

/** „ · 1 van 3 doelen” als er al een doel behaald is. */
function goalsLine(ch) {
  const st = canDoStatus(ch);
  const done = st.filter((x) => x.done).length;
  return done ? ` · ${done} van ${st.length} doelen` : '';
}

/** Behaalde kan-doen-uitspraken die nog niet gemeld waren: tellen (één keer) en teruggeven. */
function claimCanDo(ch) {
  const fresh = newCanDo(ch);
  for (const f of fresh) trackEvent(`kandoen/${ch.chapter}/${f.nr}/behaald`, `H${ch.chapter} · ${f.text}`);
  return fresh;
}

/** Wat je na dit hoofdstuk kunt; de app vinkt het zelf af (zie canDoStatus in progress.js). */
function canDoList(ch) {
  claimCanDo(ch);
  const st = canDoStatus(ch);
  if (!st.length) return null;
  return h('section', { class: 'cando', 'aria-labelledby': 'cando-title' },
    h('h2', { id: 'cando-title' }, 'Dit kun je na dit hoofdstuk'),
    h('ul', {}, st.map((x) => {
      const pct = (n) => (x.total ? Math.round((n / x.total) * 100) : 0);
      const label = `${x.seen} van ${x.total} vragen gemaakt, ${x.known} beheerst`;
      return h('li', { class: x.done ? 'done' : '' },
        h('span', { class: 'cando-mark', 'aria-hidden': 'true' }, x.done ? '✓' : ''),
        h('span', { class: 'cando-body' },
          h('span', { class: 'cando-text' }, x.text, x.done ? h('span', { class: 'sr-only' }, ' (behaald)') : null),
          // Twee tinten: licht = gemaakt, donker = beheerst. Zo is er al voortgang te zien vóór het vinkje.
          !x.done && x.seen
            ? h('span', { class: 'cando-bar', role: 'img', 'aria-label': label, title: label },
                h('span', { class: 'seen', style: `width:${pct(x.seen)}%` }),
                h('span', { class: 'known', style: `width:${pct(x.known)}%` }))
            : null));
    })),
    h('p', { class: 'muted small' },
      st.some((x) => !x.done && x.seen) ? [h('span', { class: 'cando-key seen', 'aria-hidden': 'true' }), ' gemaakt · ', h('span', { class: 'cando-key known', 'aria-hidden': 'true' }), ' beheerst. '] : null,
      'Het vinkje komt vanzelf: als je de meeste vragen hierover een paar keer achter elkaar in één keer goed hebt, ook in de dagelijkse herhaling.'));
}

/** Eigen kleur per hoofdstuk (een tint op de kleurencirkel), voor een streep op kaart en kop. */
const chapterHue = (ch) => `--ch-hue:${(ch.chapter * 137) % 360}`;

// ---------- Hoofdstuk ----------
function exerciseBadge(ch, ex) {
  const run = runState(ch.chapter, ex);
  const res = getResult(ch.chapter, ex.id);
  const inProgress = run.started && run.done.size > 0 && run.done.size < run.total;
  if (inProgress) return h('span', { class: 'badge mid', title: 'Bezig' }, `${run.done.size}/${run.total}`);
  // Afgerond, maar met vragen die nog niet meetellen (later toegevoegd, gewijzigd, of woorden die nog niet aan de beurt waren).
  const open = res?.completedAt || exerciseDone(ch, ex) ? openItems(ch.chapter, ex).length : 0;
  if (open) {
    const words = ex.roundSize && ex.items.length > ex.roundSize;
    return h('span', { class: 'badge mid', title: words ? `${open} woorden nog niet gehad` : `${open} ${open === 1 ? 'vraag' : 'vragen'} nieuw of nog niet gemaakt` },
      words ? `${open} te gaan` : `${open} nieuw`);
  }
  if (res?.completedAt) return h('span', { class: `badge ${res.best >= 0.8 ? 'good' : 'mid'}`, title: 'Beste score' }, `${Math.round(res.best * 100)}%`);
  return null;
}

function viewChapter(ch) {
  document.title = `${ch.title} · Svenska övningar`;
  const p = chapterProgress(ch);
  const weak = weakItems(ch);
  const { name, topics } = splitTheme(ch.theme);
  // Waar ga je verder? De oefening die bezig is, anders de eerste die nog niet af is. Een lange
  // oefening in rondes (woordenschat) telt na één ronde als gedaan: die oefen je verder in rondes en
  // in de herhaling, zonder dat de leerling eerst de hele lijst moet afmaken.
  const next = ch.exercises.find((ex) => { const r = runState(ch.chapter, ex); return r.started && r.done.size > 0 && r.done.size < r.total; })
    ?? ch.exercises.find((ex) => !exerciseDone(ch, ex))
    ?? ch.exercises.find((ex) => openItems(ch.chapter, ex).length);
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title }),
    h('header', { class: 'page-head chapter-head', style: chapterHue(ch) },
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
    canDoList(ch),
    // Onderdelen zijn in- en uitklapbaar, zodat de pagina op een telefoon niet eindeloos lang is.
    // Open staat het onderdeel waar je verder gaat; bij een nieuw hoofdstuk ook de uitleg.
    ch.grammar.length
      ? foldSection('Grammatica', !p.itemsDone, plural(ch.grammar.length, 'onderwerp', 'onderwerpen'),
          h('ul', { class: 'cards' }, ch.grammar.map((g) =>
            h('li', {}, h('a', { class: 'card', href: `#/k/${ch.chapter}/g/${g.id}` }, h('strong', {}, g.title), h('span', { html: inline(g.summary) }))))))
      : null,
    ch.sections.map((s, i) => {
      const done = s.exercises.filter((ex) => getResult(ch.chapter, ex.id)?.completedAt).length;
      const open = next ? s.exercises.includes(next) : i === 0;
      // Alles afgerond maar nog vragen open (nieuw, gewijzigd, of woorden die nog niet aan de beurt waren): geen vinkje.
      const left = done === s.exercises.length ? s.exercises.reduce((n, ex) => n + openItems(ch.chapter, ex).length, 0) : 0;
      return foldSection(s.title, open,
        done === s.exercises.length
          ? (left ? `${plural(done, 'oefening', 'oefeningen')} afgerond · ${plural(left, 'vraag', 'vragen')} open` : `✓ ${plural(done, 'oefening', 'oefeningen')} afgerond`)
          : `${done} van ${s.exercises.length} afgerond`,
        s.intro ? h('p', { class: 'muted' }, s.intro) : null,
        h('ol', { class: 'exercise-list' }, s.exercises.map((ex) => {
          const types = [...new Set(ex.items.flatMap((i) => (i.type === 'steps' ? i.steps.map((s) => s.type) : [i.type])))];
          return h('li', {},
            h('a', { href: `#/k/${ch.chapter}/o/${ex.id}` },
              h('span', { class: 'ex-title' }, ex.title),
              h('span', { class: 'ex-meta' }, `${plural(ex.items.length, 'vraag', 'vragen')}${ex.roundSize && ex.items.length > ex.roundSize ? `, ${ex.roundSize} per ronde` : ''} · ${types.map(typeName).join(', ')}`),
              exerciseBadge(ch, ex),
            ));
        })));
    }),
  );
}

/** Een in- en uitklapbaar onderdeel van een hoofdstukpagina. */
function foldSection(title, open, meta, ...content) {
  return h('details', { class: 'block fold', open },
    h('summary', {}, h('h2', {}, title), meta ? h('span', { class: 'fold-meta' }, meta) : null),
    ...content);
}

const TYPE_NAMES = {
  mc: 'meerkeuze', multi: 'meerdere antwoorden', gap: 'invullen', translate: 'vertalen', order: 'zinsbouw',
  match: 'koppelen', table: 'tabel', truefalse: 'rätt/fel', clock: 'klok', dialogue: 'dialoog', free: 'schrijven', findError: 'zoek de fout',
  transform: 'omvormen', listen: 'luisteren', sort: 'sorteren',
};
const typeName = (t) => TYPE_NAMES[t] ?? t;

// ---------- Oefening ----------
/** Uitleg boven een ronde van een lange oefening. */
function roundIntro(size, p) {
  const start = `Een ronde van ${size} van de ${p.total} woorden: eerst wat nieuw is of fout ging.`;
  return p.seen ? `${start} Je hebt er al ${p.seen} gehad.` : `${start} Daarna kies je „Volgende ronde”.`;
}

/**
 * Is een oefening af? Afgerond, of bij een lange oefening in rondes (woordenschat): na één ronde.
 * Die oefen je verder in rondes en in de herhaling, zonder eerst de hele lijst af te maken.
 */
function exerciseDone(ch, ex) {
  if (getResult(ch.chapter, ex.id)?.completedAt) return true;
  return !!(ex.roundSize && ex.items.length > ex.roundSize && roundProgress(ch.chapter, ex).seen >= ex.roundSize);
}

/** Waar na deze oefening heen: de eerstvolgende die nog niet af is (daarna vooraan in het hoofdstuk verder zoeken). */
function onwardFrom(ch, ex) {
  const pos = ch.exercises.indexOf(ex);
  const after = ch.exercises.slice(pos + 1).find((e) => !exerciseDone(ch, e));
  if (after) return { ex: after, label: `Volgende: ${after.title}` };
  const before = ch.exercises.slice(0, pos).find((e) => !exerciseDone(ch, e));
  if (before) return { ex: before, label: `Nog niet gedaan: ${before.title}` };
  // Alles afgerond: dan de oefeningen met vragen die nog openstaan.
  const open = [...ch.exercises.slice(pos + 1), ...ch.exercises.slice(0, pos)].find((e) => openItems(ch.chapter, e).length);
  if (open) return { ex: open, label: `Nog open: ${open.title}` };
  return { chapter: course.find((c) => c.chapter > ch.chapter && c.available) ?? null };
}

function viewExercise(ch, ex, query) {
  document.title = `${ex.title} · ${ch.title}`;
  const href = `#/k/${ch.chapter}/o/${ex.id}`;
  setLast(href, `${ch.title} · ${ex.title}`);

  let run = runState(ch.chapter, ex);
  const restart = query.has('opnieuw');
  if (restart) history.replaceState(null, '', href);
  // Lange oefening (roundSize, bijv. een woordenlijst): een ronde met een deel van de vragen.
  const partial = ex.roundSize && ex.items.length > ex.roundSize;
  // Al afgerond, maar met nieuwe of gewijzigde vragen: alleen die, niet de hele oefening opnieuw.
  const openOnly = !partial && !restart && getResult(ch.chapter, ex.id)?.completedAt ? openItems(ch.chapter, ex) : [];
  if (restart || !run.started || run.done.size >= run.total) {
    startRun(ch.chapter, ex, partial ? pickRound(ch.chapter, ex, ex.roundSize) : openOnly.length ? openOnly : null);
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

  const topicCard = ex.topic ? findTopic(ex.topic, ch) : null;
  const [list, score, summary] = exerciseRunner(items, {
    offset: { done: run.done.size, good: goodBefore, total: run.total },
    onFinish: (_good, _done, missed) => {
      const { score: good, total } = completeRun(ch.chapter, ex);
      const fresh = claimCanDo(ch);
      const achieved = fresh.length
        ? h('div', { class: 'achieved' },
            h('strong', {}, fresh.length === 1 ? 'Nieuw doel behaald!' : 'Nieuwe doelen behaald!'),
            h('ul', {}, fresh.map((f) => h('li', {}, '✓ ', f.text))))
        : null;
      trackEvent(`oefening/${ch.chapter}/${ex.id}/klaar/${total ? scoreBucket(good / total) : 'schrijven'}`, `H${ch.chapter} · ${ex.title}`);
      const heading = h('h2', {}, total ? `Klaar! ${good} van ${total} in één keer goed.` : 'Klaar!');
      // Pas hier bepalen: deze oefening is nu af en telt niet meer mee als „nog te doen”.
      const to = onwardFrom(ch, ex);
      const onward = (cls) => {
        if (to.ex) return h('a', { class: `btn ${cls}`, href: `#/k/${ch.chapter}/o/${to.ex.id}` }, to.label);
        const back = h('a', { class: `btn ${to.chapter ? 'ghost' : cls}`, href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk');
        if (!to.chapter) return back;
        return [h('a', { class: `btn ${cls}`, href: `#/k/${to.chapter.chapter}` }, `Hoofdstuk af! Verder met ${to.chapter.title.toLowerCase()}`), back];
      };
      if (!partial) {
        const hard = total && good / total < 0.5;
        return [
          heading,
          achieved,
          total ? progressBar(good, total, `${good} van ${total} in één keer goed`) : null,
          h('p', {}, scoreMessage(good, total)),
          missedList(missed),
          // Lage score: eerst de uitleg en opnieuw, pas daarna verder.
          h('div', { class: 'actions' },
            hard && topicCard ? h('a', { class: 'btn primary', href: topicCard.href }, `Uitleg: ${topicCard.card.title}`) : null,
            hard ? h('a', { class: `btn ${topicCard ? 'ghost' : 'primary'}`, href: `${href}?opnieuw` }, 'Opnieuw') : null,
            onward(hard ? 'ghost' : 'primary'),
            hard ? null : h('a', { class: 'btn ghost', href: `${href}?opnieuw` }, 'Opnieuw')),
        ];
      }
      // Lange oefening in rondes: laat zien hoe ver je bent, en wanneer de hele lijst af is.
      const p = roundProgress(ch.chapter, ex);
      if (!p.fresh && !p.wrong) {
        return [
          heading,
          achieved,
          h('p', {}, `Je hebt alle ${p.total} woorden gehad, en de laatste keer had je ze allemaal goed. Deze oefening is af!`),
          h('div', { class: 'actions' }, onward('primary'), h('a', { class: 'btn ghost', href: `${href}?opnieuw` }, 'Nog een ronde')),
        ];
      }
      const todo = [p.fresh ? `${p.fresh} nog nieuw` : null, p.wrong ? `${p.wrong} om te herhalen` : null].filter(Boolean).join(', ');
      return [
        heading,
        achieved,
        h('p', {}, `Je hebt nu ${p.seen} van de ${p.total} woorden gehad (${todo}).`),
        progressBar(p.seen - p.wrong, p.total, `${p.seen - p.wrong} van ${p.total} woorden goed`),
        h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: `${href}?opnieuw` }, 'Volgende ronde'), onward('ghost')),
      ];
    },
  });
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: ch.title, href: `#/k/${ch.chapter}` }, { label: ex.title }),
    h('header', { class: 'page-head' },
      h('h1', {}, ex.title),
      h('p', { class: 'instruction', html: inline(ex.instruction) }),
      run.total < ex.items.length
        ? h('p', { class: 'muted' }, partial
            ? roundIntro(run.total, roundProgress(ch.chapter, ex))
            : [`Je hebt deze oefening al afgerond. Hier ${run.total === 1 ? 'staat alleen de vraag die' : `staan alleen de ${run.total} vragen die`} nieuw ${run.total === 1 ? 'is' : 'zijn'} of sinds je oefende ${run.total === 1 ? 'is' : 'zijn'} verbeterd. `,
               h('a', { href: `${href}?opnieuw` }, 'Alles opnieuw')])
        : null,
      topicCard ? h('p', { class: 'muted' }, 'Uitleg: ', h('a', { href: topicCard.href }, topicCard.card.title)) : null,
      ex.listen || ex.items.some((i) => i.type === 'listen') ? voiceNote() : null,
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
  const pool = practiceEntries([ch]);
  return practiceView(ch, {
    title: 'Mix',
    instruction: 'Tien willekeurige vragen uit het hele hoofdstuk.',
    entries: balancedSample(pool, 10, shuffle),
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
    left: {
      count: () => weakItems(ch).filter(({ ex }) => !ex.text).length,
      more: (n) => `Er ${n === 1 ? 'staat' : 'staan'} in dit hoofdstuk nog ${plural(n, 'fout', 'fouten')} open.`,
      done: 'Alle fouten in dit hoofdstuk zijn opgelost. Goed bezig!',
    },
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
    left: {
      count: () => course.filter((c) => c.available).reduce((n, c) => n + weakItems(c).filter(({ ex }) => !ex.text).length, 0),
      more: (n) => `Er ${n === 1 ? 'staat' : 'staan'} nog ${plural(n, 'fout', 'fouten')} open.`,
      done: 'Alle fouten zijn opgelost. Goed bezig!',
    },
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
    h('h2', {}, 'Handleiding: zo begin je'),
    h('ol', {},
      h('li', {}, 'Kies op de startpagina een hoofdstuk. Elk hoofdstuk heeft uitleg (grammatica), oefeningen, woorden en een toets.'),
      h('li', {}, 'Lees eerst de uitleg of begin direct met de eerste oefening. Bij elke vraag staat een link naar de uitleg die erbij hoort.'),
      h('li', {}, 'Maak de oefeningen van boven naar beneden. Lange woordenlijsten oefen je in rondes van 15 woorden: eerst nieuwe en foute woorden.'),
      h('li', {}, 'Kom elke dag even terug: de dagelijkse herhaling op de startpagina zet klaar wat je weer moet oefenen.'),
      h('li', {}, 'Op je telefoon? Zet de site als app op je beginscherm (zie „Als app installeren” hieronder).'),
    ),
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
      h('li', {}, 'Meerkeuze, keuzelijsten en koppelen worden meteen nagekeken zodra je antwoord compleet is.'),
      h('li', {}, 'Bij woordtegels druk je zelf op Controleer, zodat je eerst nog kunt schuiven. Tik tussen twee woorden in je zin om daar een woord in te voegen; tik op een woord in je zin om het weg te halen.'),
      h('li', {}, 'Typ je antwoord en druk op Enter. Bij meerkeuze kun je de cijfertoetsen 1–9 gebruiken.'),
      h('li', {}, 'Na een goed antwoord ga je vanzelf door naar de volgende vraag. Op een telefoon wacht de site even; tik of scrol je intussen, dan blijf je staan en tik je zelf op „Volgende vraag”. Dit kun je hieronder uitzetten. Aan het eind brengt Enter je naar de volgende oefening.'),
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
    h('p', {}, 'Bij het typen staan er knoppen voor å, ä en ö: op een computer naast „Controleer”, op een telefoon boven het toetsenbord. Heeft je toetsenbord die letters zelf al, dan kun je de knoppen uitzetten.'),
    (() => {
      const box = h('input', { type: 'checkbox', checked: charBarOn(), onchange: () => { setPref('charBar', box.checked); applyCharBar(); } });
      return h('label', { class: 'option inline' }, box, h('span', {}, 'Knoppen voor å, ä en ö'));
    })(),
    h('h2', {}, 'Naar de volgende vraag'),
    h('p', {}, 'Na een goed antwoord gaat de site vanzelf naar de volgende vraag. Typte je je antwoord op een telefoon, dan staat de cursor meteen in het volgende invulvak en blijft het toetsenbord open. Wil je eerst rustig de uitleg lezen, zet dit dan uit: je tikt dan zelf op „Volgende vraag”.'),
    (() => {
      const box = h('input', { type: 'checkbox', checked: autoNext(), onchange: () => setAutoNext(box.checked) });
      return h('label', { class: 'option inline' }, box, h('span', {}, 'Vanzelf naar de volgende vraag'));
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
    h('p', {}, `Je voortgang wordt per vraag opgeslagen ${isStandalone() ? 'in deze app' : 'in deze browser'}. Ga je halverwege een oefening weg, dan ga je later verder waar je gebleven was.`),
    syncConfigured() ? syncSection() : null,
    h('h3', {}, 'Exporteren en importeren'),
    h('p', {}, 'Je kunt je voortgang ook als bestand bewaren en op een ander apparaat importeren. Importeren voegt samen: wat je op dit apparaat al gedaan hebt, blijft staan, en per vraag telt je laatste poging.'),
    progressTools(),
    h('p', { class: 'muted version' }, `Versie ${import.meta.env.APP_VERSION ?? 'onbekend'}`),
  );
}

function progressTools() {
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const changed = importProgress(await f.text());
      migrateToIds(course);
      status.textContent = changed ? 'Voortgang geïmporteerd en samengevoegd.' : 'Niets nieuws in dit bestand: alles stond er al.';
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
      h('button', { type: 'button', class: 'btn ghost', onclick: () => {
        const linked = getCode();
        if (!confirm(linked ? 'Alle voortgang op dit apparaat wissen? Dit apparaat wordt dan ook ontkoppeld; op je andere apparaten blijft de voortgang staan.' : 'Alle voortgang wissen?')) return;
        if (linked) forgetCode();
        resetProgress();
        status.textContent = 'Voortgang gewist.';
      } }, 'Voortgang wissen'),
    ),
    file, status);
}

// ---------- Synchroniseren tussen apparaten ----------
const when = (t) => (t ? new Date(t).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : 'nog niet');

function syncSection() {
  const box = h('div', { class: 'sync' });
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  let draw;
  const run = async (msg) => {
    status.textContent = 'Bezig met synchroniseren…';
    try {
      const r = await syncNow();
      status.textContent = msg ?? (r?.changed ? 'Gesynchroniseerd: voortgang van je andere apparaten is toegevoegd.' : 'Gesynchroniseerd.');
    } catch (e) {
      status.textContent = `Synchroniseren lukt nu niet (${e.message}). Het wordt later vanzelf opnieuw geprobeerd.`;
    }
    draw();
  };
  draw = () => {
    const code = getCode();
    let parts;
    if (code) {
      const link = linkFor(code);
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(link);
          status.textContent = 'Koppellink gekopieerd. Open hem op je andere apparaat.';
        } catch {
          status.textContent = `Kopiëren lukt niet. De link is: ${link}`;
        }
      };
      parts = [
        h('p', {}, 'Dit apparaat is gekoppeld met code ', h('strong', { class: 'sync-code' }, formatCode(code)), `. Laatst gesynchroniseerd: ${when(lastSync())}.`),
        h('p', {}, 'Op een ander apparaat: open de koppellink, of vul daar op deze pagina de code in. De code geldt voor de A1–A2- en de B1–B2-site samen. Houd hem voor jezelf: wie de code heeft, kan je voortgang zien en aanvullen.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => run() }, 'Nu synchroniseren'),
          h('button', { type: 'button', class: 'btn ghost', onclick: copy }, 'Kopieer koppellink'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => {
            if (!confirm('Dit apparaat ontkoppelen? De voortgang hier blijft staan, maar wordt niet meer gesynchroniseerd.')) return;
            forgetCode();
            status.textContent = 'Ontkoppeld.';
            draw();
          } }, 'Ontkoppelen'),
        ),
      ];
    } else {
      const input = h('input', { type: 'text', class: 'answer-input', placeholder: 'xxxx-xxxx-xxxx-xxxx', 'aria-label': 'Synccode', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const join = () => {
        const c = normalizeCode(input.value);
        if (!c) {
          status.textContent = 'Dit is geen geldige code: 16 letters en cijfers.';
          return;
        }
        setCode(c);
        run('Gekoppeld en gesynchroniseerd.');
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
      parts = [
        h('p', {}, 'Oefen je op meer apparaten, bijvoorbeeld je telefoon en je laptop? Zet synchroniseren aan. Je krijgt een code waarmee je je andere apparaten koppelt; een account is niet nodig. Je voortgang wordt dan, onder die code, bewaard bij Cloudflare. Je naam of e-mailadres gaat niet mee.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => { setCode(newCode()); run('Synchroniseren staat aan. Koppel nu je andere apparaten met de code of de link.'); } }, 'Synchroniseren aanzetten'),
        ),
        h('p', {}, 'Heb je al een code van een ander apparaat?'),
        h('div', { class: 'actions' }, input, h('button', { type: 'button', class: 'btn ghost', onclick: join }, 'Koppelen')),
      ];
    }
    box.replaceChildren(...parts, status);
  };
  draw();
  return [h('h3', {}, 'Synchroniseren tussen apparaten'), box];
}

/** #/koppel/<code>: geopend via een koppellink van een ander apparaat. */
function viewLink(raw) {
  const code = normalizeCode(decodeURIComponent(raw ?? ''));
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  if (!syncConfigured() || !code) {
    return h('div', { class: 'prose' }, h('h1', {}, 'Koppellink'), h('p', {}, 'Deze link werkt niet (meer). Kijk op de pagina ', h('a', { href: '#/over' }, 'Over'), '.'));
  }
  const current = getCode();
  const go = async () => {
    setCode(code);
    status.textContent = 'Bezig met synchroniseren…';
    try {
      await syncNow();
      navigate('#/');
    } catch (e) {
      status.textContent = `Gekoppeld, maar synchroniseren lukt nu niet (${e.message}). Het wordt later vanzelf opnieuw geprobeerd.`;
    }
  };
  return h('div', { class: 'prose' },
    h('h1', {}, 'Apparaat koppelen'),
    current === code
      ? h('p', {}, 'Dit apparaat is al gekoppeld met deze code. ', h('a', { href: '#/' }, 'Naar de start'))
      : [
          h('p', {}, `Wil je dit apparaat koppelen met code ${formatCode(code)}? Je voortgang hier wordt samengevoegd met die van je andere apparaten; er gaat niets verloren.`),
          current ? h('p', {}, 'Dit apparaat is nu gekoppeld met een andere code. Die koppeling vervalt.') : null,
          h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn primary', onclick: go }, 'Koppelen'),
            h('a', { class: 'btn ghost', href: '#/' }, 'Niet nu')),
        ],
    status);
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
  else if (parts[0] === 'koppel') view = viewLink(parts[1]);
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
// Aan of uit op de pagina Over (per apparaat, standaard aan). Uit: de klasse no-charbar verbergt de balk.
const charBarOn = () => getPref('charBar', true) !== false;
const applyCharBar = () => document.documentElement.classList.toggle('no-charbar', !charBarOn());

function charBar() {
  applyCharBar();
  const bar = h('div', { class: 'charbar', hidden: true, role: 'toolbar', 'aria-label': 'Zweedse letters' });
  let target = null;
  for (const c of ['å', 'ä', 'ö', 'Å', 'Ä', 'Ö']) {
    bar.append(h('button', {
      class: c === c.toUpperCase() ? 'upper' : null,
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
  // Computer (geen schermtoetsenbord): de balk staat in de knoppenrij van de vraag, naast „Controleer”
  // (in de pagina, niet zwevend), zodat de vraag niet langer wordt en er niets verspringt. Buiten een
  // vraag staat hij onder het veld.
  // Touchscreen: alleen een balk terwijl het schermtoetsenbord open is, vast direct erboven, over de
  // hele breedte en met hoofdletters. Zolang het toetsenbord nog omhoog schuift (en de browser zelf naar
  // het veld scrollt) blijft de balk onzichtbaar. Staat alles stil, dan wordt hij in één keer geplaatst,
  // scrollt de pagina zo nodig één keer zodat het veld boven de balk blijft, en pas dan verschijnt hij.
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  const keyboardOpen = () => {
    const vv = window.visualViewport;
    return !!vv && coarse() && window.innerHeight - vv.height > 120;
  };
  let settleTimer = null;
  const placeAbove = () => {
    const vv = window.visualViewport;
    bar.style.top = `${Math.round(vv.offsetTop + vv.height - bar.offsetHeight - 6)}px`;
  };
  const undock = () => {
    bar.classList.remove('docked', 'show');
    bar.style.top = '';
  };
  const settled = () => {
    if (bar.hidden || !coarse()) return;
    if (!keyboardOpen()) {
      undock();
      bar.classList.add('away');
      return;
    }
    bar.classList.remove('away');
    bar.classList.add('docked'); // nog onzichtbaar (zonder .show), maar wel meetbaar
    placeAbove();
    const r = target?.getBoundingClientRect();
    if (r) {
      const need = r.bottom - (bar.getBoundingClientRect().top - 8);
      // Niet zo ver dat het veld zelf onder de vaste balken bovenaan verdwijnt.
      const room = r.top - window.visualViewport.offsetTop - 112;
      const by = Math.min(need, room);
      if (by > 0) {
        window.scrollBy({ top: by, behavior: 'instant' });
        placeAbove();
      }
    }
    requestAnimationFrame(() => bar.classList.add('show'));
  };
  // Wachten tot het toetsenbord stilstaat (geen nieuwe resize meer): dan pas plaatsen en tonen.
  const settleSoon = (hideFirst) => {
    if (hideFirst) bar.classList.remove('show');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settled, 220);
  };
  window.visualViewport?.addEventListener('resize', () => {
    if (!bar.hidden && coarse()) settleSoon(true);
  });
  // iOS verschuift het zichtbare deel bij scrollen met open toetsenbord: de balk schuift mee.
  window.visualViewport?.addEventListener('scroll', () => {
    if (bar.classList.contains('show')) placeAbove();
  });
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches('input[type="text"], textarea')) return;
    target = e.target;
    const actions = target.closest('.item')?.querySelector(':scope > .actions');
    if (actions) {
      if (bar.parentElement !== actions) actions.append(bar);
    } else {
      // Onder de hele zin of het zinsveld; bij een tabel onder de hele tabel (een cel is te smal).
      const anchor = target.closest('.table-wrap') ?? target.closest('.sentence-input, .gap-text') ?? target;
      if (bar.previousElementSibling !== anchor) anchor.after(bar);
    }
    bar.hidden = false;
    if (!coarse()) return;
    // Ander veld terwijl het toetsenbord al open is: de balk blijft staan. Anders: wachten op het toetsenbord.
    if (bar.classList.contains('show') && keyboardOpen()) settleSoon(false);
    else {
      undock();
      bar.classList.add('away');
      settleSoon(true);
    }
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!document.activeElement?.matches('input[type="text"], textarea')) {
        bar.hidden = true;
        clearTimeout(settleTimer);
        undock();
      }
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
countVisit();
reportSpeechStatus();
// Geïnstalleerde app: de terugknop gaat naar de bovenliggende pagina (zie nav.js).
if (isStandalone()) initAppNav();
window.addEventListener('hashchange', route);
charBar();
themeToggle();
route();
// Voortgang van een ander apparaat binnengekomen: pagina's zonder invoer opnieuw tekenen.
initSync(() => {
  const path = location.hash.replace(/^#/, '').split('?')[0];
  if (['', '/', '/oefenen', '/herhalen'].includes(path) || /^\/k\/\d+$/.test(path)) route();
});
