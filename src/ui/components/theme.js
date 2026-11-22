// Licht of donker thema.
import * as storage from '../../platform/storage.js';
import { syncThemeColor } from '../../platform/pwa.js';

// Gedeeld met de andere site (zelfde domein): één keuze voor licht of donker.
const THEME_KEY = 'svensk-ovningar:theme';

export function themeToggle() {
  const btn = document.getElementById('theme');
  const apply = (t) => {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    syncThemeColor();
  };
  apply(storage.read(THEME_KEY));
  btn?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const t = dark ? 'light' : 'dark';
    apply(t);
    storage.write(THEME_KEY, t);
  });
}
