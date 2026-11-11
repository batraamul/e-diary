/* E-Diary — offline support. Serves the app from a local cache and refreshes it in the background.
   Change VERSION whenever you edit the app so installed copies pick up the new files. */
const VERSION = 'e-diary-1.25.2';   // 1.25.2 — Study topics as a tree of any depth, each line can be renamed or deleted
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
  './css/life.css',
  './css/research.css',
  './css/projects.css',
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
  './js/panchang.js',
  './js/pooja.js',
  './js/exercise.js',
  './js/welfare.js',
  './js/healthplan.js',
  './js/research.js',
  './js/scibits.js',
  './js/projects.js',
  './js/finlinks.js',
  './js/dayext.js',
  './js/evtask.js',
  './js/idealday.js',
  './js/pics.js',
  './js/dreams.js',
  './js/medcards.js',
  './js/watchlist.js',
  './js/studyplus.js',
  './js/visibility.js',
  './js/marketvals.js',
  './js/studyadjust.js',
  './js/aarti.js',
  './js/studyedit.js',
  './js/roadmap.js',
  './js/wmimages.js',
  './js/watermark.js',
  './js/luckdrive.js',
  './js/manifest.js',
  './js/letters.js',
  './js/studylink.js',
  './js/purchases.js',
  './js/mobile.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

const ASSET_SET = new Set(ASSETS);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))   // fresh from the site, all of one version
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
  // 1.24.2: pictures of the day (Wikimedia Commons) — kept once seen, so the page has its picture offline too
  if (url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org') {
    event.respondWith((async () => {
      const c = await caches.open('edpics-1');
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) event.waitUntil(c.put(req, res.clone()).then(() => c.keys()).then(ks => Promise.all(ks.slice(0, Math.max(0, ks.length - 150)).map(k => c.delete(k))))); return res; }   // only the latest 150 kept (space)
      catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return; // weather and sync go straight to the network

  // 1.24.5: the app's own files come straight from this version's cache (fast on phones); a new version is fetched
  // whole by the new service worker and the page offers "Reload". On this computer (localhost) the network comes first.
  const local = /^(localhost|127\.0\.0\.1)$/.test(self.location.hostname);
  const path = './' + url.pathname.slice(new URL('./', self.location).pathname.length);
  if (!local && (req.mode === 'navigate' || ASSET_SET.has(path))) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : path);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && res.ok && res.type === 'basic') event.waitUntil(cache.put(req.mode === 'navigate' ? './index.html' : path, res.clone())); return res; }
      catch (e) { return new Response('You are offline and this file is not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }
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
