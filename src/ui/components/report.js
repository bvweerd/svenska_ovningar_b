// „Meld een fout”: een klein formulier per vraag. De melding gaat naar een Cloudflare Worker,
// die er een GitHub-issue van maakt (zie worker/). Gebruikers hebben geen account nodig.
import { h } from '../dom.js';
import { REPORT_URL, TURNSTILE_SITEKEY, REPORT_REPO } from '../../config.js';
import { trackEvent } from '../../platform/analytics.js';

export const reportConfigured = () => !!(REPORT_URL && TURNSTILE_SITEKEY);

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Wat de gebruiker op dit moment heeft ingevuld of gekozen, zo goed mogelijk als tekst. */
export function currentAnswer(root) {
  const parts = [];
  root.querySelectorAll('.chips.line').forEach((line) => {
    const words = [...line.querySelectorAll('.chip')].map((c) => clean(c.textContent)).filter(Boolean);
    if (words.length) parts.push(words.join(' '));
  });
  const picked = root.querySelector('.chips.find-error .chip.selected');
  if (picked) parts.push(`aangeklikt woord: ${clean(picked.textContent)}`);
  root.querySelectorAll('input[type="text"], textarea').forEach((el) => {
    if (clean(el.value)) parts.push(clean(el.value));
  });
  root.querySelectorAll('select').forEach((el) => {
    const opt = el.selectedOptions?.[0];
    if (opt && opt.value !== '') parts.push(clean(opt.textContent));
  });
  root.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach((el) => {
    const label = el.closest('label');
    parts.push(clean(label ? label.textContent : el.value));
  });
  return parts.join(' | ');
}

/** Gegevens die naar de Worker gaan. */
export function reportPayload({ item, ref, number, message, answer, token, page }) {
  return {
    repo: REPORT_REPO,
    shownNumber: Number.isInteger(number) ? number : null,
    message: String(message ?? '').trim(),
    answer: answer || '',
    page,
    chapter: ref?.ch ?? null,
    exercise: ref?.ex?.id ?? null,
    exerciseTitle: ref?.ex?.title ?? null,
    itemIndex: Number.isInteger(ref?.idx) ? ref.idx : null,
    itemId: item?.id !== undefined && item?.id !== null ? String(item.id) : null,
    itemType: item?.type ?? null,
    item: JSON.stringify(item, null, 2),
    token,
  };
}

// ---------- Turnstile ----------
let turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => {
      turnstileLoading = null;
      reject(new Error('Turnstile kon niet laden'));
    };
    document.head.append(s);
  });
  return turnstileLoading;
}

// ---------- Formulier ----------
let dialog = null;

function openDialog({ item, ref, number, card }) {
  if (dialog?.open) dialog.close(); // ruimt ook de Turnstile-widget op (zie het close-event hieronder)
  const answer = currentAnswer(card);
  let token = '';
  let widgetId = null;
  let waiting = false; // op Versturen geklikt voordat Turnstile klaar was: verstuur zodra het token er is

  const textarea = h('textarea', {
    class: 'answer-input', rows: 4, maxlength: 2000, required: true,
    placeholder: 'Bijv.: „Ook vem som is hier goed”, of: „De vertaling klopt niet”.',
  });
  const status = h('p', { class: 'report-status', 'aria-live': 'polite' });
  const send = h('button', { type: 'submit', class: 'btn primary' }, 'Versturen');
  const cancel = h('button', { type: 'button', class: 'btn ghost', onclick: () => dlg.close() }, 'Annuleren');
  const widget = h('div', { class: 'turnstile' });

  const form = h('form', { method: 'dialog', class: 'report-form' },
    h('h2', {}, 'Meld een fout'),
    h('p', { class: 'muted small' },
      ref ? `${ref.ex.title}, vraag ${number}. ` : `Vraag ${number}. `,
      'De vraag en je antwoord worden automatisch meegestuurd.'),
    h('label', {}, h('span', {}, 'Wat klopt er niet?'), textarea),
    answer ? h('p', { class: 'muted small' }, 'Jouw antwoord: ', h('span', { lang: 'sv' }, answer)) : null,
    widget,
    h('p', { class: 'muted small' }, 'Je melding wordt een openbaar issue op GitHub. Zet er geen persoonlijke gegevens in.'),
    status,
    h('div', { class: 'actions' }, send, cancel),
  );

  const setStatus = (cls, text) => {
    status.className = `report-status ${cls}`;
    status.textContent = text;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (textarea.value.trim().length < 3) {
      setStatus('bad', 'Schrijf kort wat er niet klopt.');
      textarea.focus();
      return;
    }
    if (!token) {
      waiting = true;
      send.disabled = true;
      setStatus('info', 'Even controleren of je geen robot bent…');
      return;
    }
    waiting = false;
    send.disabled = true;
    setStatus('info', 'Bezig met versturen…');
    try {
      const res = await fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload({ item, ref, number, message: textarea.value, answer, token, page: location.href })),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || res.status);
      trackEvent('melding/verstuurd', 'Foutmelding');
      form.replaceChildren(
        h('h2', {}, 'Bedankt!'),
        h('p', {}, 'Je melding is ontvangen. Ik kijk ernaar en pas de oefening aan als dat nodig is.'),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: () => dlg.close() }, 'Sluiten')),
      );
      form.querySelector('.btn.primary').focus();
    } catch (err) {
      // De foutcode van de Worker (bijv. turnstile, github) helpt bij het zoeken naar de oorzaak.
      setStatus('bad', `Versturen is niet gelukt (${err.message || 'netwerk'}). Probeer het later nog eens.`);
      send.disabled = false;
      token = '';
      if (widgetId !== null) window.turnstile?.reset(widgetId);
    }
  });

  const dlg = h('dialog', { class: 'report-dialog', 'aria-label': 'Meld een fout' }, form);
  dialog = dlg;
  dlg.addEventListener('close', () => {
    if (widgetId !== null) window.turnstile?.remove(widgetId);
    dlg.remove();
    if (dialog === dlg) dialog = null;
  });
  document.body.append(dlg);
  dlg.showModal();
  textarea.focus();

  loadTurnstile()
    .then((ts) => {
      if (!dlg.isConnected) return; // al gesloten
      widgetId = ts.render(widget, {
        sitekey: TURNSTILE_SITEKEY,
        language: 'nl',
        appearance: 'interaction-only',
        callback: (t) => {
          token = t;
          if (waiting) form.requestSubmit();
        },
        'expired-callback': () => { token = ''; },
        'error-callback': () => {
          token = '';
          waiting = false;
          send.disabled = false;
          setStatus('bad', 'De controle tegen spam lukte niet. Probeer het later nog eens.');
        },
      });
    })
    .catch(() => {
      waiting = false;
      send.disabled = false;
      setStatus('bad', 'De controle tegen spam kon niet laden. Staat er een blocker aan?');
    });
}

/** Knopje voor in de kop van een vraag; null als meldingen niet zijn ingesteld. */
export function reportButton(item, ref, number, getCard) {
  if (!reportConfigured()) return null;
  return h('button', {
    type: 'button',
    class: 'link-btn report-btn',
    title: 'Meld een fout in deze vraag',
    onclick: () => openDialog({ item, ref, number, card: getCard() }),
  }, 'Fout gezien?');
}
