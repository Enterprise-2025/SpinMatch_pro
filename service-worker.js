// SpinMatch Pro — service worker (cache base)
const CACHE = 'spinmatch-pro-v1';
const ASSETS = [
  './','./index.html','./style.css','./script.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./data/cases.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});