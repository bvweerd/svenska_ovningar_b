// Eén oefening: de vragen na elkaar, met uitslag en waar je daarna heen gaat.
import { h } from '../dom.js';
import { markdown, inline } from '../md.js';
import { speakButton, speedSelect, voiceNote } from '../components/speak.js';
import { speechSupported } from '../../platform/speech.js';
import { trackEvent, scoreBucket } from '../../platform/analytics.js';
import { findTopic, crumbs, progressBar, exerciseRunner, scoreMessage, missedList } from '../shared.js';
import { shuffle } from '../../core/content/build.js';
import { getResult, runState, startRun, completeRun, pickRound, setLast, roundProgress, openItems } from '../../app/progress.js';
import { claimCanDo, onwardFrom } from '../../app/course-progress.js';
import { supportAsk } from '../components/support.js';

/** Uitleg boven een ronde van een lange oefening. */
function roundIntro(size, p) {
  const start = `Een ronde van ${size} van de ${p.total} woorden: eerst wat nieuw is of fout ging.`;
  return p.seen ? `${start} Je hebt er al ${p.seen} gehad.` : `${start} Daarna kies je „Volgende ronde”.`;
}

export function viewExercise(ch, ex, query) {
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
      // Deelpunten (tabel met een paar foute vakjes): dan een percentage in plaats van „x van y”.
      const heading = h('h2', {}, !total ? 'Klaar!'
        : Number.isInteger(good) ? `Klaar! ${good} van ${total} in één keer goed.`
          : `Klaar! ${Math.round((good / total) * 100)}% goed bij de eerste poging.`);
      // Pas hier bepalen: deze oefening is nu af en telt niet meer mee als „nog te doen”.
      const to = onwardFrom(ch, ex);
      // „Verder waar je gebleven was” op de start wijst nu naar wat hierna komt, niet naar deze oefening.
      if (to.ex) setLast(`#/k/${ch.chapter}/o/${to.ex.id}`, `${ch.title} · ${to.ex.title}`);
      else if (to.chapter) setLast(`#/k/${to.chapter.chapter}`, to.chapter.title);
      else setLast(`#/k/${ch.chapter}`, ch.title);
      const ask = supportAsk(ch);
      // De knop verder, en altijd ook terug naar het hoofdstuk.
      const onward = (cls) => {
        const back = h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, 'Terug naar het hoofdstuk');
        if (to.ex) return [h('a', { class: `btn ${cls}`, href: `#/k/${ch.chapter}/o/${to.ex.id}` }, to.label), back];
        if (!to.chapter) return [h('p', { class: 'all-done' }, 'Alle hoofdstukken zijn af. Knap gedaan!'), back];
        return [h('a', { class: `btn ${cls}`, href: `#/k/${to.chapter.chapter}` }, `Hoofdstuk af! Verder met ${to.chapter.title.toLowerCase()}`), back];
      };
      if (!partial) {
        const hard = total && good / total < 0.5;
        return [
          heading,
          achieved,
          total ? progressBar(good, total, Number.isInteger(good) ? `${good} van ${total} in één keer goed` : `${Math.round((good / total) * 100)}% goed bij de eerste poging`) : null,
          h('p', {}, scoreMessage(good, total)),
          missedList(missed),
          // Lage score: eerst de uitleg en opnieuw, pas daarna verder.
          h('div', { class: 'actions' },
            hard && topicCard ? h('a', { class: 'btn primary', href: topicCard.href }, `Uitleg: ${topicCard.card.title}`) : null,
            hard ? h('a', { class: `btn ${topicCard ? 'ghost' : 'primary'}`, href: `${href}?opnieuw` }, 'Opnieuw') : null,
            onward(hard ? 'ghost' : 'primary'),
            hard ? null : h('a', { class: 'btn ghost', href: `${href}?opnieuw` }, 'Opnieuw')),
          ask,
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
          ask,
        ];
      }
      const todo = [p.fresh ? `${p.fresh} nog nieuw` : null, p.wrong ? `${p.wrong} om te herhalen` : null].filter(Boolean).join(', ');
      return [
        heading,
        achieved,
        h('p', {}, `Je hebt nu ${p.seen} van de ${p.total} woorden gehad (${todo}).`),
        progressBar(p.seen - p.wrong, p.total, `${p.seen - p.wrong} van ${p.total} woorden goed`),
        h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: `${href}?opnieuw` }, 'Volgende ronde'), onward('ghost')),
        ask,
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
    // Altijd een weg terug, ook halverwege.
    h('p', { class: 'exercise-foot' }, h('a', { class: 'btn ghost', href: `#/k/${ch.chapter}` }, `← Terug naar ${ch.title.toLowerCase()}`)),
  );
}

/** Leestekst met voorleesknop. Bij een luisteroefening is de tekst eerst verborgen. */
function passage(ex) {
  const listenMode = ex.listen && speechSupported();
  const body = h('div', { class: 'passage-body', html: markdown(ex.text) });
  const read = speakButton(ex.text, { label: listenMode ? 'Luister naar de tekst' : 'Lees voor', className: listenMode ? 'big' : '' });
  const head = h('div', { class: 'passage-head' }, ex.textTitle ? h('h2', {}, ex.textTitle) : null,
    // speech-extra: verborgen als er geen Zweedse stem is (zie platform/speech.js).
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
