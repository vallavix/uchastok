/* Офлайн-кэш. При правках файлов поднимай версию — иначе браузер отдаст старое. */
var V = 'uch-v15';
var FILES = ['./', './index.html', './style.css', './app.js',
  './manifest.json', './icon-180.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(V).then(function (c) { c.put(e.request, copy); }).catch(function () { });
      return resp;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
