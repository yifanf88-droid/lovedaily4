/* ============================================================================
   念念日程 · Service Worker
   ----------------------------------------------------------------------------
   两个职责：
     1. 离线缓存（app shell）
     2. 显示通知 —— 关键：iOS PWA 上 new Notification() 不工作，
        必须由 SW 的 registration.showNotification() 发出。
        这是 Apple 从 16.4 起的实现现实，与 MDN 文档描述不一致。
   ========================================================================== */
var CACHE = 'niannian-dark-v1';
var SHELL = [
  './',
  './index.html',
  './dark-voice.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐个 add，避免单个资源 404 让整个 addAll 失败 */
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);

  /* 跨域接口（天气 / 反地理编码 / AI 代理）永不缓存——缓存过的天气比没有天气更糟 */
  if (url.origin !== location.origin) return;

  /* 同源：cache first + 后台更新 */
  e.respondWith(
    caches.match(r).then(function (hit) {
      var net = fetch(r).then(function (res) {
        if (res && res.status === 200) {
          caches.open(CACHE).then(function (c) { c.put(r, res.clone()); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});

/* 页面请求发通知（前台/后台驻留时的临期提醒走这条） */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'notify') {
    self.registration.showNotification(d.title || 'Dark', {
      body: d.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/favicon-32.png',
      tag: d.tag || 'niannian',
      renotify: true,
      data: { url: './index.html' }
    });
  }
});

/* 真 Web Push（需要后端 + VAPID）。有后端时这条会让提醒在 App 完全关闭后也能响 */
self.addEventListener('push', function (e) {
  var p = { title: 'Dark', body: '有件事该做了。' };
  try { if (e.data) p = Object.assign(p, e.data.json()); } catch (err) {}
  e.waitUntil(self.registration.showNotification(p.title, {
    body: p.body,
    icon: './icons/icon-192.png',
    badge: './icons/favicon-32.png',
    tag: p.tag || 'niannian',
    renotify: true,
    data: { url: p.url || './index.html' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
