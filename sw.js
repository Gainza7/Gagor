/* GAGOR · service worker: la app abre sin conexión; los datos van siempre al servidor. */
const VERSION = 'gagor-1.24.0';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.co$|supabase\.in$/.test(url.hostname) || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return; // datos: nunca de caché
  const esApp = url.origin === self.location.origin && (req.mode === 'navigate' || /\/(index\.html|config\.js)?$/.test(url.pathname));
  if (esApp) { // red primero: así las actualizaciones llegan; sin red, la copia guardada
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match('index.html'))));
    return;
  }
  // resto (iconos, fuentes): caché primero y se refresca por detrás
  e.respondWith(caches.match(req).then((m) => { const f = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; }).catch(() => m); return m || f; }));
});

/* Avisos: recordatorios de sesión (jugador) y dudas del chat (entrenador, con «Responder» / «Ahora no»). */
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const op = { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'gagor', data: { url: d.url || './' } };
  if (d.actions) { op.actions = d.actions; op.requireInteraction = true; op.renotify = true; op.vibrate = [120, 60, 120]; }
  e.waitUntil(self.registration.showNotification(d.title || 'GAGOR', op));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'luego') return; // «Ahora no»: la duda queda pendiente en Mensajes
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const hash = new URL(url).hash;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { if (hash) c.postMessage({ gagor: 'abrir', hash }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
