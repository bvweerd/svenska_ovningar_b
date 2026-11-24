// Licht of donker thema.
import * as storage from '../../platform/storage.js';
import { syncThemeColor } from '../../platform/pwa.js';

// Gedeeld met de andere site (zelfde domein): één keuze voor licht of donker.
const THEME_KEY = 'svensk-ovningar:theme';

const apply = (t) => {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  syncThemeColor();
};

/** Gekozen thema: 'light', 'dark' of '' (automatisch, zoals het apparaat). */
export const getTheme = () => storage.read(THEME_KEY) || '';

export function setTheme(t) {
  apply(t);
  if (t) storage.write(THEME_KEY, t);
  else storage.remove(THEME_KEY);
}

export function themeToggle() {
  const btn = document.getElementById('theme');
  apply(getTheme());
  btn?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'light' : 'dark');
  });
}
