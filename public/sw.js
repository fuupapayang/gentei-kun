/* 限定くん Service Worker: app-shell offline cache + web push (base-path & cross-origin-API safe) */
importScripts('config.js'); // sets self.GENTEI_CONFIG / gUrl / gApi (resolved relative to this file => site root)
const VERSION = 'gentei-v5';
const BASE = new URL('./', self.location.href).pathname; // "/" locally, "/<repo>/" on GitHub Pages
const P = p => BASE + p.replace(/^\//, '');
const SHELL = ['/', '/index.html', '/register.html', '/install.html', '/app.css', '/app.js', '/config.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/assets/img/common_escon.svg', '/assets/img/common_logo.svg', '/assets/img/top_entry_merit_2.jpg', '/assets/img/top_entry_merit_3.jpg',
  '/assets/img/top_entry_merit_4.jpg', '/assets/img/top_entry_merit_6.jpg', '/assets/img/top_access_2.jpg', '/assets/img/top_access_3.jpg', '/assets/img/top_plan_1.png'].map(P);
const CACHEABLE_API = ['/property', '/me', '/contents', '/pushes'];
const API_ROOT = new URL(self.gApi(''), self.location.href); // absolute API root (same-origin "/api" or cross-origin function URL)

// returns the API sub-path ("/me") when the URL targets the API, else null
function apiPath(url) {
  const root = API_ROOT.pathname.replace(/\/+$/, '');
  if (url.origin !== API_ROOT.origin) return null;
  if (url.pathname === root || url.pathname.indexOf(root + '/') !== 0) return null;
  return url.pathname.slice(root.length);
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const ap = apiPath(url);
  if (ap !== null) {
    if (!CACHEABLE_API.includes(ap)) return;
    // network first, fall back to last response (per token) when offline
    const key = new Request(P('/__api' + ap) + '?t=' + encodeURIComponent(req.headers.get('x-customer-token') || ''));
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(r => r || new Response('{"error":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } }))));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(BASE) !== 0) return;
  const rel = '/' + url.pathname.slice(BASE.length); // path relative to site root, "/" prefixed
  if (rel.startsWith('/admin') || rel.startsWith('/tool')) return;
  if (rel.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname, { ignoreSearch: true }).then(r => r || caches.match(BASE))));
    return;
  }
  if (rel.startsWith('/assets/video/')) return; // never cache videos (range requests, large)
  if (rel.startsWith('/assets/img/')) {
    // runtime cache-first for images
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // static: stale-while-revalidate
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const title = d.title || '限定くん｜新着の限定情報';
  const target = d.url || '/';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '新しい限定情報が届いています',
    icon: P('/icons/icon-192.png'),
    badge: P('/icons/favicon-32.png'),
    tag: d.id || 'gentei',
    data: { url: target, id: d.id || '' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  // root-absolute urls ("/", "/register.html") are mapped under the site base; absolute/relative urls resolve against the scope
  const u = new URL(self.gUrl(data.url || '/'), self.registration.scope);
  if (data.id && !u.searchParams.has('push')) u.searchParams.set('push', data.id);
  if (!u.searchParams.has('open')) u.searchParams.set('open', '1');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        return c.focus().then(w => { if (w && 'navigate' in w) return w.navigate(u.href); });
      }
    }
    return self.clients.openWindow(u.href);
  }));
});
