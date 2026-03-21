const CACHE_NAME = 'mercier-v87'; // Versão alterada para forçar limpeza de cache
const assets = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
  self.skipWaiting(); // Força a nova versão a assumir o controle na hora
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
