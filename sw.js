/* E-Diary — offline support. Serves the app from a local cache and refreshes it in the background.
   Change VERSION whenever you edit the app so installed copies pick up the new files. */
const VERSION = 'e-diary-1.15.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/binder.css',
  './css/views.css',
  './css/calendar.css',
  './css/components.css',
  './css/study.css',
  './css/finance.css',
  './css/more.css',
  './css/diary.css',
  './css/mobile.css',
  './js/util.js',
  './js/xlsx.js',
  './js/icons.js',
  './js/store.js',
  './js/lock.js',
  './js/sample.js',
  './js/quotes.js',
  './js/weather.js',
  './js/model.js',
  './js/ui.js',
  './js/charts.js',
  './js/richtext.js',
  './js/tasksui.js',
  './js/calendar.js',
  './js/tgdrag.js',
  './js/editors.js',
  './js/view-daily.js',
  './js/view-plan.js',
  './js/view-mission.js',
  './js/study.js',
  './js/view-study.js',
  './js/finance.js',
  './js/finplan.js',
  './js/wealth.js',
  './js/habits.js',
  './js/fx.js',
  './js/lists.js',
  './js/matrix.js',
  './js/bucket.js',
  './js/horizons.js',
  './js/wardrobe.js',
  './js/exam.js',
  './js/mindmap.js',
  './js/jobs.js',
  './js/interview.js',
  './js/health.js',
  './js/meetings.js',
  './js/vault.js',
  './js/settings.js',
  './js/look.js',
  './js/search.js',
  './js/sync.js',
  './js/gcal.js',
  './js/gdrive.js',
  './js/reminders.js',
  './js/holidays.js',
  './js/cover.js',
  './js/app.js',
  './js/purchases.js',
  './js/mobile.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('e-diary-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // weather and sync go straight to the network

  // Network first: the diary is served from this computer (localhost), so the newest files are always
  // used straight after an update. The cache is only the fallback when the files cannot be reached.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === 'navigate' ? './index.html' : req;
    try {
      const res = await fetch(req, { cache: 'no-store' });
      if (res && res.ok && res.type === 'basic') event.waitUntil(cache.put(key, res.clone()));
      if (res) return res;
    } catch (e) {}
    const cached = await cache.match(key, { ignoreSearch: true });
    return cached || new Response('You are offline and this file is not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./index.html');
  }));
});
