// Menubalk bovenaan: hoofdstukken (uitklapmenu), oefenen, grammatica, voortgang, instellingen, over.
// Op smalle schermen klapt alles in achter één menuknop.
import { dueCount } from './views/practice/common.js';
import { h } from './dom.js';
import { splitTheme } from './shared.js';
import { levels } from '../app/content.js';

// Pagina's die onder een ander menu-item vallen.
const MENU_OF = { herhalen: 'oefenen', statistieken: 'voortgang', prestaties: 'voortgang', koppel: 'voortgang', luisteren: 'instellingen', verantwoording: 'over' };

export function createMenu(course) {
  const nav = document.getElementById('menu');
  const toggle = h('button', { type: 'button', class: 'menu-toggle icon-btn', 'aria-expanded': 'false', 'aria-controls': 'menu-panel', 'aria-label': 'Menu' }, '☰');
  const chaptersBtn = h('button', { type: 'button', class: 'menu-link has-sub', 'aria-expanded': 'false', 'aria-haspopup': 'true' }, 'Hoofdstukken');
  const sub = h('ul', { class: 'submenu', hidden: true },
    course.map((ch, i) => [
      levels.length && ch.level !== course[i - 1]?.level
        ? h('li', { class: 'submenu-head', role: 'presentation' }, levels.find((l) => l.id === ch.level)?.title ?? ch.level)
        : null,
      h('li', {},
        ch.available
          ? h('a', { href: `#/k/${ch.chapter}`, 'data-chapter': ch.chapter },
              h('strong', {}, `${ch.chapter} · ${splitTheme(ch.theme).name}`), h('span', {}, splitTheme(ch.theme).topics))
          : h('span', { class: 'disabled' }, h('strong', {}, `${ch.chapter} · ${splitTheme(ch.theme).name}`), h('span', {}, 'binnenkort')),
      ),
    ]),
  );
  const weakCount = h('span', { class: 'count', hidden: true });
  const links = {
    grammatica: h('a', { class: 'menu-link', href: '#/grammatica' }, 'Grammatica'),
    oefenen: h('a', { class: 'menu-link', href: '#/oefenen' }, 'Oefenen', weakCount),
    voortgang: h('a', { class: 'menu-link', href: '#/voortgang' }, 'Voortgang'),
    instellingen: h('a', { class: 'menu-link', href: '#/instellingen' }, 'Instellingen'),
    over: h('a', { class: 'menu-link', href: '#/over' }, 'Over'),
  };
  const panel = h('div', { class: 'menu-panel', id: 'menu-panel' },
    h('div', { class: 'menu-item' }, chaptersBtn, sub),
    links.oefenen, links.grammatica, links.voortgang, links.instellingen, links.over,
  );
  const theme = document.getElementById('theme');
  nav.replaceChildren(panel, theme, toggle);

  const closeSub = () => {
    sub.hidden = true;
    chaptersBtn.setAttribute('aria-expanded', 'false');
  };
  const closeAll = () => {
    closeSub();
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  chaptersBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = sub.hidden;
    sub.hidden = !open;
    chaptersBtn.setAttribute('aria-expanded', String(open));
    if (open) (sub.querySelector('a.current') ?? sub.querySelector('a'))?.focus();
  });
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (!sub.hidden || nav.classList.contains('open'))) {
      closeAll();
      chaptersBtn.focus();
    }
  });

  /** Na elke paginawissel: menu sluiten, actieve link markeren, foutenteller bijwerken. */
  return function update(path) {
    closeAll();
    const parts = path.split('/').filter(Boolean);
    const chapterNo = parts[0] === 'k' ? parts[1] : null;
    chaptersBtn.classList.toggle('active', chapterNo !== null);
    sub.querySelectorAll('a').forEach((a) => {
      const cur = a.dataset.chapter === chapterNo;
      a.classList.toggle('current', cur);
      if (cur) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    for (const [key, a] of Object.entries(links)) {
      const cur = parts[0] === key || MENU_OF[parts[0]] === key;
      a.classList.toggle('active', cur);
      if (cur) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    const n = dueCount();
    weakCount.hidden = n === 0;
    weakCount.textContent = String(n);
    weakCount.setAttribute('aria-label', `${n} vragen om vandaag te herhalen`);
  };
}
