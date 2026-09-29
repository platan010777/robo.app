const CACHE = 'robot-attendance-v19';  // ← v18 → v19 (заставит обновить)

const ASSETS = [
  './',
  './index.html',
  './student.html',
  './parent.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/student.js',
  './js/parent.js',
  './js/ui.js',
  './js/export.js',
  './icons/logo.svg',
  './icons/logo-icon.svg',
  './fonts/Roboto-Regular.ttf',
];

// Установка — кэшируем файлы
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
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

// Fetch — сначала сеть для JS/CSS (чтобы правки подхватывались), потом кэш
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Для HTML/JS/CSS — сначала СЕТЬ, потом кэш (чтобы изменения сразу виделись)
  if (
    e.request.destination === 'script' ||
    e.request.destination === 'style' ||
    e.request.destination === 'document'
  ) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Обновляем кэш свежей версией
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))  // если сеть недоступна — из кэша
    );
    return;
  }

  // Для всего остального (иконки, шрифты) — сначала КЭШ, потом сеть
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});