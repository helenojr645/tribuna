// Service worker: abre o app rapido e recebe os avisos. Placar nunca vem de cache daqui.
const VERSION = 'tribuna-24';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'fontes.js', 'f1vivo.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/badge-96.png'];
const IMG_CACHE = 'tribuna-img';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== VERSION && n !== IMG_CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === self.location.origin) {
    // Rede primeiro para o app nao ficar preso em versao velha; cache so sem internet.
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res.ok) (await caches.open(VERSION)).put(e.request, res.clone());
        return res;
      } catch (_) {
        return (await caches.match(e.request)) || (await caches.match('index.html'));
      }
    })());
    return;
  }
  if (url.hostname === 'imagecache.365scores.com' || url.hostname === 'images.fotmob.com' || url.hostname === 'a.espncdn.com') {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    })());
  }
});

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    // Cartao ao vivo: fecha o anterior antes, porque a troca por tag nao e confiavel em todo iOS.
    // Autor do gol que chegou depois: troca o aviso "GOL do time" em vez de empilhar.
    if ((m.live || m.troca) && m.tag) {
      // Se falhar, segue: o iPhone penaliza push sem notificacao visivel.
      try {
        const antigos = await self.registration.getNotifications({ tag: m.tag });
        antigos.forEach((n) => n.close());
      } catch (_) {}
    }
    let falha = '';
    try {
      await self.registration.showNotification(m.title || 'Tribuna', {
        body: m.body || '',
        tag: m.tag || undefined,
        renotify: !!m.tag,
        requireInteraction: !!m.live && !m.fim,
        icon: m.ic && /^v\d+\/Compet(itors|itions)\/\d+$/.test(m.ic) ? 'https://imagecache.365scores.com/image/upload/f_png,w_192,h_192,c_pad,b_rgb:1C1C1E,q_auto:good/' + m.ic : 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
        data: { url: m.url || '#/agora' }
      });
    } catch (err) { falha = String(err); }
    if (m.ack) await confirmarTeste(m.ack, falha);
  })());
});

// So o aviso de teste responde ao robo, para mostrar em que etapa o aviso parou.
async function confirmarTeste(ack, falha) {
  try {
    const mostrou = (await self.registration.getNotifications()).length;
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    abertas.forEach((c) => c.postMessage({ type: 'teste', mostrou, falha }));
    await fetch(ack.u, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ a: 'ack', t: ack.t, mostrou, falha, perm: Notification.permission, v: VERSION })
    });
  } catch (_) {}
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/agora';
  e.waitUntil((async () => {
    const target = new URL('./', self.location).href + hash;
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      c.postMessage({ type: 'open', hash });
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow(target);
  })());
});
