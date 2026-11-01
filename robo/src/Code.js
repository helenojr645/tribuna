// Robo da Tribuna: vigia jogos seguidos a cada minuto e dispara Web Push.
// Nenhum segredo fica no codigo: chaves e PIN sao gerados em initOnce e guardados em Script Properties.

var API = 'https://webws.365scores.com/web';
var API_Q = 'appTypeId=5&langId=31&timezoneName=America/Sao_Paulo&userCountryId=21';
var OPENF1 = 'https://api.openf1.org/v1';
var FOTMOB = 'https://www.fotmob.com/api/data';
var ESPN_WEB = 'https://site.web.api.espn.com/apis/site/v2/sports';
var SUBJECT = 'https://helenojr645.github.io/tribuna/';
var MAX_DEVICES = 5;
var PUSH_HOSTS = /^https:\/\/(web\.push\.apple\.com|fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

var DEFAULT_RULES = {
  remind: true, lineup: false, kick: true, goal: true, red: true, ht: false, end: true,
  tStart: true, tSet: true, tEnd: true,
  f1Remind: true, f1Start: false, f1End: true
};

// ---------- Web app ----------

function doGet(e) {
  var a = (e && e.parameter && e.parameter.a) || 'status';
  try {
    if (a === 'init') return json_(initOnce_());
    if (a === 'status') return json_(status_());
    if (a === 'fontes') return json_(sondarFontes_());
    return json_({ ok: false, error: 'acao desconhecida' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(28000);
    var req = JSON.parse(e.postData.contents);
    if (req.a === 'subscribe') return json_(subscribe_(req));
    if (req.a === 'purge') return json_(purge_(req));
    var dev = authDevice_(req);
    if (!dev) return json_({ ok: false, error: 'aparelho nao autorizado', code: 'auth' });
    if (req.a === 'prefs') return json_(savePrefs_(dev, req));
    if (req.a === 'test') return json_(sendTest_(dev));
    if (req.a === 'unsubscribe') { deleteDevice_(dev.id); return json_({ ok: true }); }
    return json_({ ok: false, error: 'acao desconhecida' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function props_() { return PropertiesService.getScriptProperties(); }

function initOnce_() {
  var p = props_();
  if (p.getProperty('vapid')) return { ok: true, already: true };
  var keys = WebPush.generateVapid();
  var digits = randomBytes_(8);
  var pin = '';
  for (var i = 0; i < 6; i++) pin += String(digits[i] % 10);
  p.setProperties({ vapid: JSON.stringify(keys), pin: pin, pinFails: '0' });
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  // O PIN so aparece nesta primeira resposta.
  return { ok: true, pin: pin, publicKey: keys.publicKey };
}

// Diagnostico: quais fontes respondem a partir dos servidores do Google.
function sondarFontes_() {
  var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd');
  var lista = {
    s365: API + '/games/current/?' + API_Q + '&sports=1',
    fotmob: 'https://www.fotmob.com/api/data/matches?date=' + hoje,
    espnWeb: 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard',
    espnWebTenis: 'https://site.web.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
    espnWebF1: 'https://site.web.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
    openf1: OPENF1 + '/sessions?year=2026&country_name=Mexico',
    jolpica: 'https://api.jolpi.ca/ergast/f1/current/next.json'
  };
  var nomes = Object.keys(lista);
  var res = UrlFetchApp.fetchAll(nomes.map(function (n) { return { url: lista[n], muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } }; }));
  var out = {};
  nomes.forEach(function (n, i) { out[n] = { codigo: res[i].getResponseCode(), kb: Math.round(res[i].getContentText().length / 1024) }; });
  // Roda as reservas de verdade, para provar que o formato segue valido.
  var agora = Date.now(), reservas = {};
  try { var f = futebolReserva_(agora); reservas.futebol = { fonte: f.fonte, jogos: f.lista.length, aoVivo: f.lista.filter(function (x) { return x.g === 3; }).length }; } catch (e) { reservas.futebol = String(e); }
  try { reservas.tenis = tenisReserva_().length; } catch (e) { reservas.tenis = String(e); }
  try {
    var ev = (fetchJson_(ESPN_WEB + '/racing/f1/scoreboard').events || [])[0];
    reservas.f1 = { gp: ev && ev.name, sessoes: ev ? ev.competitions.length : 0 };
  } catch (e) { reservas.f1 = String(e); }
  return { ok: true, fontes: out, reservas: reservas };
}

function status_() {
  var p = props_();
  var keys = JSON.parse(p.getProperty('vapid') || '{}');
  return {
    ok: true,
    publicKey: keys.publicKey || null,
    lastTick: Number(p.getProperty('lastTick') || 0),
    lastPoll: Number(p.getProperty('lastPoll') || 0),
    lastPush: Number(p.getProperty('lastPush') || 0),
    fails: Number(p.getProperty('fails') || 0),
    lastError: p.getProperty('lastError') || '',
    fonte: p.getProperty('fonte') || '',
    devices: deviceIds_().length,
    now: Date.now()
  };
}

// ---------- Aparelhos ----------

function deviceIds_() {
  return props_().getKeys().filter(function (k) { return k.indexOf('dev:') === 0; }).map(function (k) { return k.slice(4); });
}

function loadDevices_() {
  var all = props_().getProperties();
  var out = [];
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('dev:') === 0) { try { out.push(JSON.parse(all[k])); } catch (_) {} }
  });
  return out;
}

function saveDevice_(d) { props_().setProperty('dev:' + d.id, JSON.stringify(d)); }
function deleteDevice_(id) { props_().deleteProperty('dev:' + id); }

function authDevice_(req) {
  if (!req.id || !req.secret) return null;
  var raw = props_().getProperty('dev:' + req.id);
  if (!raw) return null;
  var d = JSON.parse(raw);
  return d.secret === req.secret ? d : null;
}

function cleanPrefs_(req, d) {
  var f = req.follows || {};
  d.follows = {
    c: (f.c || []).map(Number).filter(isFinite).slice(0, 200),
    comp: (f.comp || []).map(Number).filter(isFinite).slice(0, 60),
    f1: !!f.f1,
    drivers: (f.drivers || []).map(String).slice(0, 30),
    mute: (f.mute || []).map(Number).filter(isFinite).slice(0, 200)
  };
  d.rules = {};
  Object.keys(DEFAULT_RULES).forEach(function (k) {
    d.rules[k] = req.rules && typeof req.rules[k] === 'boolean' ? req.rules[k] : DEFAULT_RULES[k];
  });
  d.spoiler = !!req.spoiler;
  var antes = {};
  (d.watch || []).forEach(function (w) { antes[w.g] = w; });
  var acabados = d.fim || [];
  d.watch = (req.watch || []).slice(0, 5).map(function (w) {
    var g = Number(w.g), velho = antes[g];
    // Sem registro anterior e um pedido novo: o primeiro cartao sai no proximo minuto.
    return { g: g, c: (w.c || []).map(Number).filter(isFinite).slice(0, 2), m: w.m === 'all' ? 'all' : 'main', t: Number(w.t) || 0, novo: velho ? !!velho.novo : true };
  }).filter(function (w) { return isFinite(w.g) && w.g > 0 && acabados.indexOf(w.g) < 0; });
  var q = req.quiet;
  d.quiet = q && q.on ? { on: true, from: Number(q.from) || 0, to: Number(q.to) || 0 } : { on: false };
  return d;
}

function checkPin_(req) {
  var p = props_();
  if (!/^\d{6}$/.test(String(req.pin || ''))) return { ok: false, error: 'Digite o PIN', code: 'pin' };
  var until = Number(p.getProperty('pinLockUntil') || 0);
  if (Date.now() < until) return { ok: false, error: 'PIN bloqueado por 15 minutos', code: 'locked' };
  if (String(req.pin) !== p.getProperty('pin')) {
    var fails = Number(p.getProperty('pinFails') || 0) + 1;
    p.setProperty('pinFails', String(fails));
    if (fails >= 10) p.setProperties({ pinFails: '0', pinLockUntil: String(Date.now() + 15 * 60000) });
    return { ok: false, error: 'PIN incorreto', code: 'pin' };
  }
  p.setProperty('pinFails', '0');
  return null;
}

// Manutencao: remove todos os aparelhos. Cada um liga de novo com o PIN.
function purge_(req) {
  var denied = checkPin_(req);
  if (denied) return denied;
  var ids = deviceIds_();
  ids.forEach(deleteDevice_);
  props_().deleteProperty('plan');
  props_().deleteProperty('queue');
  return { ok: true, removed: ids.length };
}

function invalidarPlano_() {
  var p = props_();
  var plano = JSON.parse(p.getProperty('plan') || 'null');
  if (plano) { plano.at = 0; p.setProperty('plan', JSON.stringify(plano)); }
}

function subscribe_(req) {
  var p = props_();
  var existing = req.id && req.secret ? authDevice_(req) : null;
  if (!existing) {
    var denied = checkPin_(req);
    if (denied) return denied;
  }
  var s = req.sub || {};
  if (!PUSH_HOSTS.test(String(s.endpoint || '')) || !s.keys || !s.keys.p256dh || !s.keys.auth) {
    return { ok: false, error: 'Assinatura de push invalida' };
  }
  var all = loadDevices_();
  // Mesmo aparelho registrado de novo nao pode gerar aviso em dobro.
  all.forEach(function (d) {
    if (d.sub && d.sub.endpoint === s.endpoint && (!existing || d.id !== existing.id)) deleteDevice_(d.id);
  });
  if (!existing) {
    var rest = loadDevices_();
    if (rest.length >= MAX_DEVICES) {
      var dead = rest.filter(function (d) { return !d.sub; });
      if (!dead.length) return { ok: false, error: 'Limite de aparelhos atingido', code: 'max' };
      deleteDevice_(dead[0].id);
    }
  }
  var d = existing || { id: Utilities.getUuid(), secret: Utilities.getUuid() + Utilities.getUuid() };
  d.sub = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  cleanPrefs_(req, d);
  saveDevice_(d);
  invalidarPlano_();
  return { ok: true, id: d.id, secret: d.secret };
}

function savePrefs_(dev, req) {
  cleanPrefs_(req, dev);
  saveDevice_(dev);
  invalidarPlano_();
  return { ok: true };
}

function sendTest_(dev) {
  if (!dev.sub) return { ok: false, error: 'Assinatura vencida. Abra o app de novo para renovar.' };
  var r = pushMany_([{ dev: dev, msg: { title: 'Tribuna', body: 'Tudo certo: os avisos estão chegando neste aparelho.', tag: 'teste', url: '#/ajustes' } }]);
  return { ok: r.sent === 1, sent: r.sent, codes: r.codes, error: r.sent === 1 ? '' : 'O servico de push recusou o envio' };
}

// ---------- Envio ----------

function randomBytes_(n) {
  var out = new Uint8Array(n), i = 0;
  while (i < n) {
    var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random());
    for (var j = 0; j < d.length && i < n; j++) out[i++] = d[j] & 255;
  }
  return out;
}

function pushMany_(items) {
  var live = items.filter(function (it) { return it.dev && it.dev.sub; });
  if (!live.length) return { sent: 0, codes: [], retry: [] };
  var keys = JSON.parse(props_().getProperty('vapid'));
  var nowSec = Math.floor(Date.now() / 1000);
  var auths = {};
  var reqs = [], ready = [], retry = [];
  live.forEach(function (it) {
    try {
      var ep = it.dev.sub.endpoint;
      var origin = ep.match(/^https:\/\/[^/]+/)[0];
      if (!auths[origin]) auths[origin] = WebPush.vapidHeader(ep, keys, SUBJECT, nowSec);
      var body = WebPush.encryptPayload(JSON.stringify(it.msg), it.dev.sub.keys.p256dh, it.dev.sub.keys.auth, randomBytes_);
      reqs.push({
        url: ep, method: 'post', contentType: 'application/octet-stream',
        headers: cabecalhos_(it.msg, auths[origin]),
        payload: Utilities.newBlob(toSigned_(body), 'application/octet-stream'), muteHttpExceptions: true
      });
      ready.push(it);
    } catch (err) {
      // Chave invalida de um aparelho nao pode impedir os outros.
      console.warn('push nao montado: ' + err);
    }
  });
  var sent = 0, codes = [];
  var res;
  try {
    res = UrlFetchApp.fetchAll(reqs);
  } catch (err) {
    console.warn('fetchAll falhou: ' + err);
    return { sent: 0, codes: [], retry: ready };
  }
  res.forEach(function (r, i) {
    var c = r.getResponseCode();
    codes.push(c);
    if (c >= 200 && c < 300) sent++;
    else if (c === 404 || c === 410) {
      // Assinatura morta: guarda o aparelho para o app renovar sem pedir PIN.
      var dead = ready[i].dev;
      dead.sub = null;
      saveDevice_(dead);
    } else if (c === 429 || c >= 500) retry.push(ready[i]);
    else console.warn('push ' + c + ': ' + r.getContentText().slice(0, 200));
  });
  if (sent) props_().setProperty('lastPush', String(Date.now()));
  return { sent: sent, codes: codes, retry: retry };
}

// Entrega com fila curta: aviso que falhou por erro temporario tenta de novo por 10 minutos.
function deliver_(items, devices, now) {
  var p = props_();
  var q = JSON.parse(p.getProperty('queue') || '[]');
  var byId = {};
  devices.forEach(function (d) { byId[d.id] = d; });
  var pending = q.filter(function (x) { return now - x.at < 10 * 60000 && byId[x.id]; })
    .map(function (x) { return { dev: byId[x.id], msg: x.msg, at: x.at }; });
  var novos = items.map(function (it) { return { dev: it.dev, msg: it.msg, at: now }; });
  // Cartao pendente mais velho que um novo do mesmo jogo nao sai: voltaria o placar.
  pending = pending.filter(function (x) {
    return !(x.msg.live && novos.some(function (n) { return n.dev.id === x.dev.id && n.msg.tag === x.msg.tag; }));
  });
  var all = pending.concat(novos);
  if (!all.length) { if (q.length) p.deleteProperty('queue'); return; }
  var r = pushMany_(all);
  var next = (r.retry || []).map(function (it) { return { id: it.dev.id, msg: it.msg, at: it.at || now }; });
  var text = JSON.stringify(next);
  while (text.length > 8000 && next.length) { next.shift(); text = JSON.stringify(next); }
  if (next.length) p.setProperty('queue', text); else if (q.length) p.deleteProperty('queue');
}

function cabecalhos_(msg, autorizacao) {
  var h = { Authorization: autorizacao, TTL: '1800', Urgency: 'high', 'Content-Encoding': 'aes128gcm' };
  // Topic: cartao ainda nao entregue e trocado pelo mais novo no servico de push.
  if (msg.live && msg.tag) h.Topic = msg.tag;
  return h;
}

function toSigned_(u8) {
  var a = new Array(u8.length);
  for (var i = 0; i < u8.length; i++) a[i] = u8[i] > 127 ? u8[i] - 256 : u8[i];
  return a;
}

// ---------- Vigia ----------

var CACHE_CICLO = {};

function fetchJson_(url) {
  var memo = url.indexOf('/game/') >= 0 || url.indexOf('matchDetails') >= 0;
  if (memo && CACHE_CICLO[url]) return CACHE_CICLO[url];
  var dados = fetchJsonRede_(url);
  if (memo) CACHE_CICLO[url] = dados;
  return dados;
}

function fetchJsonRede_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode() + ' em ' + url.split('?')[0]);
  return JSON.parse(r.getContentText());
}

function noteFailure_(p, message) {
  var fails = Number(p.getProperty('fails') || 0) + 1;
  p.setProperties({ fails: String(fails), lastError: String(message).slice(0, 300) });
  // Falha nunca fica em silencio: 15 minutos seguidos com erro geram um aviso unico.
  if (fails >= 15 && !p.getProperty('downAlert')) {
    p.setProperty('downAlert', '1');
    try {
      pushMany_(loadDevices_().map(function (d) {
        return { dev: d, msg: { title: 'Tribuna: avisos com problema', body: 'Faz 15 minutos que não consigo ler os placares. Os avisos de jogo podem falhar.', tag: 'robo', url: '#/ajustes' } };
      }));
    } catch (_) {}
  }
}

function tick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  var p = props_();
  CACHE_CICLO = {};
  try {
    var now = Date.now();
    p.setProperty('lastTick', String(now));
    if (!p.getProperty('vapid')) return;
    var devices = loadDevices_().filter(function (d) { return d.sub; });
    if (!devices.length) return;

    var plan = JSON.parse(p.getProperty('plan') || 'null');
    if (!plan || now - plan.at > 30 * 60000) {
      try {
        plan = buildPlan_(devices, now);
      } catch (err) {
        // 365Scores fora na hora do plano: segue com o plano antigo e tenta de novo em 10 minutos.
        if (!plan) throw err;
        plan.at = now - 20 * 60000;
        plan.live = true;
      }
      // Salvo antes de qualquer saida: refazer o plano todo minuto estoura a cota diaria do gatilho.
      p.setProperty('plan', JSON.stringify(plan));
      cleanup_();
    }
    // Jogo acompanhado segue vigiado ate o cartao final, mesmo se o fim aconteceu com o robo parado.
    var vigiando = devices.some(function (d) {
      return (d.watch || []).some(function (w) { return !w.t || (now >= w.t - 90 * 60000 && now < w.t + 10 * 3600000); });
    });
    var active = vigiando || plan.live || plan.starts.some(function (t) { return now >= t - 90 * 60000 && now <= t + 5 * 3600000; });
    if (!active && !plan.f1Active) {
      deliver_([], devices, now);
      p.setProperties({ fails: '0', lastError: '' });
      if (p.getProperty('downAlert')) p.deleteProperty('downAlert');
      return;
    }

    var mem = p.getProperties();
    // Depois de uma parada longa, o que aconteceu no intervalo nao vira rajada de avisos atrasados.
    var lastPoll = Number(mem.lastPoll || 0);
    var stale = !lastPoll || now - lastPoll > 20 * 60000;
    var out = [], writes = {}, partial = [];
    if (active) {
      var lista, fonte = '';
      try {
        lista = fetchFollowedGames_(devices);
      } catch (err) {
        var alt = jogosReserva_(plan, now);
        lista = alt.games;
        fonte = alt.fonte;
        console.warn('365Scores fora, usando ' + fonte + ': ' + err);
      }
      if (fonte !== (mem.fonte || '')) p.setProperty('fonte', fonte);
      pollGames_(lista, devices, mem, writes, out, now, stale, partial);
    }
    if (plan.f1Active) {
      try { pollF1_(devices, mem, writes, out, now, stale); } catch (err) { partial.push('F1: ' + err); }
    }
    if (Object.keys(writes).length) p.setProperties(writes);
    deliver_(out, devices, now);
    aplicarFimDasVigias_(devices);
    p.setProperty('lastPoll', String(now));
    if (partial.length) {
      noteFailure_(p, partial.join(' | '));
    } else {
      p.setProperties({ fails: '0', lastError: '' });
      if (p.getProperty('downAlert')) p.deleteProperty('downAlert');
    }
  } catch (err) {
    console.error(err);
    noteFailure_(p, err && err.message || err);
  } finally {
    lock.releaseLock();
  }
}

function followedIds_(devices) {
  var c = {}, comp = {};
  devices.forEach(function (d) {
    (d.follows.c || []).forEach(function (x) { c[x] = 1; });
    (d.follows.comp || []).forEach(function (x) { comp[x] = 1; });
    (d.watch || []).forEach(function (w) {
      if (w.t && Date.now() > w.t + 10 * 3600000) return;
      w.c.forEach(function (x) { c[x] = 1; });
    });
  });
  return { c: Object.keys(c), comp: Object.keys(comp) };
}

function fetchFollowedGames_(devices) {
  var ids = followedIds_(devices);
  var urls = [];
  if (ids.c.length) urls.push(API + '/games/current/?' + API_Q + '&competitors=' + ids.c.join(','));
  if (ids.comp.length) urls.push(API + '/games/current/?' + API_Q + '&competitions=' + ids.comp.join(','));
  var seen = {}, out = [];
  urls.forEach(function (u) {
    (fetchJson_(u).games || []).forEach(function (g) {
      if (!seen[g.id]) { seen[g.id] = 1; out.push(g); }
    });
  });
  return out;
}

// ---------- Reservas ----------
function bytes_(s) { return Utilities.newBlob(String(s)).getBytes().length; }

function planoJogo_(g) {
  var lado = function (c) { return c.shortName ? { id: c.id, name: c.name, shortName: c.shortName } : { id: c.id, name: c.name }; };
  return { id: g.id, sportId: g.sportId, competitionId: g.competitionId, competitionDisplayName: String(g.competitionDisplayName || '').slice(0, 40), startTime: g.startTime, statusGroup: g.statusGroup, homeCompetitor: lado(g.homeCompetitor), awayCompetitor: lado(g.awayCompetitor) };
}

var NOME_FORA = { fc: 1, cf: 1, cd: 1, club: 1, clube: 1, de: 1, del: 1, la: 1, el: 1, sc: 1, ac: 1, ca: 1, afc: 1, atletico: 1, athletico: 1, deportivo: 1, real: 1, sport: 1, sporting: 1, esporte: 1, do: 1, da: 1, cr: 1, rb: 1, united: 1, city: 1, ec: 1, se: 1 };
var NOME_APELIDO = { mg: 'mineiro', pr: 'paranaense', go: 'goianiense', sp: 'paulista', rj: 'carioca', psg: 'germain' };

function nomeTokens_(s) {
  var todos = plain_(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).map(function (t) { return NOME_APELIDO[t] || t; })
    .filter(function (t) { return t.length > 2; });
  var fortes = todos.filter(function (t) { return !NOME_FORA[t]; });
  // "Sporting CP" so tem palavra comum: usa o que houver.
  return fortes.length ? fortes : todos;
}

function mesmoNome_(a, b) {
  var y = nomeTokens_(b);
  return nomeTokens_(a).some(function (t) { return y.indexOf(t) >= 0; });
}

// Feminino, reserva e base sao outro time, mesmo com o nome parecido.
function categoria_(nome, liga) {
  var t = plain_(nome + ' ' + (liga || ''));
  var c = [];
  if (/\(f\)|\bwomen|\bfemin|\bw\b/.test(t)) c.push('f');
  if (/\b(ii|iii|reserve|reserves|reservas|b team)\b/.test(plain_(nome))) c.push('r');
  var base = t.match(/\b(?:sub|u)[ -]?(\d{2})\b/);
  if (base) c.push('u' + base[1]);
  else if (/youth|primavera/.test(t)) c.push('base');
  return c.join(',');
}

// Na duvida, nao casa: placar de outro jogo geraria aviso falso.
function achaReserva_(planejado, lista) {
  var alvo = new Date(planejado.startTime).getTime();
  var cat = categoria_(planejado.homeCompetitor.name, planejado.competitionDisplayName);
  var pares = lista.filter(function (a) {
    if (Math.abs(new Date(a.t).getTime() - alvo) > 3 * 3600000) return false;
    if (planejado.sportId !== 3 && categoria_(a.h, a.liga) !== cat) return false;
    return mesmoNome_(planejado.homeCompetitor.name, a.h) && mesmoNome_(planejado.awayCompetitor.name, a.a);
  });
  return pares.length === 1 ? pares[0] : null;
}

function futebolReserva_(now) {
  var dia = Utilities.formatDate(new Date(now), 'America/Sao_Paulo', 'yyyyMMdd');
  try {
    var ms = [], vistos = {};
    (fetchJson_(FOTMOB + '/matches?date=' + dia + '&timezone=America%2FSao_Paulo&ccode3=BRA').leagues || []).forEach(function (l) {
      (l.matches || []).forEach(function (m) {
        // A FotMob repete o mesmo jogo em mais de uma lista.
        if (m.id != null && vistos[m.id]) return;
        vistos[m.id] = 1;
        var st = m.status || {};
        var curto = String((st.liveTime && st.liveTime.short) || '').replace(/[^0-9A-Za-z+]/g, '');
        ms.push({ fm: m.id, min: /^\d/.test(curto) ? curto + "'" : '', liga: l.name, h: m.home.name, a: m.away.name, sh: st.started ? Number(m.home.score) || 0 : -1, sa: st.started ? Number(m.away.score) || 0 : -1,
          t: st.utcTime, g: st.finished || st.cancelled || st.awarded ? 4 : st.started ? 3 : 2, txt: /^HT$/i.test(curto) ? 'Intervalo' : 'Ao vivo' });
      });
    });
    if (ms.length) return { lista: ms, fonte: 'FotMob' };
  } catch (err) { console.warn('FotMob: ' + err); }
  var ev = fetchJson_(ESPN_WEB + '/soccer/all/scoreboard').events || [];
  return { fonte: 'ESPN', lista: ev.map(function (e) {
    var c = e.competitions[0];
    var h = c.competitors.filter(function (x) { return x.homeAway === 'home'; })[0], a = c.competitors.filter(function (x) { return x.homeAway === 'away'; })[0];
    var st = e.status.type, g = st.state === 'in' ? 3 : st.state === 'post' ? 4 : 2;
    return { h: h.team.displayName, a: a.team.displayName, sh: g === 2 ? -1 : Number(h.score) || 0, sa: g === 2 ? -1 : Number(a.score) || 0, t: e.date, g: g, txt: /half.?time/i.test(st.description || '') ? 'Intervalo' : 'Ao vivo' };
  }) };
}

function tenisReserva_() {
  var out = [];
  ['atp', 'wta'].forEach(function (tour) {
    (fetchJson_(ESPN_WEB + '/tennis/' + tour + '/scoreboard').events || []).forEach(function (ev) {
      (ev.groupings || []).forEach(function (gr) {
        (gr.competitions || []).forEach(function (c) {
          if ((c.competitors || []).length !== 2) return;
          var h = c.competitors[0], a = c.competitors[1];
          var nome = function (p) { return (p.athlete && p.athlete.displayName) || ''; };
          var st = c.status.type.state, g = st === 'in' ? 3 : st === 'post' ? 4 : 2;
          var lh = h.linescores || [], la = a.linescores || [], sh = 0, sa = 0, stages = [];
          for (var i = 0; i < Math.max(lh.length, la.length); i++) {
            var u = lh[i] || {}, v = la[i] || {};
            if (u.winner) sh++; else if (v.winner) sa++;
            stages.push({ id: 27 + i, shortName: 'S' + (i + 1), homeCompetitorScore: Number(u.value) || 0, awayCompetitorScore: Number(v.value) || 0 });
          }
          stages.push({ id: 35, shortName: 'Sets', homeCompetitorScore: sh, awayCompetitorScore: sa });
          out.push({ h: nome(h), a: nome(a), sh: sh, sa: sa, t: c.date, g: g, txt: 'Ao vivo', stages: stages, wh: !!h.winner, wa: !!a.winner });
        });
      });
    });
  });
  return out;
}

// Jogos do plano com o placar lido da reserva, no mesmo formato e com os mesmos ids do 365Scores.
function jogosReserva_(plan, now) {
  var planejados = plan.games || [];
  var querFutebol = planejados.some(function (g) { return g.sportId === 1; });
  var querTenis = planejados.some(function (g) { return g.sportId === 3; });
  var fut = querFutebol ? futebolReserva_(now) : { lista: [], fonte: '' };
  var ten = querTenis ? tenisReserva_() : [];
  var games = [];
  planejados.forEach(function (pl) {
    var a = achaReserva_(pl, pl.sportId === 3 ? ten : fut.lista);
    if (!a) return;
    var g = JSON.parse(JSON.stringify(pl));
    g._alt = true;
    g.statusGroup = a.g;
    g.statusText = a.g === 4 ? 'Fim' : a.g === 2 ? 'Programação' : a.txt;
    if (a.fm) g._fm = a.fm;
    g.gameTimeDisplay = a.min || '';
    g.homeCompetitor.score = a.sh; g.awayCompetitor.score = a.sa;
    g.homeCompetitor.isWinner = !!a.wh; g.awayCompetitor.isWinner = !!a.wa;
    g.stages = a.stages || [];
    games.push(g);
  });
  return { games: games, fonte: fut.fonte || 'ESPN' };
}

function buildPlan_(devices, now) {
  var starts = [], live = false, games = [];
  fetchFollowedGames_(devices).forEach(function (g) {
    if (g.statusGroup === 4) return;
    if (g.statusGroup === 3) live = true;
    var t = new Date(g.startTime).getTime();
    if (t > now - 6 * 3600000 && t < now + 24 * 3600000) {
      starts.push(t);
      games.push(planoJogo_(g));
    }
  });
  var f1Active = false;
  if (devices.some(function (d) { return d.follows.f1; })) {
    try {
      f1Active = f1Sessions_(now).some(function (x) {
        var a = new Date(x.date_start).getTime(), z = new Date(x.date_end).getTime();
        // Inclui as horas depois do fim: o resultado pode demorar a sair.
        return now > a - 3600000 && now < z + 6 * 3600000;
      });
    } catch (err) {
      // F1 fora do ar nao pode parar a vigia de futebol e tenis.
      console.warn('plano F1: ' + err);
      f1Active = true;
    }
  }
  // Uma Property guarda 9 KB: acompanhados e ao vivo ficam, o resto fica de fora so da reserva.
  var vigiados = {};
  devices.forEach(function (d) { (d.watch || []).forEach(function (w) { vigiados[w.g] = 1; }); });
  var peso = function (x) { return (vigiados[x.id] ? 0 : 2) + (x.statusGroup === 3 ? 0 : 1); };
  games.sort(function (u, v) { return peso(u) - peso(v) || new Date(u.startTime) - new Date(v.startTime); });
  var plano = { at: now, starts: starts.slice(0, 80), live: live, f1Active: f1Active, games: games };
  while (bytes_(JSON.stringify(plano)) > 8500 && plano.games.length) plano.games.pop();
  return plano;
}

function shortName_(c) { return c.shortName || c.name; }

function scoreLine_(g, cur) {
  var h = cur ? cur.h : num_(g.homeCompetitor.score), a = cur ? cur.a : num_(g.awayCompetitor.score);
  return shortName_(g.homeCompetitor) + ' ' + h + ' x ' + a + ' ' + shortName_(g.awayCompetitor);
}

function num_(x) { return x == null || x < 0 ? 0 : Math.round(x); }

function setScores_(g) {
  return (g.stages || []).filter(function (s) { return /^S\d/.test(s.shortName || '') && s.homeCompetitorScore >= 0; })
    .map(function (s) { return num_(s.homeCompetitorScore) + '-' + num_(s.awayCompetitorScore); }).join(' ');
}

function setsWon_(g) {
  var s = (g.stages || []).filter(function (x) { return x.id === 35 || x.shortName === 'Sets'; })[0];
  return s ? num_(s.homeCompetitorScore) + '-' + num_(s.awayCompetitorScore) : '';
}

function watchDe_(d, g, now) {
  return (d.watch || []).filter(function (w) { return w.g === g.id && (!w.t || now < w.t + 10 * 3600000); })[0];
}

function pollGames_(games, devices, mem, writes, out, now, stale, partial) {
  games.forEach(function (g) {
    var key = 'g:' + g.id;
    var prev = mem[key] ? JSON.parse(mem[key]) : null;
    var t = new Date(g.startTime).getTime();
    var h = num_(g.homeCompetitor.score), a = num_(g.awayCompetitor.score);
    var cur = {
      s: g.statusGroup, h: h, a: a,
      st: g.statusText || '', sw: setsWon_(g),
      rem: prev ? prev.rem : 0, lu: prev ? prev.lu : 0, ev: prev ? prev.ev : [],
      gh: prev && prev.gh != null ? prev.gh : h, ga: prev && prev.ga != null ? prev.ga : a,
      card: prev ? prev.card : 0, last: prev ? prev.last : '',
      t: t
    };
    var events = [];
    // Jogo ja em andamento na primeira leitura, ou leitura apos parada: so registra, sem disparar o passado.
    var baseline = g.statusGroup !== 2 && (!prev || stale);
    try {
      if (!baseline) {
        if (g.sportId === 1) footballEvents_(g, prev, cur, events, now, t);
        else if (g.sportId === 3) tennisEvents_(g, prev, cur, events, now, t);
      } else {
        cur.gh = h; cur.ga = a;
        if (g.sportId === 1 && g.statusGroup === 3 && !g._alt) {
          var passado = detailEvents_(g);
          cur.ev = passado.map(function (e) { return e.k; });
          var marcos = passado.filter(function (e) { return e.type === 1 || e.type === 3; });
          if (marcos.length) cur.last = cabecaEvento_(g, marcos[marcos.length - 1]);
        }
      }
    } catch (err) {
      // Erro em um jogo nao derruba os outros; a memoria dele fica como estava e tenta no proximo minuto.
      partial.push('jogo ' + g.id + ': ' + err);
      return;
    }
    if (events.length) {
      var ultimo = events.filter(function (ev) { return ev.rule !== 'remind' && ev.rule !== 'lineup'; }).slice(-1)[0];
      if (ultimo) cur.last = (ultimo.head || ultimo.title).slice(0, 70);
    }
    enviarCartoes_(g, cur, prev, events, devices, out, now);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(cur)) writes[key] = JSON.stringify(cur);
  });
}

var CARTAO_PRINCIPAL = { remind: 1, lineup: 1, kick: 1, goal: 1, red: 1, ht: 1, end: 1, tStart: 1, tSet: 1, tEnd: 1 };

// Quem acompanha recebe um cartao unico por jogo; os demais, os avisos normais.
function enviarCartoes_(g, cur, prev, events, devices, out, now) {
  var cartoes = {};
  var enviou = false;
  var acabou = g.statusGroup === 4;
  devices.forEach(function (d) {
    var w = watchDe_(d, g, now);
    if (!w) {
      events.forEach(function (ev) {
        if (wants_(d, g, ev.rule, now)) out.push({ dev: d, msg: { title: ev.title, body: ev.body, tag: ev.tag || ('j' + g.id), url: '#/jogo/' + g.id } });
      });
      return;
    }
    var lances = events.filter(function (ev) { return w.m === 'all' || CARTAO_PRINCIPAL[ev.rule]; });
    var resumo = g.statusGroup === 3 && now - (cur.card || 0) >= 15 * 60000;
    // Fim sempre gera o ultimo cartao, mesmo se o robo nao viu o apito (parada, jogo cancelado).
    if (!acabou && !lances.length && !w.novo && !resumo) return;
    if (!cartoes[w.m]) cartoes[w.m] = montarCartao_(g, cur, lances, now);
    var c = cartoes[w.m];
    out.push({ dev: d, msg: { title: c.title, body: c.body, tag: 'live' + g.id, url: '#/jogo/' + g.id, live: true, fim: acabou } });
    enviou = true;
    if (w.novo) { w.novo = false; d._mudou = true; }
    // Encerrada so depois da entrega, no fim do ciclo.
    if (acabou) { d._tirar = (d._tirar || []).concat([g.id]); d._mudou = true; }
  });
  if (enviou) cur.card = now;
  return enviou;
}

function aplicarFimDasVigias_(devices) {
  devices.forEach(function (d) {
    if (!d._mudou) return;
    var tirar = d._tirar || [];
    if (tirar.length) {
      d.watch = (d.watch || []).filter(function (x) { return tirar.indexOf(x.g) < 0; });
      d.fim = (d.fim || []).concat(tirar).slice(-10);
    }
    delete d._tirar;
    delete d._mudou;
    saveDevice_(d);
  });
}

function par_(stats, re, g) {
  var lista = (stats || []).filter(function (x) { return re.test(x.name || ''); });
  var pega = function (id) { var it = lista.filter(function (x) { return x.competitorId === id; })[0]; return it ? String(it.value) : null; };
  var u = pega(g.homeCompetitor.id), v = pega(g.awayCompetitor.id);
  return u != null && v != null ? [u, v] : null;
}

function primeiroNum_(v) { var m = String(v).match(/\d+/); return m ? m[0] : '0'; }

function estatisticasCartao_(g) {
  try {
    if (g._fm) {
      var det = fetchJson_(FOTMOB + '/matchDetails?matchId=' + g._fm).content;
      var top = det.stats.Periods.All.stats[0].stats;
      var nomes = { BallPossesion: 'Posse de Bola', ShotsOnTarget: 'Chutes no gol', total_shots: 'Total de chutes', corners: 'Escanteios' };
      var out = [];
      top.forEach(function (x) {
        if (nomes[x.key] && x.stats) {
          out.push({ name: nomes[x.key], competitorId: g.homeCompetitor.id, value: x.key === 'BallPossesion' ? x.stats[0] + '%' : x.stats[0] });
          out.push({ name: nomes[x.key], competitorId: g.awayCompetitor.id, value: x.key === 'BallPossesion' ? x.stats[1] + '%' : x.stats[1] });
        }
      });
      return out;
    }
    if (g._alt) return [];
    return fetchJson_(API + '/game/stats/?' + API_Q + '&games=' + g.id).statistics || [];
  } catch (err) {
    console.warn('estatisticas: ' + err);
    return [];
  }
}

// Quem finalizou mais nos ultimos 15 minutos.
function pressao_(g) {
  if (g._alt || g.statusGroup !== 3 || !(g.gameTime > 0)) return '';
  try {
    var d = fetchJson_(API + '/game/?' + API_Q + '&gameId=' + g.id).game;
    var ev = (d.chartEvents && d.chartEvents.events) || [];
    var c = [0, 0];
    ev.forEach(function (e) {
      var m = String(e.time).match(/(\d+)(?:\+(\d+))?/);
      var min = m ? Number(m[1]) + Number(m[2] || 0) : -1;
      if (min >= g.gameTime - 15 && min <= g.gameTime + 1) c[e.competitorNum === 1 ? 0 : 1]++;
    });
    if (c[0] + c[1] < 3 || Math.max(c[0], c[1]) < 2 * Math.min(c[0], c[1])) return '';
    return 'Pressão: ' + shortName_(c[0] > c[1] ? g.homeCompetitor : g.awayCompetitor) + ' (' + c[0] + ' x ' + c[1] + ' chutes em 15 min)';
  } catch (err) {
    return '';
  }
}

function relogio_(g) {
  if (g.statusGroup === 4) return 'Fim';
  if (/intervalo/i.test(g.statusText || '')) return 'Intervalo';
  if (g.gameTimeDisplay) return String(g.gameTimeDisplay).replace(/\s/g, '');
  if (g.gameTime > 0) return Math.floor(g.gameTime) + "'";
  return '';
}

function sobrenome_(n) { var p = String(n || '').trim().split(/\s+/); return p[p.length - 1]; }

function montarCartao_(g, cur, lances, now) {
  var cabeca = lances.map(function (ev) { return ev.head || ev.title; }).slice(-2).join(' · ');
  if (!cabeca && g.statusGroup === 4) cabeca = /cancel/i.test(g.statusText || '') ? 'Jogo cancelado' : 'Fim de jogo';
  var stats = g.statusGroup === 2 ? [] : estatisticasCartao_(g);
  var linhas = [];
  if (g.sportId === 3) {
    var sets = (g.stages || []).filter(function (x) { return /^S\d/.test(x.shortName || '') && x.homeCompetitorScore >= 0; });
    var placar = sets.map(function (x) { return num_(x.homeCompetitorScore) + '-' + num_(x.awayCompetitorScore); }).join(' ');
    var titulo = sobrenome_(g.homeCompetitor.name) + (placar ? ' ' + placar + ' ' : ' x ') + sobrenome_(g.awayCompetitor.name);
    if (g.statusGroup === 2) {
      linhas.push(cabeca || ('Previsto para ' + Utilities.formatDate(new Date(g.startTime), 'America/Sao_Paulo', 'HH:mm')));
      if (g.competitionDisplayName) linhas.push(g.competitionDisplayName);
      return { title: titulo, body: linhas.join('\n') };
    }
    var game = (g.stages || []).filter(function (x) { return x.id === 34 && x.isLive; })[0];
    var fmt = function (v) { return v === 50 ? 'AD' : num_(v); };
    linhas.push(cabeca || (g.statusText || '') + (game ? ' · Game ' + fmt(game.homeCompetitorScore) + '-' + fmt(game.awayCompetitorScore) : ''));
    var ace = par_(stats, /^Ace$/i, g), dupla = par_(stats, /^Dupla falta/i, g), breaks = par_(stats, /^Break points/i, g), pts = par_(stats, /^Total de pontos/i, g);
    var l2 = [], l3 = [];
    if (ace) l2.push('Aces ' + primeiroNum_(ace[0]) + ' x ' + primeiroNum_(ace[1]));
    if (dupla) l2.push('Duplas ' + primeiroNum_(dupla[0]) + ' x ' + primeiroNum_(dupla[1]));
    if (breaks) l3.push('Quebras ' + primeiroNum_(breaks[0]) + ' x ' + primeiroNum_(breaks[1]));
    if (pts) l3.push('Pontos ' + primeiroNum_(pts[0]) + ' x ' + primeiroNum_(pts[1]));
    if (l2.length) linhas.push(l2.join(' · '));
    if (l3.length) linhas.push(l3.join(' · '));
    return { title: titulo, body: linhas.join('\n') };
  }
  var relogio = relogio_(g);
  if (g.statusGroup === 2) {
    var titulo2 = shortName_(g.homeCompetitor) + ' x ' + shortName_(g.awayCompetitor);
    linhas.push(cabeca || ('Começa às ' + Utilities.formatDate(new Date(g.startTime), 'America/Sao_Paulo', 'HH:mm')));
    if (g.competitionDisplayName) linhas.push(g.competitionDisplayName);
    return { title: titulo2, body: linhas.join('\n') };
  }
  var tituloF = shortName_(g.homeCompetitor) + ' ' + cur.h + ' x ' + cur.a + ' ' + shortName_(g.awayCompetitor) + (relogio ? ' · ' + relogio : '');
  if (cabeca) linhas.push(cabeca);
  else if (cur.last) linhas.push('Último lance: ' + cur.last);
  var posse = par_(stats, /^Posse de Bola/i, g), gol = par_(stats, /^Chutes no gol/i, g), chutes = par_(stats, /^Total de chutes/i, g), esc = par_(stats, /^Escanteios/i, g);
  var a1 = [], a2 = [];
  if (posse) a1.push('Posse ' + posse[0] + ' x ' + posse[1]);
  if (gol) a1.push('No gol ' + gol[0] + ' x ' + gol[1]);
  if (chutes) a2.push('Chutes ' + chutes[0] + ' x ' + chutes[1]);
  if (esc) a2.push('Escanteios ' + esc[0] + ' x ' + esc[1]);
  if (a1.length) linhas.push(a1.join(' · '));
  if (a2.length) linhas.push(a2.join(' · '));
  var pr = pressao_(g);
  if (pr && linhas.length < 4) linhas.push(pr);
  if (!linhas.length) linhas.push(g.competitionDisplayName || 'Ao vivo');
  return { title: tituloF, body: linhas.join('\n') };
}

function cabecaEvento_(g, e) {
  var side = e.comp === g.homeCompetitor.id ? g.homeCompetitor : g.awayCompetitor;
  var quem = e.name ? e.name + (e.min ? ' ' + e.min : '') : shortName_(side);
  if (e.type === 1) return 'GOL! ' + quem;
  if (e.type === 3) return 'Vermelho: ' + quem + ' (' + shortName_(side) + ')';
  if (e.type === 2) return 'Amarelo: ' + quem + ' (' + shortName_(side) + ')';
  if (e.type === 1000) return shortName_(side) + ': entra ' + (e.name || '?') + (e.out ? ', sai ' + e.out : '') + (e.min ? ' ' + e.min : '');
  return (e.typeName || 'Lance') + ': ' + quem;
}

function wants_(d, g, rule, now) {
  var f = d.follows || {};
  var ids = [g.homeCompetitor.id, g.awayCompetitor.id];
  var mute = f.mute || [];
  var followsTeam = ids.some(function (id) { return (f.c || []).indexOf(id) >= 0 && mute.indexOf(id) < 0; });
  // Campeonato silenciado vai com sinal negativo para nao colidir com id de time.
  var followsComp = (f.comp || []).indexOf(g.competitionId) >= 0 && mute.indexOf(-g.competitionId) < 0;
  if (!followsTeam && !followsComp) return false;
  return ruleAllowed_(d, rule, now);
}

function ruleAllowed_(d, rule, now) {
  if (!(d.rules || DEFAULT_RULES)[rule]) return false;
  if (d.spoiler && ['goal', 'red', 'ht', 'end', 'tSet', 'tEnd', 'f1End'].indexOf(rule) >= 0) return false;
  return !inQuiet_(d, now);
}

function inQuiet_(d, now) {
  if (!d.quiet || !d.quiet.on) return false;
  var h = Number(Utilities.formatDate(new Date(now), 'America/Sao_Paulo', 'H'));
  var a = d.quiet.from, b = d.quiet.to;
  return a <= b ? (h >= a && h < b) : (h >= a || h < b);
}

function detailEvents_(game) {
  var g = fetchJson_(API + '/game/?' + API_Q + '&gameId=' + game.id).game;
  var byId = {};
  (g.members || []).forEach(function (m) { byId[m.athleteId] = m; byId[m.id] = m; });
  var penStages = {};
  (g.stages || []).forEach(function (s) { if (/p[eê]n/i.test((s.name || '') + ' ' + (s.shortName || ''))) penStages[s.id] = 1; });
  var nome = function (id) { var m = byId[id] || {}; return m.shortName || m.name || ''; };
  return (g.events || []).filter(function (e) {
    // Cobranca de disputa de penaltis nao e gol do jogo.
    return e.eventType && !penStages[e.stageId];
  }).map(function (e) {
    return {
      k: e.eventType.id + ':' + e.competitorId + ':' + e.gameTime + ':' + (e.playerId || 0),
      type: e.eventType.id, typeName: e.eventType.name || '', name: nome(e.playerId),
      out: (e.extraPlayers || []).map(nome).filter(Boolean)[0] || '',
      min: e.gameTimeDisplay || '', comp: e.competitorId
    };
  });
}

function footballEvents_(g, prev, cur, events, now, t) {
  var title = shortName_(g.homeCompetitor) + ' x ' + shortName_(g.awayCompetitor);
  if (g.statusGroup === 2) {
    var mins = (t - now) / 60000;
    if (!cur.rem && mins > 0 && mins <= 20) {
      cur.rem = 1;
      events.push({ rule: 'remind', title: title, head: 'Começa em ' + Math.max(1, Math.round(mins)) + ' min', body: 'Começa em ' + Math.max(1, Math.round(mins)) + ' min · ' + (g.competitionDisplayName || ''), tag: 'j' + g.id });
    }
    if (!g._alt && !cur.lu && mins > 0 && mins <= 75 && Math.floor(now / 60000) % 5 === 0) {
      var lg = fetchJson_(API + '/game/?' + API_Q + '&gameId=' + g.id).game;
      var hl = lg.homeCompetitor.lineups, al = lg.awayCompetitor.lineups;
      if (hl && al && hl.status === 'Confirmado' && al.status === 'Confirmado') {
        cur.lu = 1;
        events.push({ rule: 'lineup', title: 'Escalações confirmadas', body: title, tag: 'j' + g.id + 'l' });
      }
    }
    return;
  }
  if (prev && prev.s === 2 && g.statusGroup === 3) events.push({ rule: 'kick', title: 'Bola rolando', head: 'Bola rolando', body: title, tag: 'j' + g.id });

  var scoreChanged = prev && (prev.h !== cur.h || prev.a !== cur.a);
  // Gol anulado: reduz o que ja foi avisado para o proximo gol valer de novo.
  // A reserva pode estar um lance atras do 365Scores: ali, placar menor nao significa gol anulado.
  if (g._alt && (cur.h < cur.gh || cur.a < cur.ga)) {
    cur.h = Math.max(cur.h, cur.gh); cur.a = Math.max(cur.a, cur.ga);
  }
  if (cur.h < cur.gh || cur.a < cur.ga) {
    events.push({ rule: 'goal', title: 'Gol anulado', body: scoreLine_(g), tag: 'j' + g.id + 'var' + now });
    cur.gh = Math.min(cur.gh, cur.h); cur.ga = Math.min(cur.ga, cur.a);
  }
  if (g.statusGroup === 3 || scoreChanged) {
    var det = g._alt ? [] : detailEvents_(g);
    var seen = ((prev && prev.ev) || []).slice();
    det.forEach(function (e) {
      if (seen.indexOf(e.k) >= 0) return;
      var home = e.comp === g.homeCompetitor.id;
      var side = home ? g.homeCompetitor : g.awayCompetitor;
      if (e.type === 1) {
        var told = home ? cur.gh : cur.ga, score = home ? cur.h : cur.a;
        var counted = seen.filter(function (k) { return k.indexOf('1:' + e.comp + ':') === 0; }).length;
        // Lance chegou antes do placar: espera o placar para nao avisar com numero velho.
        if (counted >= score) return;
        // Placar ja avisado sem autor: o lance so completa a memoria, sem repetir o aviso.
        if (score <= told) { seen.push(e.k); return; }
        seen.push(e.k);
        if (home) cur.gh++; else cur.ga++;
        events.push({ rule: 'goal', title: 'GOL do ' + shortName_(side) + '!', head: cabecaEvento_(g, e), body: scoreLine_(g) + (e.name ? ' · ' + e.name : '') + (e.min ? ' ' + e.min : ''), tag: 'j' + g.id + 'g' + e.k });
      } else if (e.type === 3) {
        seen.push(e.k);
        events.push({ rule: 'red', title: 'Vermelho: ' + shortName_(side), head: cabecaEvento_(g, e), body: (e.name ? e.name + ' · ' : '') + scoreLine_(g) + (e.min ? ' · ' + e.min : ''), tag: 'j' + g.id + 'r' + e.k });
      } else {
        // Amarelo, troca e pênalti perdido so interessam a quem acompanha no modo completo.
        seen.push(e.k);
        events.push({ rule: 'extra', title: cabecaEvento_(g, e), head: cabecaEvento_(g, e), body: scoreLine_(g), tag: 'j' + g.id + 'x' + e.k });
      }
    });
    cur.ev = seen;
    // Placar subiu e o lance ainda nao veio: avisa ja, sem autor. O lance depois nao repete.
    while (cur.h > cur.gh) {
      cur.gh++;
      events.push({ rule: 'goal', title: 'GOL do ' + shortName_(g.homeCompetitor) + '!', body: scoreLine_(g), tag: 'j' + g.id + 'gh' + cur.gh });
    }
    while (cur.a > cur.ga) {
      cur.ga++;
      events.push({ rule: 'goal', title: 'GOL do ' + shortName_(g.awayCompetitor) + '!', body: scoreLine_(g), tag: 'j' + g.id + 'ga' + cur.ga });
    }
  }
  if (prev && prev.st !== cur.st && /intervalo/i.test(cur.st)) events.push({ rule: 'ht', title: 'Intervalo', body: scoreLine_(g), tag: 'j' + g.id });
  if (prev && prev.s === 3 && g.statusGroup === 4) events.push({ rule: 'end', title: 'Fim de jogo', body: scoreLine_(g, cur), tag: 'j' + g.id });
}

function tennisEvents_(g, prev, cur, events, now, t) {
  var title = g.homeCompetitor.name + ' x ' + g.awayCompetitor.name;
  if (prev && prev.s === 2 && g.statusGroup === 3) events.push({ rule: 'tStart', title: 'Em quadra', body: title, tag: 'j' + g.id });
  if (g.statusGroup === 2 && !cur.rem && t - now > 0 && t - now <= 20 * 60000) {
    cur.rem = 1;
    events.push({ rule: 'remind', title: title, body: 'Previsto para daqui a ' + Math.max(1, Math.round((t - now) / 60000)) + ' min · ' + (g.competitionDisplayName || ''), tag: 'j' + g.id });
  }
  // Antes do jogo a API nao traz sets: a passagem de vazio para 0-0 nao e fim de set.
  if (prev && g.statusGroup === 3 && prev.sw && prev.sw !== cur.sw && cur.sw) {
    events.push({ rule: 'tSet', title: 'Set encerrado: ' + cur.sw, body: title + ' · ' + setScores_(g), tag: 'j' + g.id });
  }
  if (prev && prev.s === 3 && g.statusGroup === 4) {
    var w = g.homeCompetitor.isWinner ? g.homeCompetitor : g.awayCompetitor.isWinner ? g.awayCompetitor : null;
    events.push({ rule: 'tEnd', title: w ? w.name + ' venceu' : 'Fim de jogo', body: title + ' · ' + setScores_(g), tag: 'j' + g.id });
  }
}

var F1_NAMES = { 'Qualifying': 'Classificação', 'Race': 'Corrida', 'Sprint': 'Sprint', 'Sprint Qualifying': 'Classificação Sprint', 'Sprint Shootout': 'Classificação Sprint' };
var F1_GP = {
  Australia: 'da Austrália', China: 'da China', Japan: 'do Japão', Bahrain: 'do Bahrein', 'Saudi Arabia': 'da Arábia Saudita',
  'United States': 'dos Estados Unidos', Italy: 'da Itália', Monaco: 'de Mônaco', Spain: 'da Espanha', Canada: 'do Canadá',
  Austria: 'da Áustria', 'United Kingdom': 'da Inglaterra', Belgium: 'da Bélgica', Hungary: 'da Hungria', Netherlands: 'da Holanda',
  Azerbaijan: 'do Azerbaijão', Singapore: 'de Singapura', Mexico: 'do México', Brazil: 'do Brasil', Qatar: 'do Catar',
  'United Arab Emirates': 'de Abu Dhabi'
};

// Janela curta para a resposta caber na vigia; a ESPN bloqueia os servidores do Google (403).
var F1_ESPN = { FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3', Qual: 'Qualifying', Race: 'Race', Sprint: 'Sprint', SR: 'Sprint', SQ: 'Sprint Qualifying', SS: 'Sprint Qualifying' };

function f1Sessions_(now) {
  var fmt = function (ms) { return new Date(ms).toISOString().slice(0, 19); };
  try {
    return fetchJson_(OPENF1 + '/sessions?date_start%3E=' + fmt(now - 12 * 3600000) + '&date_start%3C=' + fmt(now + 2 * 3600000))
      .filter(function (x) { return !x.is_cancelled; });
  } catch (err) {
    console.warn('OpenF1 fora, usando ESPN: ' + err);
    var ev = (fetchJson_(ESPN_WEB + '/racing/f1/scoreboard').events || [])[0];
    if (!ev) return [];
    return ev.competitions.map(function (c) {
      var a = new Date(c.date).getTime();
      return { session_key: 'e' + c.id, session_name: F1_ESPN[c.type.abbreviation] || c.type.abbreviation, date_start: c.date, date_end: new Date(a + 2 * 3600000).toISOString(), gp_name: ev.name, _espn: c };
    }).filter(function (x) { var a = new Date(x.date_start).getTime(); return a > now - 12 * 3600000 && a < now + 2 * 3600000; });
  }
}

// Resultado: OpenF1, depois ESPN. Lista vazia significa que ainda nao saiu.
function f1Top_(x) {
  try {
    if (x._espn) throw new Error('sessao da reserva');
    var res = fetchJson_(OPENF1 + '/session_result?session_key=' + x.session_key).filter(function (r) { return r.position != null; })
      .sort(function (u, v) { return u.position - v.position; });
    if (!res.length) return [];
    var drv = {};
    fetchJson_(OPENF1 + '/drivers?session_key=' + x.session_key).forEach(function (d) { drv[d.driver_number] = d; });
    return res.map(function (r) { var d = drv[r.driver_number] || {}; return { pos: r.position, last: d.last_name || ('Carro ' + r.driver_number), full: ((d.first_name || '') + ' ' + (d.last_name || '')).trim() }; });
  } catch (err) {
    var alvo = new Date(x.date_start).getTime();
    var ev = (fetchJson_(ESPN_WEB + '/racing/f1/scoreboard').events || [])[0];
    var c = x._espn || (ev && ev.competitions.filter(function (s) { return Math.abs(new Date(s.date).getTime() - alvo) < 3600000; })[0]);
    return ((c && c.competitors) || []).slice().sort(function (u, v) { return (u.order || 99) - (v.order || 99); }).map(function (p, i) {
      var nome = String(p.athlete.displayName || '');
      return { pos: i + 1, last: nome.split(' ').slice(-1)[0], full: nome };
    });
  }
}

function f1GpName_(x) {
  if (x.gp_name) return x.gp_name;
  var gp = F1_GP[x.country_name];
  return gp ? 'GP ' + gp : 'GP: ' + x.country_name;
}

function pollF1_(devices, mem, writes, out, now, stale) {
  var fans = devices.filter(function (d) { return d.follows.f1; });
  if (!fans.length) return;
  f1Sessions_(now).forEach(function (x) {
    var name = F1_NAMES[x.session_name];
    if (!name) return;
    // Chave pelo horario: a sessao e a mesma em qualquer fonte, sem repetir aviso na troca.
    var key = 'f:' + new Date(x.date_start).getTime();
    var prev = mem[key] ? JSON.parse(mem[key]) : null;
    var a = new Date(x.date_start).getTime(), z = new Date(x.date_end).getTime();
    var state = now < a ? 'pre' : now <= z ? 'in' : 'post';
    // Sessao que ja tinha acabado na primeira leitura nao vira aviso atrasado.
    var cur = { st: state, rem: prev ? prev.rem : 0, done: prev ? prev.done : (state === 'post' ? 1 : 0), t: a };
    var msgs = [];
    var gp = f1GpName_(x);
    if (!stale && state === 'pre' && !cur.rem && a - now <= 30 * 60000) {
      cur.rem = 1;
      msgs.push({ rule: 'f1Remind', title: name + ' em ' + Math.max(1, Math.round((a - now) / 60000)) + ' min', body: gp });
    }
    if (!stale && prev && prev.st === 'pre' && state === 'in') msgs.push({ rule: 'f1Start', title: name + ' começou', body: gp });
    if (state === 'post' && !cur.done && now < z + 6 * 3600000) {
      var top = f1Top_(x);
      if (top.length) {
        cur.done = 1;
        msgs.push({ rule: 'f1End', title: name + ': ' + gp, body: top.slice(0, 3).map(function (c) { return c.pos + '. ' + c.last; }).join('  '), top: top });
      }
    }
    if (!prev || prev.st !== cur.st || prev.rem !== cur.rem || prev.done !== cur.done) writes[key] = JSON.stringify(cur);
    msgs.forEach(function (m) {
      fans.forEach(function (d) {
        if (!ruleAllowed_(d, m.rule, now)) return;
        var body = m.body;
        if (m.top && d.follows.drivers && d.follows.drivers.length) {
          m.top.forEach(function (c) {
            var full = plain_(c.full);
            var mine = d.follows.drivers.some(function (n) { return full.indexOf(plain_(n)) >= 0; });
            if (c.pos > 3 && mine) body += '  ·  ' + c.pos + '. ' + c.last;
          });
        }
        out.push({ dev: d, msg: { title: m.title, body: body, tag: 'f' + a, url: '#/f1' } });
      });
    });
  });
}

function plain_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

// Memoria de jogos antigos: limpa ao refazer o plano, para nao estourar a cota de Properties.
function cleanup_() {
  var p = props_(), all = p.getProperties(), cut = Date.now() - 3 * 86400000;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('g:') === 0 || k.indexOf('f:') === 0) {
      try { if (JSON.parse(all[k]).t < cut) p.deleteProperty(k); } catch (_) { p.deleteProperty(k); }
    }
  });
}
