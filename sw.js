/*
 * Service worker minimale: cache-first per gli asset dell'app, così dopo
 * il primo caricamento funziona anche senza rete. I file lingua OCR
 * (lib/lang/*.traineddata.gz) vengono messi in cache al primo utilizzo
 * effettivo dell'OCR, non qui, per non forzarne il download se l'OCR non
 * viene mai usato.
 */

const CACHE = 'uroantibiogramma-v1';
const ASSET_DA_CACHARE = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'rules.js',
  'engine.js',
  'manifest.json',
  'lib/tesseract.min.js',
  'lib/worker.min.js',
  'lib/tesseract-core-simd.js',
  'lib/tesseract-core-simd.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSET_DA_CACHARE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
