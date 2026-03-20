const CACHE_NAME = 'mercier-v73';
const assets = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
