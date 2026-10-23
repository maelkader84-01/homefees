/* sw.js â€” ط°ط§ظƒط±ط© طھط®ط²ظٹظ† ظ…ط¤ظ‚طھ ظ„ظˆط§ط¬ظ‡ط© ظ‡ظˆظ…ظٹظ†ط§ (PWA)
   - API ظٹط¨ظ‚ظ‰ ط¯ط§ط¦ظ…ط§ظ‹ ظ…ظ† ط§ظ„ط´ط¨ظƒط© (ط¨ظٹط§ظ†ط§طھ ط­ظٹط© ظˆظ„ط§ طھظڈط®ط²ظژظ‘ظ†)
   - ط§ظ„ظˆط§ط¬ظ‡ط© ط§ظ„ط«ط§ط¨طھط©: ط£ظˆظ„ طھط®ط²ظٹظ† ط«ظ… طھط­ط¯ظٹط« طھظ„ظ‚ط§ط¦ظٹ ظپظٹ ط§ظ„ط®ظ„ظپظٹط© */
'use strict';
const CACHE = 'homefees-shell-v9';
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
  if (url.origin !== location.origin) return;      // ط®ط·ظˆط· ط؛ظˆط؛ظ„ ظˆظ…ط§ ظٹظ…ط§ط«ظ„ظ‡ط§: ط§ظ„ط´ط¨ظƒط© ظ…ط¨ط§ط´ط±ط©
  if (url.pathname.startsWith('/api/')) return;    // ط¨ظٹط§ظ†ط§طھ ط­ظٹط© ظ…ظ† ط§ظ„ط®ط§ط¯ظ… ط¯ط§ط¦ظ…ط§ظ‹

  e.respondWith(
    fetch(req)
      .then(res => { // ط´ط¨ظƒط© ط£ظˆظ„ط§ظ‹ + طھط­ط¯ظٹط« ط§ظ„ظƒط§ط´
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
        return res.clone();
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
  );
});
