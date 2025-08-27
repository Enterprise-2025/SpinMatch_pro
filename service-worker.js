/* QPWON SpinMatch Pro — Service Worker
   Strategie:
   - Precache: asset minimi e certi (no file grandi o variabili)
   - Pagine / navigazioni: Network-first con fallback offline (index.html)
   - Asset statici same-origin (script/style/img/font): Cache-first
   - CDN/cross-origin (script/style/font): Stale-While-Revalidate
   - PDF: lasciamo pass-through i Range request; per il resto seguono le regole sopra
*/

const VERSION = 'v4-2025-08-27';
const STATIC_CACHE  = `spinmatch-static-${VERSION}`;
const RUNTIME_CACHE = `spinmatch-runtime-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* =========================
 * Install: precache tollerante
 * ========================= */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(
      PRECACHE_URLS.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          await cache.put(url, resp.clone());
        } catch (_) {
          // Se un asset non è disponibile, non blocchiamo l’install
        }
      })
    );
    // Attiva subito il nuovo SW
    self.skipWaiting();
  })());
});

/* =========================
 * Activate: pulizia cache vecchie
 * ========================= */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* =========================
 * Helpers
 * ========================= */
const isPDF = (url) => /\.pdf(?:$|\?)/i.test(url.pathname || url);
const isCDN = (host) => /cdn|jsdelivr|unpkg|cdnjs|gstatic|googleapis|fonts?/i.test(host);

// Cache-first per statici same-origin
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const resp = await fetch(request);
  if (resp && resp.ok) cache.put(request, resp.clone());
  return resp;
}

// SWR per runtime/cdn
async function staleWhileRevalidate(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  const networkPromise = fetch(request).then((resp) => {
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  }).catch(() => undefined);
  return cached || networkPromise || fetch(request);
}

// Pagine/navigazioni: network-first con fallback a index.html
async function networkFirstDocument(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) runtime.put(request, resp.clone());
    return resp;
  } catch (_) {
    const cached = await runtime.match(request);
    if (cached) return cached;
    const index = await caches.match('./index.html');
    if (index) return index;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/* =========================
 * Fetch router
 * ========================= */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Lascia passare metodi non-GET
  if (request.method !== 'GET') return;

  // Evita di interferire con richieste "Range" (es. PDF streaming parziale)
  if (request.headers.has('range')) {
    // Pass-through alla rete: i Range devono essere gestiti dal server
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);
  const dest = request.destination; // 'document' | 'script' | 'style' | 'image' | 'font' | 'iframe' | ...

  // 1) Navigazioni (top-level o iframe che naviga un documento)
  if (request.mode === 'navigate' || dest === 'document') {
    // Se è un PDF same-origin e non è un Range request, lo trattiamo comunque come document
    // (network-first) per garantire compatibilità con i viewer
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // 2) Same-origin statici
  if (url.origin === self.location.origin) {
    // PDF “embed” richiesti come fetch normale (non navigate) → usiamo SWR
    if (isPDF(url)) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
      return;
    }

    if (['script', 'style', 'image', 'font'].includes(dest)) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }

    // Altri GET same-origin (JSON, ecc.): SWR
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // 3) CDN e cross-origin noti: SWR
  if (isCDN(url.hostname) || ['script', 'style', 'font'].includes(dest)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // 4) Altri cross-origin: prova rete, poi cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* =========================
 * Messaggi (es. skip waiting manuale)
 * ========================= */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
