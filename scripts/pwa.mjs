// Maakt de site installeerbaar als app (PWA) en offline bruikbaar.
//
// Bij `vite build`:
// - manifest.webmanifest met naam en iconen uit src/config.js (APP) en public/icons/;
// - sw.js: een service worker die alle gebouwde bestanden bij installatie in de cache zet
//   en daarna uit de cache serveert (ook zonder internet);
// - in index.html de links naar het manifest en het iPhone-icoon.
// Bij elke nieuwe build verandert de cachenaam; de app meldt dan dat er een nieuwe versie is (src/pwa.js).
// In de ontwikkelserver gebeurt niets van dit alles.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { APP, STORAGE_PREFIX } from '../src/config.js';

// Gelijk aan --surface (bovenbalk) en --bg in src/styles.css, licht en donker.
const THEME = { light: '#ffffff', dark: '#1b2029' };
const BACKGROUND = '#f7f6f2';

function publicFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? publicFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

export function manifest() {
  return {
    id: './',
    name: APP.name,
    short_name: APP.shortName,
    description: APP.description,
    lang: 'nl',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: BACKGROUND,
    theme_color: THEME.light,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** De service worker als tekst. `files` zijn paden ten opzichte van de map van sw.js. */
export function serviceWorker(files, version) {
  // Beide sites staan op hetzelfde domein en delen dus de caches: elke site ruimt alleen zijn eigen caches op.
  const prefix = `${STORAGE_PREFIX}:app:`;
  return `// Gegenereerd door scripts/pwa.mjs bij de build.
const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const SCOPE = new URL('./', self.location).href;
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(new URL(f, SCOPE), { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// De pagina vraagt dit als je op „Bijwerken” klikt.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  const page = req.url.split(/[?#]/)[0];
  if (req.mode === 'navigate' && (page === SCOPE || page === INDEX)) {
    // De site gebruikt #-routes: elke pagina is index.html. Andere adressen (een icoon, het manifest) gewoon als bestand.
    event.respondWith(caches.open(CACHE).then((c) => c.match(INDEX)).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
});
`;
}

export function pwaPlugin() {
  let publicDir = '';
  return {
    name: 'pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
        // src/pwa.js (syncThemeColor) zet dit bij het laden gelijk aan het gekozen thema.
        { tag: 'meta', attrs: { name: 'theme-color', content: THEME.light, media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: THEME.dark, media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './icons/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: APP.shortName }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      ];
    },
    generateBundle(_options, bundle) {
      const manifestText = `${JSON.stringify(manifest(), null, 2)}\n`;
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestText });

      const hash = createHash('sha256');
      const files = ['./'];
      const add = (name, content) => {
        files.push(name);
        hash.update(name).update('\0').update(content).update('\0');
      };
      for (const [name, out] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        // Het manifest staat er na emitFile soms al in; het komt hieronder er één keer bij.
        if (name.endsWith('.map') || name === 'manifest.webmanifest') continue;
        add(name, out.type === 'chunk' ? out.code : out.source);
      }
      add('manifest.webmanifest', manifestText);
      for (const name of publicFiles(publicDir).sort()) add(name, fs.readFileSync(path.join(publicDir, name)));
      if (!files.includes('index.html')) this.error('pwa: index.html ontbreekt in de build');
      const version = hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(files, version) });
    },
  };
}
