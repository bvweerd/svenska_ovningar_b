import { defineConfig } from 'vite';
import yaml from 'js-yaml';

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
  plugins: [yamlPlugin],
  test: { include: ['tests/**/*.test.js'] },
});
