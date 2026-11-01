// Robo da Tribuna: vigia jogos seguidos a cada minuto e dispara Web Push.
// Nenhum segredo fica no codigo: chaves e PIN sao gerados em initOnce e guardados em Script Properties.

var API = 'https://webws.365scores.com/web';
var API_Q = 'appTypeId=5&langId=31&timezoneName=America/Sao_Paulo&userCountryId=21';
var OPENF1 = 'https://api.openf1.org/v1';
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
    return json_({ ok: false, error: 'acao desconhecida' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var req = JSON.parse(e.postData.contents);
    if (req.a === 'subscribe') return json_(subscribe_(req));
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
  var q = req.quiet;
  d.quiet = q && q.on ? { on: true, from: Number(q.from) || 0, to: Number(q.to) || 0 } : { on: false };
  return d;
}

function subscribe_(req) {
  var p = props_();
  var existing = req.id && req.secret ? authDevice_(req) : null;
  if (!existing) {
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
  p.deleteProperty('plan');
  return { ok: true, id: d.id, secret: d.secret };
}

function savePrefs_(dev, req) {
  cleanPrefs_(req, dev);
  saveDevice_(dev);
  props_().deleteProperty('plan');
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
        headers: { Authorization: auths[origin], TTL: '1800', Urgency: 'high', 'Content-Encoding': 'aes128gcm' },
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
  var all = pending.concat(items.map(function (it) { return { dev: it.dev, msg: it.msg, at: now }; }));
  if (!all.length) { if (q.length) p.deleteProperty('queue'); return; }
  var r = pushMany_(all);
  var next = (r.retry || []).map(function (it) { return { id: it.dev.id, msg: it.msg, at: it.at || now }; });
  var text = JSON.stringify(next);
  while (text.length > 8000 && next.length) { next.shift(); text = JSON.stringify(next); }
  if (next.length) p.setProperty('queue', text); else if (q.length) p.deleteProperty('queue');
}

function toSigned_(u8) {
  var a = new Array(u8.length);
  for (var i = 0; i < u8.length; i++) a[i] = u8[i] > 127 ? u8[i] - 256 : u8[i];
  return a;
}

// ---------- Vigia ----------

function fetchJson_(url) {
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
  try {
    var now = Date.now();
    p.setProperty('lastTick', String(now));
    if (!p.getProperty('vapid')) return;
    var devices = loadDevices_();
    if (!devices.length) return;

    var plan = JSON.parse(p.getProperty('plan') || 'null');
    if (!plan || now - plan.at > 30 * 60000) {
      plan = buildPlan_(devices, now);
      // Salvo antes de qualquer saida: refazer o plano todo minuto estoura a cota diaria do gatilho.
      p.setProperty('plan', JSON.stringify(plan));
      cleanup_();
    }
    var active = plan.live || plan.starts.some(function (t) { return now >= t - 90 * 60000 && now <= t + 5 * 3600000; });
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
      pollGames_(fetchFollowedGames_(devices), devices, mem, writes, out, now, stale, partial);
    }
    if (plan.f1Active) {
      try { pollF1_(devices, mem, writes, out, now, stale); } catch (err) { partial.push('F1: ' + err); }
    }
    if (Object.keys(writes).length) p.setProperties(writes);
    deliver_(out, devices, now);
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

function buildPlan_(devices, now) {
  var starts = [], live = false;
  fetchFollowedGames_(devices).forEach(function (g) {
    if (g.statusGroup === 4) return;
    if (g.statusGroup === 3) live = true;
    var t = new Date(g.startTime).getTime();
    if (t > now - 6 * 3600000 && t < now + 24 * 3600000) starts.push(t);
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
  return { at: now, starts: starts, live: live, f1Active: f1Active };
}

function shortName_(c) { return c.shortName || c.name; }

function scoreLine_(g) {
  return shortName_(g.homeCompetitor) + ' ' + num_(g.homeCompetitor.score) + ' x ' + num_(g.awayCompetitor.score) + ' ' + shortName_(g.awayCompetitor);
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
        if (g.sportId === 1 && g.statusGroup === 3) cur.ev = detailEvents_(g).map(function (e) { return e.k; });
      }
    } catch (err) {
      // Erro em um jogo nao derruba os outros; a memoria dele fica como estava e tenta no proximo minuto.
      partial.push('jogo ' + g.id + ': ' + err);
      return;
    }
    if (!prev || JSON.stringify(prev) !== JSON.stringify(cur)) writes[key] = JSON.stringify(cur);
    events.forEach(function (ev) {
      devices.forEach(function (d) {
        if (wants_(d, g, ev.rule, now)) out.push({ dev: d, msg: { title: ev.title, body: ev.body, tag: ev.tag || ('j' + g.id), url: '#/jogo/' + g.id } });
      });
    });
  });
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
  return (g.events || []).filter(function (e) {
    // Cobranca de disputa de penaltis nao e gol do jogo.
    return e.eventType && (e.eventType.id === 1 || e.eventType.id === 3) && !penStages[e.stageId];
  }).map(function (e) {
    var m = byId[e.playerId] || {};
    return {
      k: e.eventType.id + ':' + e.competitorId + ':' + e.gameTime + ':' + (e.playerId || 0),
      type: e.eventType.id, name: m.shortName || m.name || '',
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
      events.push({ rule: 'remind', title: title, body: 'Começa em ' + Math.max(1, Math.round(mins)) + ' min · ' + (g.competitionDisplayName || ''), tag: 'j' + g.id });
    }
    if (!cur.lu && mins > 0 && mins <= 75 && Math.floor(now / 60000) % 5 === 0) {
      var lg = fetchJson_(API + '/game/?' + API_Q + '&gameId=' + g.id).game;
      var hl = lg.homeCompetitor.lineups, al = lg.awayCompetitor.lineups;
      if (hl && al && hl.status === 'Confirmado' && al.status === 'Confirmado') {
        cur.lu = 1;
        events.push({ rule: 'lineup', title: 'Escalações confirmadas', body: title, tag: 'j' + g.id + 'l' });
      }
    }
    return;
  }
  if (prev && prev.s === 2 && g.statusGroup === 3) events.push({ rule: 'kick', title: 'Bola rolando', body: title, tag: 'j' + g.id });

  var scoreChanged = prev && (prev.h !== cur.h || prev.a !== cur.a);
  // Gol anulado: reduz o que ja foi avisado para o proximo gol valer de novo.
  if (cur.h < cur.gh || cur.a < cur.ga) {
    events.push({ rule: 'goal', title: 'Gol anulado', body: scoreLine_(g), tag: 'j' + g.id + 'var' + now });
    cur.gh = Math.min(cur.gh, cur.h); cur.ga = Math.min(cur.ga, cur.a);
  }
  if (g.statusGroup === 3 || scoreChanged) {
    var det = detailEvents_(g);
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
        events.push({ rule: 'goal', title: 'GOL do ' + shortName_(side) + '!', body: scoreLine_(g) + (e.name ? ' · ' + e.name : '') + (e.min ? ' ' + e.min : ''), tag: 'j' + g.id + 'g' + e.k });
      } else if (e.type === 3) {
        seen.push(e.k);
        events.push({ rule: 'red', title: 'Vermelho: ' + shortName_(side), body: (e.name ? e.name + ' · ' : '') + scoreLine_(g) + (e.min ? ' · ' + e.min : ''), tag: 'j' + g.id + 'r' + e.k });
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
  if (prev && prev.s === 3 && g.statusGroup === 4) events.push({ rule: 'end', title: 'Fim de jogo', body: scoreLine_(g), tag: 'j' + g.id });
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
function f1Sessions_(now) {
  var fmt = function (ms) { return new Date(ms).toISOString().slice(0, 19); };
  return fetchJson_(OPENF1 + '/sessions?date_start%3E=' + fmt(now - 12 * 3600000) + '&date_start%3C=' + fmt(now + 2 * 3600000))
    .filter(function (x) { return !x.is_cancelled; });
}

function f1GpName_(x) {
  var gp = F1_GP[x.country_name];
  return gp ? 'GP ' + gp : 'GP: ' + x.country_name;
}

function pollF1_(devices, mem, writes, out, now, stale) {
  var fans = devices.filter(function (d) { return d.follows.f1; });
  if (!fans.length) return;
  f1Sessions_(now).forEach(function (x) {
    var name = F1_NAMES[x.session_name];
    if (!name) return;
    var key = 'f:' + x.session_key;
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
      var res = fetchJson_(OPENF1 + '/session_result?session_key=' + x.session_key).filter(function (r) { return r.position != null; })
        .sort(function (u, v) { return u.position - v.position; });
      if (res.length) {
        var drv = {};
        fetchJson_(OPENF1 + '/drivers?session_key=' + x.session_key).forEach(function (d) { drv[d.driver_number] = d; });
        var top = res.map(function (r) { var d = drv[r.driver_number] || {}; return { pos: r.position, last: d.last_name || ('Carro ' + r.driver_number), full: ((d.first_name || '') + ' ' + (d.last_name || '')).trim() }; });
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
        out.push({ dev: d, msg: { title: m.title, body: body, tag: 'f' + x.session_key, url: '#/f1' } });
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
