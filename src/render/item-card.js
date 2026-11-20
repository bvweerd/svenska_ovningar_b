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
  // ready(): alle tegels liggen; niet vanzelf nakijken (je wilt misschien nog schuiven), wel de
  // knop Controleer klaarzetten.
  const r = RENDERERS[item.type](item, { ...ctx, topic, auto: () => {
    if (arrowNav) arrowNav = false;
    else check();
  }, ready: () => {
    if (!checkBtn.hidden) checkBtn.focus({ preventScroll: true });
  } });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  // Vrij schrijven wordt niet nagekeken („Klaar”) en mag je overslaan („Toon voorbeeld”).
  const checkBtn = h('button', { type: 'button', class: 'btn primary', hidden: selfChecking(item) }, r.neutral ? 'Klaar' : 'Controleer');
  const revealBtn = h('button', { type: 'button', class: 'btn ghost', hidden: !r.neutral }, r.neutral ? 'Toon voorbeeld' : 'Toon antwoord');
  // Vragen met de knop Controleer houden hun knoppenrij altijd even hoog, ook als de knop na
  // afloop verdwijnt: dan verspringt de rest van de pagina niet.
  const actions = h('div', { class: selfChecking(item) ? 'actions' : 'actions keep' }, checkBtn, revealBtn);
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
    fieldWatcher.disconnect();
    // Stond de cursor in een tekstveld van deze vraag (toetsenbord open)? Dan mag het volgende veld hem overnemen.
    const active = document.activeElement;
    const typed = !!active?.matches?.('input[type="text"], textarea') && card.contains(active);
    r.lock();
    checkBtn.hidden = true;
    revealBtn.hidden = true;
    card.classList.add(revealed ? 'is-revealed' : 'is-done');
    // Na afloop: de goede zin beluisteren (als de browser kan voorlezen).
    const say = spokenText(item);
    const btn = say ? speakButton(say, { label: 'Beluister de zin', className: 'after' }) : null;
    if (btn) feedback.append(h('p', { class: 'listen-after speech-extra' }, btn, h('span', { class: 'muted', lang: 'sv' }, say)));
    onDone({ firstTry: !hadError && !revealed, revealed, neutral: !!r.neutral, typed });
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

    // Vrij schrijven: geen oordeel, alleen het voorbeeld om mee te vergelijken.
    if (res.neutral) {
      show('info', h('p', {}, 'Vergelijk je tekst met het voorbeeldantwoord.'));
      finish(false);
      return;
    }

    // Leeg, of goed Zweeds in een andere volgorde dan de opdracht vraagt: geen fout, nog een keer.
    if (res.empty || res.retry) {
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
      show('good', h('p', {}, hadError ? 'Goed zo, nu klopt het!' : 'Goed!'), res.note ? h('p', { class: 'muted' }, res.note) : null, item.explain ? h('p', { class: 'explain', html: inline(item.explain) }) : null);
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
    // Eerste fout met een eigen tip: alleen die tip. Zonder eigen tip meteen de regel erbij,
    // anders leert de leerling niets van de eerste poging.
    if (attempts === 1 && res.tip) show('bad', tip);
    else show('bad', tip, rule());
    if (attempts >= 3) revealBtn.hidden = false;
  };

  checkBtn.addEventListener('click', check);
  card.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow') && e.target.matches('input[type="radio"]')) {
      // De browser verplaatst de keuze (en stuurt change) direct na deze toets. Gebeurt dat niet,
      // bijvoorbeeld bij de laatste optie, dan mag de vlag de volgende klik niet blokkeren.
      arrowNav = true;
      setTimeout(() => { arrowNav = false; }, 0);
      return;
    }
    if (e.key === 'Enter' && e.target.matches('input[type="text"], input[type="radio"], input[type="checkbox"]')) {
      e.preventDefault();
      // Meerdere velden in één vraag: eerst naar het volgende lege veld, pas daarna nakijken.
      if (e.target.matches('input[type="text"]') && e.target.value.trim()) {
        const fields = [...card.querySelectorAll('input[type="text"]:not(:disabled)')];
        const nextEmpty = fields.slice(fields.indexOf(e.target) + 1).find((f) => !f.value.trim());
        if (nextEmpty) {
          nextEmpty.focus();
          return;
        }
      }
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

  // Telefoontoetsenbord: „Volgende” als er in deze vraag nog een veld na komt, anders „Klaar”.
  // Zonder deze hint springt de knop naar het volgende veld op de pagina zonder dat er wordt nagekeken.
  const labelEnterKeys = () => {
    const fields = [...card.querySelectorAll('input[type="text"]')];
    fields.forEach((f, i) => f.setAttribute('enterkeyhint', i < fields.length - 1 ? 'next' : 'done'));
  };
  labelEnterKeys();
  const fieldWatcher = new MutationObserver(labelEnterKeys);
  fieldWatcher.observe(card, { childList: true, subtree: true });

  const firstField = () => card.querySelector(
    'input[type="text"]:not(:disabled), textarea:not(:disabled), select:not(:disabled), input[type="radio"]:not(:disabled), input[type="checkbox"]:not(:disabled), button.chip:not(:disabled), button.move:not(:disabled)',
  );
  /**
   * Zet de focus op het eerste invulbare element van deze vraag.
   * @param keyboard  ook op een telefoon een tekstveld focussen (toetsenbord open): alleen als de gebruiker
   *                  net typte of zelf op „Volgende vraag” tikte.
   */
  card.focusFirst = ({ scroll = true, keyboard = false } = {}) => {
    const el = firstField();
    // Bovenaan het scherm (onder de vaste balken, zie scroll-margin-top), zodat er zoveel mogelijk ruimte onder de vraag is.
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Op een telefoon anders geen tekstveld focussen: dan springt het toetsenbord open en schuift alles.
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (touch && !keyboard && el?.matches('input[type="text"], textarea')) return;
    el?.focus({ preventScroll: true });
  };
  /** Begint deze vraag met een tekstveld? Zet de cursor erin zonder te scrollen (het toetsenbord blijft open). */
  card.takeKeyboard = () => {
    const el = firstField();
    if (!el?.matches('input[type="text"], textarea')) return false;
    el.focus({ preventScroll: true });
    return true;
  };
  card.isFinished = () => finished;
  /** Knop om zelf verder te gaan op een telefoon (als het vanzelf verder gaan is afgebroken), op de plek van Controleer. */
  card.offerNext = (text, go) => {
    const btn = h('button', { type: 'button', class: 'btn ghost next-btn', onclick: go }, text);
    actions.append(btn);
  };
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
