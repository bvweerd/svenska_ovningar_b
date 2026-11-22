// Startpagina.
import { h } from '../dom.js';
import { course, levels } from '../../app/content.js';
import { SITE_TEXT, SIBLING } from '../../config.js';
import { homeNotices } from '../onboarding.js';
import { dueCount, streakText } from './practice/common.js';
import { progressBar, splitTheme, plural } from '../shared.js';
import { chapterProgress, getLast, canDoStatus } from '../../app/progress.js';
import { chapterHue } from '../components/chapter.js';
import { badgeSummary } from './badges.js';

export function viewHome() {
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
      // Prestaties pas tonen als er al iets gemaakt is.
      totals.done
        ? (() => {
            const b = badgeSummary();
            return h('a', { class: 'continue alt', href: '#/prestaties' },
              h('span', { class: 'eyebrow' }, 'Prestaties'),
              h('strong', {}, b.earned ? `${b.earned} van ${b.total} behaald` : 'Je eerste prestatie is dichtbij'),
              h('span', { class: 'streak-line' }, 'Wat je beheerst, doelen, toetsen en oefendagen.'));
          })()
        : null,
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
