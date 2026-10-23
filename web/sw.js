/* sw.js — ذاكرة تخزين مؤقت لواجهة هومينا (PWA)
   - API يبقى دائماً من الشبكة (بيانات حية ولا تُخزَّن)
   - الواجهة الثابتة: أول تخزين ثم تحديث تلقائي في الخلفية */
'use strict';
const CACHE = 'homina-shell-v1';
const SHELL = [
  '/', '/index.html', '/manifest.json',
  '/styles.css', '/app.js', '/core.js', '/i18n.js',
  '/pages1.js', '/pages2.js', '/pages3.js',
  '/assets/icon.png', '/assets/icon-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // خطوط غوغل وما يماثلها: الشبكة مباشرة
  if (url.pathname.startsWith('/api/')) return;    // بيانات حية من الخادم دائماً

  e.respondWith(
    fetch(req)
      .then(res => { // شبكة أولاً + تحديث الكاش
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
        return res.clone();
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
  );
});
