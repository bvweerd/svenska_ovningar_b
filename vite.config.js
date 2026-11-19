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

export default defineConfig({
  base: './',
  plugins: [yamlPlugin, pwaPlugin()],
  test: { include: ['tests/**/*.test.js', 'worker/**/*.test.js'] },
});
