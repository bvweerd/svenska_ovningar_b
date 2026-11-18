// Omhulsel rond één vraag: knop "Controleer", feedback en oplopende hulp.
import { h } from '../dom.js';
import { inline } from '../md.js';
import { RENDERERS } from './items.js';
import { speakButton, spokenText } from './speak.js';
import { reportButton } from '../report.js';

const GENERIC_WRONG = 'Nog niet goed. Probeer het nog eens.';

/**
 * Vragen die zichzelf nakijken zodra je kiest: daar is de knop Controleer overbodig.
 * (Enter blijft werken.) Bij een vervolgstap met typen of tegels komt de knop wel tevoorschijn.
 */
export function selfChecking(item) {
  switch (item.type) {
    case 'mc': case 'truefalse': case 'sort': case 'match': case 'dialogue': case 'findError': return true;
    case 'listen': return !!item.options;
    case 'gap': return (item.gaps ?? []).every((g) => g.options);
    case 'steps': return selfChecking(item.steps?.[0] ?? {});
    default: return false;
  }
}

/**
 * @param item    de vraag
 * @param ctx     { topic, findTopic(topic) → {card, href}, ref?: { ch, ex, idx } (voor foutmeldingen) }
 * @param onDone  callback({ firstTry: boolean, revealed: boolean, neutral: boolean })
 */
export function itemCard(item, ctx, number, onDone, label) {
  const topic = item.topic ?? ctx.topic;
  let check = () => {};
  let arrowNav = false; // keuze via pijltjestoetsen: niet meteen nakijken, wacht op Enter
  // Renderers roepen auto() aan zodra een antwoord compleet is (keuze gemaakt, laatste tegel gelegd).
  const r = RENDERERS[item.type](item, { ...ctx, topic, auto: () => {
    if (arrowNav) arrowNav = false;
    else check();
  } });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const checkBtn = h('button', { type: 'button', class: 'btn primary', hidden: selfChecking(item) }, 'Controleer');
  const revealBtn = h('button', { type: 'button', class: 'btn ghost', hidden: true }, 'Toon antwoord');
  const actions = h('div', { class: 'actions' }, checkBtn, revealBtn);
  const card = h('article', { class: `item type-${item.type}` },
    h('div', { class: 'item-head' },
      h('span', { class: 'item-no' }, String(number)),
      label ? h('span', { class: 'item-label' }, label) : null,
      reportButton(item, ctx.ref, number, () => card)),
    r.el, actions, feedback,
  );

  let attempts = 0;
  let hadError = false;
  let finished = false;

  const finish = (revealed) => {
    finished = true;
    r.lock();
    checkBtn.hidden = true;
    revealBtn.hidden = true;
    card.classList.add(revealed ? 'is-revealed' : 'is-done');
    // Na afloop: de goede zin beluisteren (als de browser kan voorlezen).
    const say = spokenText(item);
    const btn = say ? speakButton(say, { label: 'Beluister de zin', className: 'after' }) : null;
    if (btn) feedback.append(h('p', { class: 'listen-after' }, btn, h('span', { class: 'muted', lang: 'sv' }, say)));
    onDone({ firstTry: !hadError && !revealed, revealed, neutral: !!r.neutral });
  };

  const rule = () => {
    const found = topic && ctx.findTopic?.(topic);
    if (!found) return null;
    return h('p', { class: 'rule' },
      h('strong', {}, 'Regel: '), h('span', { html: inline(found.card.summary) }), ' ',
      h('a', { href: found.href }, 'Lees de uitleg →'),
    );
  };

  const show = (cls, ...content) => {
    feedback.className = `feedback ${cls}`;
    feedback.replaceChildren(...content.filter(Boolean));
  };

  check = () => {
    if (finished) return;
    const res = r.check();

    if (res.neutral) {
      const list = h('ul', { class: 'checks' }, res.checks.map((c) => h('li', { class: c.ok ? 'ok' : 'bad' }, c.ok ? '✓ ' : '✗ ', c.label)));
      if (res.correct) {
        show('good', h('p', {}, 'Mooi! Vergelijk je tekst met het voorbeeldantwoord.'), list);
        finish(false);
      } else {
        show('info', h('p', {}, res.tip ?? 'Je tekst is nog niet compleet:'), list);
        revealBtn.textContent = 'Klaar';
        revealBtn.hidden = false;
      }
      return;
    }

    if (res.empty) {
      show('info', h('p', {}, res.tip));
      return;
    }
    if (res.correct && res.advance) {
      attempts = 0;
      revealBtn.hidden = true;
      checkBtn.hidden = false; // de volgende stap (typen, tegels) heeft de knop wel nodig
      show('good', h('p', {}, 'Goed! Nu de volgende stap.'));
      return;
    }
    if (res.correct) {
      show('good', h('p', {}, hadError ? 'Goed zo, nu klopt het!' : 'Goed!'), item.explain ? h('p', { class: 'explain', html: inline(item.explain) }) : null);
      finish(false);
      return;
    }

    attempts++;
    hadError = true;
    if (ctx.testMode) {
      // Toets: één poging, geen tips. Het goede antwoord wordt meteen getoond.
      r.reveal();
      show('bad', h('p', {}, 'Niet goed. Het goede antwoord staat nu ingevuld.'));
      finish(true);
      return;
    }
    const tip = h('p', {}, res.tip ?? GENERIC_WRONG);
    if (attempts === 1) show('bad', tip);
    else show('bad', tip, rule());
    if (attempts >= 3) revealBtn.hidden = false;
  };

  checkBtn.addEventListener('click', check);
  card.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow') && e.target.matches('input[type="radio"]')) {
      arrowNav = true;
      return;
    }
    if (e.key === 'Enter' && e.target.matches('input[type="text"], input[type="radio"], input[type="checkbox"]')) {
      e.preventDefault();
      check();
      return;
    }
    // Cijfertoetsen kiezen een meerkeuzeoptie (niet tijdens het typen).
    if (/^[1-9]$/.test(e.key) && item.type !== 'sort' && !e.target.matches('input[type="text"], textarea, select')) {
      const radios = [...card.querySelectorAll('input[type="radio"]:not(:disabled), input[type="checkbox"]:not(:disabled)')];
      const target = radios[Number(e.key) - 1];
      if (target) {
        e.preventDefault();
        target.focus();
        target.click();
      }
    }
  });

  /** Zet de focus op het eerste invulbare element van deze vraag. */
  card.focusFirst = ({ scroll = true } = {}) => {
    const el = card.querySelector(
      'input[type="text"]:not(:disabled), textarea:not(:disabled), select:not(:disabled), input[type="radio"]:not(:disabled), input[type="checkbox"]:not(:disabled), button.chip:not(:disabled), button.move:not(:disabled)',
    );
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };
  card.isFinished = () => finished;
  revealBtn.addEventListener('click', () => {
    if (r.neutral) {
      r.reveal();
      show('info', h('p', {}, 'Vergelijk je tekst met het voorbeeldantwoord.'));
      finish(false);
      return;
    }
    r.reveal();
    show('info', h('p', {}, 'Dit is het goede antwoord. Doe de oefening later nog eens om het te herhalen.'), rule(), item.explain ? h('p', { class: 'explain', html: inline(item.explain) }) : null);
    finish(true);
  });

  return card;
}
