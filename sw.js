const CACHE = 'robot-attendance-v19';
const ASSETS = [
  './',
  './index.html',
  './student.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/student.js',
  './js/sync.js',
  './js/ui.js',
  './js/reports.js',
  './js/export.js',
  './fonts/Roboto-Regular.ttf',
];

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