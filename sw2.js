const CACHE = 'robot-attendance-v3';

const ASSETS = [
  './',
  './index.html',
  './student.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/student.js',
  './js/ui.js',
  './js/export.js',
  './fonts/Roboto-Regular.ttf',
];

// Установка — кэшируем файлы
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();  // ← сразу активируем
});

// Активация — удаляем старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — сначала кэш, потом сеть
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});