import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import yaml from 'js-yaml';
import { pwaPlugin } from './scripts/pwa.mjs';

// Laadt .yaml-bestanden als JavaScript-objecten.
const yamlPlugin = {
  name: 'yaml',
  transform(code, id) {
    if (!id.endsWith('.yaml')) return null;
    return { code: `export default ${JSON.stringify(yaml.load(code))};`, map: null };
  },
};

// Versie voor de pagina Over: major.minor uit package.json, het laatste getal is het aantal
// commits (loopt bij elke wijziging op). In GitHub Actions is daarvoor fetch-depth: 0 nodig.
function appVersion() {
  const [major, minor] = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version.split('.');
  let build = '0';
  try {
    build = execSync('git rev-list --count HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // geen git beschikbaar
  }
  return `${major}.${minor}.${build}`;
}

export default defineConfig({
  define: { 'import.meta.env.APP_VERSION': JSON.stringify(appVersion()) },
  base: './',
  plugins: [yamlPlugin, pwaPlugin()],
  test: { include: ['tests/**/*.test.js', 'worker/**/*.test.js'] },
});
