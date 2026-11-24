// Service worker KENDATI: network-first, cache sebagai cadangan offline.
// Naikkan VERSI setiap kali ingin memaksa cache lama dihapus.
const VERSI = 'kendati-v1';
const INTI = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(INTI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(n => n !== VERSI).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Hanya tangani file dari domain sendiri; Apps Script/API luar tidak di-cache.
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const salinan = res.clone();
        caches.open(VERSI).then(c => c.put(req, salinan));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
