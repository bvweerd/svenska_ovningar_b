// Overzicht van de oefenvormen.
import { h } from '../../dom.js';
import { practiceEntries } from '../../../app/content.js';
import { crumbs } from '../../shared.js';
import { srsStats, getTest } from '../../../app/progress.js';
import { available, plural, chapterChips, streakText, dueCount } from './common.js';
import { openMistakes } from '../../../app/course-progress.js';

export function viewPracticeHub() {
  document.title = 'Oefenen · Svenska övningar';
  const entries = practiceEntries();
  const due = dueCount();
  const known = srsStats(entries).reduce((a, b) => a + b, 0);
  const weak = openMistakes().length;
  // quiet: er valt nog niets te doen; de kaart blijft een link (met uitleg), maar valt minder op.
  const tool = (href, title, text, badge, quiet = false) =>
    h('a', { class: `tool-card${quiet ? ' quiet' : ''}`, href },
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
        due ? `${plural(due, 'vraag staat', 'vragen staan')} voor vandaag klaar.` : known ? 'Voor vandaag ben je klaar. Morgen staan er weer vragen klaar.' : 'Nog leeg. Maak eerst een paar oefeningen: die komen hier vanzelf terug.', due, !due),
      tool('#/herhalen', 'Oefen je fouten', weak ? `${plural(weak, 'vraag', 'vragen')} die je eerder fout had.` : 'Nog leeg. Vragen die je fout hebt, komen hier terug.', weak, !weak),
      tool('#/oefenen/werkwoorden', 'Werkwoordtrainer', 'Oefen werkwoordsvormen zo lang je wilt, met de tijden die jij kiest.'),
      tool('#/oefenen/spel', 'Snelle rondes', '60 seconden: en of ett, betekenis of verleden tijd. Haal je record?'),
      tool('#/oefenen/luisteren', 'Dictee', 'Luister naar een zin of woord en schrijf op wat je hoort.'),
    ),
    h('section', { class: 'block' },
      h('h2', {}, 'Flitskaarten'),
      h('p', { class: 'muted' }, 'De woordenlijst van een hoofdstuk: kies de goede betekenis, de app kijkt na.'),
      chapterChips(available().filter((c) => c.vocab?.length), (c) => `#/k/${c.chapter}/kaarten`)),
    h('section', { class: 'block' },
      h('h2', {}, 'Toetsen'),
      h('p', { class: 'muted' }, 'Twintig vragen per hoofdstuk, zonder tips, met een rapport per onderwerp.'),
      chapterChips(available(), (c) => `#/k/${c.chapter}/toets`, (c) => {
        const t = getTest(c.chapter);
        return t ? h('span', { class: 'chip-score' }, `${Math.round(t.best * 100)}%`) : null;
      })),
  );
}
