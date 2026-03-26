const CACHE_NAME = 'mercier-v106-safe'; // Atualizei a versão do cache
const assets =[
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
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

// Nova Estratégia de Cache: Stale-While-Revalidate
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      const fetchPromise = fetch(e.request).then(networkResponse => {
        // Guarda a versão mais atualizada silenciosamente
        caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => cachedResponse); // Se estiver sem internet, usa o cache
      
      // Retorna o cache IMEDIATAMENTE se existir, enquanto a rede atualiza no fundo
      return cachedResponse || fetchPromise;
    })
  );
});
