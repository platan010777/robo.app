const CACHE = 'robot-attendance-v25';  

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

// Fetch — сначала сеть для JS/CSS, потом кэш
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ⚡ ПРОПУСКАЕМ запросы к Supabase — SW не должен их трогать!
  if (url.hostname.includes('supabase.co')) {
    return;  // ← пусть браузер сам справится
  }

  // Для HTML/JS/CSS — сначала СЕТЬ, потом кэш
  if (
    e.request.destination === 'script' ||
    e.request.destination === 'style' ||
    e.request.destination === 'document'
  ) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Для всего остального (иконки, шрифты) — сначала КЭШ, потом сеть
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});