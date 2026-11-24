// Voortgang: statistieken, prestaties, synchroniseren en je voortgang bewaren of wissen.
import { h } from '../dom.js';
import { course, practiceEntries } from '../../app/content.js';
import { crumbs, plural } from '../shared.js';
import { syncConfigured, getCode, forgetCode } from '../../platform/sync.js';
import { isStandalone } from '../../platform/pwa.js';
import { resetProgress, exportProgress, importProgress, migrateToIds, srsStats } from '../../app/progress.js';
import { syncSection } from './sync.js';
import { badgeSummary } from './badges.js';

const card = (href, title, text) =>
  h('a', { class: 'tool-card', href }, h('span', { class: 'tool-title' }, title), h('span', { class: 'tool-text' }, text));

export function viewProgress() {
  document.title = 'Voortgang · Svenska övningar';
  const known = srsStats(practiceEntries()).reduce((a, b) => a + b, 0);
  const b = badgeSummary();
  return h('div', {},
    crumbs({ label: 'Start', href: '#/' }, { label: 'Voortgang' }),
    h('header', { class: 'page-head' },
      h('h1', {}, 'Voortgang'),
      h('p', { class: 'lead' }, 'Hoe het gaat, wat je al hebt behaald en je voortgang op meer apparaten.')),
    h('div', { class: 'tools' },
      card('#/statistieken', 'Jouw statistieken',
        known ? `${plural(known, 'vraag', 'vragen')} in de herhaling. Per hoofdstuk wat je beheerst en wat nog lastig is.`
          : 'Hoeveel vragen in welke doos zitten, per hoofdstuk wat je beheerst, en wat nog lastig is.'),
      card('#/prestaties', 'Prestaties', `${b.earned} van ${b.total} behaald. Wat je beheerst, doelen, toetsen en oefendagen.`)),
    h('section', { class: 'block prose' },
      h('h2', {}, 'Waar staat je voortgang?'),
      h('p', {}, `Je voortgang wordt per vraag opgeslagen ${isStandalone() ? 'in deze app' : 'in deze browser'}. Ga je halverwege een oefening weg, dan ga je later verder waar je gebleven was.`),
      syncConfigured() ? syncSection() : null,
      h('h3', {}, 'Exporteren en importeren'),
      h('p', {}, 'Je kunt je voortgang ook als bestand bewaren en op een ander apparaat importeren. Importeren voegt samen: wat je op dit apparaat al gedaan hebt, blijft staan, en per vraag telt je laatste poging.'),
      progressTools()),
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
