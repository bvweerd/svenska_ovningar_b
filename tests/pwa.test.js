// Manifest en service worker die scripts/pwa.mjs bij de build maakt.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { manifest, serviceWorker, pwaPlugin } from '../scripts/pwa.mjs';
import { APP, STORAGE_PREFIX } from '../src/config.js';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'public');

// Draait generateBundle van de plugin op een nagemaakte bundel en geeft de uitgevoerde bestanden terug.
function build(bundle) {
  const plugin = pwaPlugin();
  plugin.configResolved({ publicDir });
  const out = {};
  plugin.generateBundle.call({
    emitFile: (f) => { out[f.fileName] = f.source; },
    error: (msg) => { throw new Error(msg); },
  }, {}, bundle);
  const files = JSON.parse(out['sw.js'].match(/const FILES = (.*);/)[1]);
  const version = out['sw.js'].match(/const CACHE = PREFIX \+ "(.*)";/)[1];
  return { out, files, version };
}

const bundle = (js = 'console.log(1)') => ({
  'index.html': { type: 'asset', source: '<!doctype html>' },
  'assets/index-abc.js': { type: 'chunk', code: js },
  'assets/index-abc.js.map': { type: 'asset', source: '{}' },
  'assets/index-def.css': { type: 'asset', source: 'body{}' },
});

describe('manifest', () => {
  it('gebruikt de naam uit config.js en bestaande iconen', () => {
    const m = manifest();
    expect(m.name).toBe(APP.name);
    expect(m.short_name).toBe(APP.shortName);
    expect(m.short_name.length).toBeLessThanOrEqual(15);
    expect(m.start_url).toBe('./');
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of m.icons) expect(fs.existsSync(path.join(publicDir, icon.src)), icon.src).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'icons/apple-touch-icon.png'))).toBe(true);
  });
});

describe('service worker', () => {
  it('is geldig JavaScript', () => {
    expect(() => new Function(serviceWorker(['./', 'index.html'], 'v1'))).not.toThrow();
  });

  it('heeft een cachenaam per site, die geen voorvoegsel is van die van de andere site', () => {
    // Beide sites staan op hetzelfde domein; elke site ruimt alleen caches met zijn eigen voorvoegsel op.
    expect(STORAGE_PREFIX).not.toContain(':');
    expect(serviceWorker([], 'v1')).toContain(`const PREFIX = "${STORAGE_PREFIX}:app:";`);
  });

  it('zet alle gebouwde bestanden en iconen in de cache, zonder sourcemaps', () => {
    const { out, files } = build(bundle());
    expect(files).toEqual(expect.arrayContaining([
      './', 'index.html', 'assets/index-abc.js', 'assets/index-def.css', 'manifest.webmanifest',
      'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
    ]));
    expect(files).not.toContain('assets/index-abc.js.map');
    expect(files).not.toContain('sw.js');
    expect(JSON.parse(out['manifest.webmanifest']).name).toBe(APP.name);
  });

  it('krijgt een nieuwe versie zodra de inhoud verandert, en niet anders', () => {
    expect(build(bundle()).version).toBe(build(bundle()).version);
    expect(build(bundle('console.log(2)')).version).not.toBe(build(bundle()).version);
  });

  it('weigert een build zonder index.html', () => {
    const b = bundle();
    delete b['index.html'];
    expect(() => build(b)).toThrow(/index.html/);
  });
});
