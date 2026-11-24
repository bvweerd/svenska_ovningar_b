// Werkwoordtrainer.
import { h, isTouch } from '../../dom.js';
import { verbs } from '../../../app/content.js';
import { crumbs, findTopic } from '../../shared.js';
import { itemCard } from '../../items/item-card.js';
import { getPref, setPref } from '../../../app/progress.js';
import { TENSES, KINDS, pickVerbItem, withNewKinds } from '../../../core/verbs.js';
import { trackEvent } from '../../../platform/analytics.js';

export function viewVerbTrainer() {
  document.title = 'Werkwoordtrainer · Svenska övningar';
  // Alleen soorten die in deze site voorkomen (partikelwerkwoorden alleen op B1–B2).
  const kindKeys = Object.keys(KINDS).filter((k) => verbs.some((v) => v.kind === k));
  // Een soort die er later bij kwam, staat ook bij bestaande instellingen aan.
  const saved = getPref('verbs', null);
  const settings = withNewKinds(saved ?? { tenses: ['pres', 'pret', 'sup'], kinds: kindKeys }, kindKeys);
  if (saved && JSON.stringify(saved) !== JSON.stringify(settings)) setPref('verbs', settings);
  let done = 0;
  let good = 0;
  let run = 0;
  let bestRun = 0;
  let last = null;
  let pendingNext = null; // de ingeplande volgende vraag na een antwoord
  const stats = h('div', { class: 'score', 'aria-live': 'polite' });
  const list = h('div', { class: 'items' });
  const updateStats = () => {
    stats.replaceChildren(h('span', {}, `${done} gedaan · ${good} in één keer goed · reeks ${run} (beste ${bestRun})`));
  };
  const next = () => {
    clearTimeout(pendingNext);
    pendingNext = null;
    if (done > 0 && !list.isConnected) return; // pagina verlaten
    const q = pickVerbItem(verbs, settings, Math.random, last);
    if (!q) {
      list.replaceChildren(h('p', { class: 'muted' }, 'Kies minstens één tijd en één soort werkwoord.'));
      return;
    }
    last = q.verb.inf;
    const card = itemCard(q.item, { topic: q.item.topic, findTopic: (t) => findTopic(t) }, done + 1, (r) => {
      done++;
      trackEvent(`werkwoord/${q.tense}/${q.verb.inf.replaceAll(' ', '-')}/${r.firstTry ? 'goed' : r.revealed ? 'bekeken' : 'fout'}`, `${q.verb.inf} (${q.verb.nl}) · ${TENSES[q.tense].label}`);
      if (r.firstTry) {
        good++;
        run++;
        bestRun = Math.max(bestRun, run);
      } else run = 0;
      updateStats();
      pendingNext = setTimeout(next, r.revealed ? 1800 : 600);
    });
    list.prepend(card);
    [...list.children].slice(3).forEach((c) => c.remove());
    [...list.children].slice(1).forEach((c) => c.classList.add('previous'));
    card.focusFirst({ scroll: false });
  };
  // Samenvatting van de instellingen, zodat het paneel op de telefoon dicht kan blijven.
  let settingsBox;
  const settingsSummary = h('summary', {});
  const summarize = () => {
    const tenses = settings.tenses.map((t) => TENSES[t]?.label.replace(/ \(.*\)/, '')).join(', ') || 'geen tijden';
    const chosen = kindKeys.filter((k) => settings.kinds.includes(k)).length;
    const kinds = chosen === kindKeys.length ? 'alle soorten' : `${chosen} van ${kindKeys.length} soorten`;
    settingsSummary.replaceChildren(h('strong', {}, 'Instellingen'), h('span', { class: 'muted' }, ` · ${tenses} · ${kinds}`));
  };
  const checkbox = (group, key, label) => {
    const box = h('input', {
      type: 'checkbox',
      checked: settings[group].includes(key),
      onchange: () => {
        settings[group] = box.checked ? [...new Set([...settings[group], key])] : settings[group].filter((k) => k !== key);
        setPref('verbs', settings);
        summarize();
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
    settingsBox = h('details', { class: 'settings', open: !isTouch() },
      settingsSummary,
      h('fieldset', {}, h('legend', {}, 'Tijden'), h('div', { class: 'options row' }, Object.entries(TENSES).map(([k, t]) => checkbox('tenses', k, t.label)))),
      h('fieldset', {}, h('legend', {}, 'Soorten werkwoorden'), h('div', { class: 'options row' }, kindKeys.map((k) => checkbox('kinds', k, KINDS[k]))))),
    stats, list,
  );
  summarize();
  updateStats();
  setTimeout(next, 0);
  return view;
}
