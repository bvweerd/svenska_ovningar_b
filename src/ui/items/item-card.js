// Omhulsel rond één vraag: knop "Controleer", feedback en oplopende hulp.
import { h, isTouch } from '../dom.js';
import { inline } from '../md.js';
import { RENDERERS } from './index.js';
import { speakButton } from '../components/speak.js';
import { spokenText, selfChecking, hintFor, isGradable } from '../../core/items/index.js';
import { reportButton } from '../components/report.js';

const GENERIC_WRONG = 'Nog niet goed.';

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
  // Vrij schrijven kijkt de app niet na (register: gradable: false).
  const neutral = !isGradable(item);
  const checkBtn = h('button', { type: 'button', class: 'btn primary', hidden: selfChecking(item) }, neutral ? 'Klaar' : 'Controleer');
  const revealBtn = h('button', { type: 'button', class: 'btn ghost small', hidden: !neutral }, neutral ? 'Toon voorbeeld' : 'Toon antwoord');
  // Vragen met de knop Controleer houden hun knoppenrij altijd even hoog, ook als de knop na
  // afloop verdwijnt: dan verspringt de rest van de pagina niet.
  // Hint: het begin van het antwoord (of een eigen help-tekst). Wie hem gebruikt, heeft de vraag niet
  // „in één keer goed”: hij telt als goed na hulp en komt in de herhaling terug. Niet in een toets.
  const hint = ctx.testMode ? null : hintFor(item);
  const hintBox = h('p', { class: 'hint-help', hidden: true, 'aria-live': 'polite' });
  const hintBtn = hint ? h('button', { type: 'button', class: 'btn ghost small hint-btn' }, 'Hint') : null;
  // Later: de vraag naar het eind van de ronde (telt niet mee). Handig als je even niet kunt luisteren,
  // of als je eerst de rest wilt doen. Niet in een toets.
  const skipBtn = ctx.onSkip && !ctx.testMode
    ? h('button', { type: 'button', class: 'btn ghost small skip-btn', title: 'Deze vraag komt aan het eind van de ronde terug' },
        item.type === 'listen' ? 'Nu niet luisteren' : 'Later')
    : null;
  const actions = h('div', { class: selfChecking(item) ? 'actions' : 'actions keep' }, checkBtn, hintBtn, revealBtn, skipBtn);
  // Een knop aantikken haalt de cursor niet uit het tekstveld: op een telefoon blijft het toetsenbord
  // dan open en verspringt het scherm niet.
  for (const b of [checkBtn, hintBtn]) {
    b?.addEventListener('mousedown', (e) => {
      if (document.activeElement?.matches?.('input[type="text"], textarea') && card.contains(document.activeElement)) e.preventDefault();
    });
  }
  const card = h('article', { class: `item type-${item.type}` },
    h('div', { class: 'item-head' },
      h('span', { class: 'item-no' }, String(number)),
      // Op een telefoon één regel (met …); tik erop voor de hele opdracht. De vraag zelf zegt meestal genoeg.
      label ? h('span', { class: 'item-label', title: label, onclick: (e) => e.currentTarget.classList.toggle('open') }, label) : null,
      reportButton(item, ctx.ref, number, () => card)),
    r.el, hintBox, actions, feedback,
  );

  let attempts = 0;
  let hadError = false;
  // Vraag met meer vakjes (tabel, meer gaten): welk deel was bij de eerste poging goed? Telt naar rato
  // mee in de score van de oefening, zodat één fout in een tabel niet 0% geeft.
  let share;
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
    if (hintBtn) hintBtn.hidden = true;
    if (skipBtn) skipBtn.hidden = true;
    card.classList.add(revealed ? 'is-revealed' : 'is-done');
    // Na afloop: de goede zin beluisteren (als de browser kan voorlezen).
    const say = spokenText(item);
    const btn = say ? speakButton(say, { label: 'Beluister de zin', className: 'after' }) : null;
    if (btn) feedback.append(h('p', { class: 'listen-after speech-extra' }, btn, h('span', { class: 'muted', lang: 'sv' }, say)));
    onDone({ firstTry: !hadError && !revealed, revealed, neutral, typed, share: revealed ? undefined : share });
  };

  const rule = () => {
    const found = topic && ctx.findTopic?.(topic);
    if (!found) return null;
    return h('p', { class: 'rule' },
      h('strong', {}, 'Regel: '), h('span', { html: inline(found.card.summary) }), ' ',
      h('a', { href: found.href }, 'Lees de uitleg →'),
    );
  };

  const explain = () => (item.explain ? h('p', { class: 'explain', html: inline(item.explain) }) : null);
  const finishNeutral = () => {
    show('info', h('p', {}, 'Vergelijk je tekst met het voorbeeldantwoord.'));
    finish(false);
  };

  const show = (cls, ...content) => {
    feedback.className = `feedback ${cls}`;
    feedback.replaceChildren(...content.filter(Boolean));
  };

  check = () => {
    if (finished) return;
    const res = r.check();

    // Vrij schrijven: geen oordeel, alleen het voorbeeld om mee te vergelijken.
    if (res.neutral) return finishNeutral();

    // Leeg, of goed Zweeds in een andere volgorde dan de opdracht vraagt: geen fout, nog een keer.
    if (res.empty || res.retry) {
      show('info', h('p', { html: inline(res.tip) }));
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
      show('good', h('p', {}, hadError ? 'Goed zo, nu klopt het!' : 'Goed!'), res.note ? h('p', { class: 'muted' }, res.note) : null, explain());
      finish(false);
      return;
    }

    if (attempts === 0 && !hadError) share = res.share;
    attempts++;
    hadError = true;
    if (ctx.testMode) {
      // Toets: één poging, geen tips. Het goede antwoord wordt meteen getoond.
      r.reveal();
      show('bad', h('p', {}, 'Niet goed. Het goede antwoord staat nu ingevuld.'));
      finish(true);
      return;
    }
    // Tips mogen *cursief* en **vet** bevatten (zoals in de taken); inline() escapet eerst.
    const tip = h('p', { html: inline(res.tip ?? GENERIC_WRONG) });
    // Wat nu? Voor wie net begint is niet vanzelf duidelijk dat je zelf verbetert.
    const next = h('p', { class: 'next-step' }, selfChecking(item) && !card.querySelector('input[type="text"]:not(:disabled)')
      ? 'Kies opnieuw.'
      : attempts >= 3 ? 'Verbeter je antwoord, of kijk naar het goede antwoord.' : 'Verbeter je antwoord en kijk opnieuw na.');
    // Eerste fout met een eigen tip: alleen die tip. Zonder eigen tip meteen de regel erbij,
    // anders leert de leerling niets van de eerste poging.
    if (attempts === 1 && res.tip) show('bad', tip, next);
    else show('bad', tip, rule(), next);
    if (attempts >= 3) revealBtn.hidden = false;
  };

  checkBtn.addEventListener('click', check);
  skipBtn?.addEventListener('click', () => ctx.onSkip(card));
  hintBtn?.addEventListener('click', () => {
    hadError = true;
    hintBtn.hidden = true;
    hintBox.replaceChildren(h('strong', {}, 'Hint: '), h('span', { html: inline(hint) }), ' ',
      h('span', { class: 'muted small' }, 'Met hint telt deze vraag als goed na hulp; hij komt in de herhaling terug.'));
    hintBox.hidden = false;
    card.querySelector('input[type="text"]:not(:disabled), textarea:not(:disabled)')?.focus({ preventScroll: true });
  });
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
    const touch = isTouch();
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
    r.reveal();
    if (neutral) return finishNeutral();
    show('info', h('p', {}, 'Dit is het goede antwoord. Doe de oefening later nog eens om het te herhalen.'), rule(), explain());
    finish(true);
  });

  return card;
}
