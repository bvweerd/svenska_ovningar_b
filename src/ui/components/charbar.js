// Å Ä Ö-knoppen bij het typen.
import { h, isTouch } from '../dom.js';
import { getPref } from '../../app/progress.js';

// Aan of uit op de pagina Over (per apparaat, standaard aan). Uit: de klasse no-charbar verbergt de balk.
export const charBarOn = () => getPref('charBar', true) !== false;
export const applyCharBar = () => document.documentElement.classList.toggle('no-charbar', !charBarOn());

export function charBar() {
  applyCharBar();
  const bar = h('div', { class: 'charbar', hidden: true, role: 'toolbar', 'aria-label': 'Zweedse letters' });
  let target = null;
  // Met de muis komt de letter er al bij het indrukken (niet pas bij loslaten): wie snel verder typt,
  // krijgt de letters dan in de goede volgorde. Touch en toetsenbord gaan via click.
  let pressed = false;
  for (const c of ['å', 'ä', 'ö', 'Å', 'Ä', 'Ö']) {
    const insert = () => {
      if (!target) return;
      const s = target.selectionStart ?? target.value.length;
      const e = target.selectionEnd ?? s;
      target.value = target.value.slice(0, s) + c + target.value.slice(e);
      target.setSelectionRange(s + 1, s + 1);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus();
    };
    bar.append(h('button', {
      class: c === c.toUpperCase() ? 'upper' : null,
      type: 'button',
      onmousedown: (e) => e.preventDefault(),
      onpointerdown: (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        e.preventDefault();
        pressed = true;
        insert();
      },
      onclick: () => {
        if (pressed) {
          pressed = false;
          return;
        }
        insert();
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
  const coarse = isTouch;
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
