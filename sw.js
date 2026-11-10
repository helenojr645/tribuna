// Service worker: abre o app rapido e recebe os avisos. Placar nunca vem de cache daqui.
const VERSION = 'tribuna-25';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'fontes.js', 'f1vivo.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/badge-96.png'];
// Escudos e logos: ate 300, por ate 30 dias. O nome mudou de 'tribuna-img' para jogar fora as
// respostas opacas antigas (404/5xx guardados para sempre).
const IMG_CACHE = 'tribuna-img-2';
const IMG_MAX = 300, IMG_DIAS = 30;

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
    // Rede primeiro para o app nao ficar preso em versao velha. Rede lenta (3 s): serve o cache
    // e a resposta da rede atualiza o cache por tras. Sem internet: cache.
    const rede = fetch(e.request).then(async (res) => {
      if (res.ok) await (await caches.open(VERSION)).put(e.request, res.clone());
      return res;
    });
    e.waitUntil(rede.then(() => {}, () => {}));
    e.respondWith((async () => {
      const prazo = new Promise((res) => setTimeout(() => res('prazo'), 3000));
      try {
        const r = await Promise.race([rede, prazo]);
        if (r !== 'prazo') return r;
        const hit = await caches.match(e.request);
        return hit || await rede;
      } catch (_) {
        return (await caches.match(e.request)) || (await caches.match('index.html'));
      }
    })());
    return;
  }
  if (url.hostname === 'imagecache.365scores.com' || url.hostname === 'images.fotmob.com' || url.hostname === 'a.espncdn.com') {
    e.respondWith(imagem(e));
  }
});

async function imagem(e) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(e.request);
  const at = hit ? Number(hit.headers.get('x-tribuna-at')) || 0 : 0;
  if (hit && Date.now() - at < IMG_DIAS * 864e5) return hit;
  let res;
  // 365Scores e ESPN liberam CORS: pedindo assim da para ver o status e nao guardar 404/5xx.
  // A FotMob nao libera: busca normal, que volta opaca e por isso nao e guardada.
  const cors = new URL(e.request.url).hostname !== 'images.fotmob.com';
  try {
    res = await fetch(cors ? new Request(e.request.url, { mode: 'cors', credentials: 'omit' }) : e.request);
  } catch (err) {
    if (hit) return hit;
    if (!cors) throw err;
    res = await fetch(e.request);
  }
  if (res.ok && res.type !== 'opaque') {
    const corpo = await res.clone().blob();
    const h = new Headers(res.headers);
    h.set('x-tribuna-at', String(Date.now()));
    e.waitUntil(cache.put(e.request, new Response(corpo, { status: res.status, statusText: res.statusText, headers: h })).then(() => (++guardadas % 25 === 1 ? aparar(cache) : null)).catch(() => {}));
  } else if (hit) return hit;
  return res;
}
let guardadas = 0;
// Passou do limite (conferido a cada 25 imagens guardadas): apaga os mais antigos (o cache lista na ordem em que guardou).
async function aparar(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMG_MAX) return;
  await Promise.all(keys.slice(0, keys.length - IMG_MAX).map((k) => cache.delete(k)));
}

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
