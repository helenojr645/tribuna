// Simula jogos inteiros contra o robo real, com API e Apple falsas, e confere cada aviso.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const code = readFileSync(new URL('./dist/Code.js', import.meta.url), 'utf8');

function world() {
  const store = {};
  const w = { games: [], details: {}, f1: { sessions: [], results: [], drivers: [] }, fora: {}, fm: [], ev: [], ten: [], espnF1: { events: [] }, pushes: [], pushCode: 200, failApi: false, clock: Date.parse('2026-11-04T22:00:00Z'), detailFail: false };
  const props = {
    getProperty: (k) => (k in store ? store[k] : null),
    setProperty: (k, v) => { store[k] = String(v); },
    setProperties: (o) => { Object.entries(o).forEach(([k, v]) => { store[k] = String(v); }); },
    getProperties: () => ({ ...store }),
    deleteProperty: (k) => { delete store[k]; },
    getKeys: () => Object.keys(store)
  };
  const ok = (body) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(body) });
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(w.clock); }
    static now() { return w.clock; }
  }
  const ctx = {
    Uint8Array, TextEncoder, console: { warn() {}, error() {}, log() {} }, Date: FakeDate, Math,
    crypto: globalThis.crypto,
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    ScriptApp: {},
    ContentService: {},
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'x' },
      computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      newBlob: (s) => ({ getBytes: () => (typeof s === 'string' ? [...Buffer.from(s)] : []) }),
      formatDate: () => '12',
      sleep() {}
    },
    UrlFetchApp: {
      fetch(url) {
        if (w.failApi) throw new Error('fora do ar');
        const dono = url.includes('365scores') ? 's365' : url.includes('fotmob') ? 'fotmob' : url.includes('espn') ? 'espn' : url.includes('openf1') ? 'openf1' : '';
        if (w.fora[dono]) throw new Error(dono + ' fora');
        if (url.includes('matchDetails')) return ok({ content: w.fmDet || {} });
        if (url.includes('fotmob')) return ok({ leagues: [{ primaryId: 268, name: 'Série A', matches: w.fm }] });
        if (url.includes('soccer/all')) return ok({ events: w.ev });
        if (url.includes('/tennis/')) return ok({ events: url.includes('/atp/') ? w.ten : [] });
        if (url.includes('racing/f1')) return ok(w.espnF1);
        if (url.includes('/session_result')) return ok(w.f1.results);
        if (url.includes('/drivers')) return ok(w.f1.drivers);
        if (url.includes('/sessions')) return ok(w.f1.sessions);
        if (url.includes('/game/stats/')) return ok({ statistics: w.stats || [] });
        if (url.includes('matchDetails')) return ok({ content: w.fmDet || {} });
        if (url.includes('/game/')) {
          if (w.detailFail) throw new Error('detalhe fora');
          const id = url.match(/gameId=(\d+)/)[1];
          return ok({ game: w.details[id] || { events: [], members: [], stages: [], homeCompetitor: {}, awayCompetitor: {} } });
        }
        return ok({ games: w.games });
      },
      fetchAll(reqs) {
        return reqs.map((q) => {
          w.ultimosCab = q.headers;
          const c = w.pushCode;
          if (c === 200) w.pushes.push(1);
          return { getResponseCode: () => c, getContentText: () => '' };
        });
      }
    }
  };
  vm.createContext(ctx);
  // Captura o texto do aviso antes de cifrar.
  vm.runInContext(code + `
    WebPush = Object.assign({}, WebPush);
    this.__real = WebPush.encryptPayload;
    this.__sent = [];
    var __self = this;
    WebPush.encryptPayload = function (t, a, b, c) { __self.__sent.push(JSON.parse(t)); return __self.__real(t, a, b, c); };
    this.purge_ = purge_;
    this.subscribe_ = subscribe_; this.tick = tick; this.initOnce = function () { return null; };
    this.WebPush = WebPush; this.savePrefs_ = savePrefs_;
    this.sendTest_ = sendTest_; this.ack_ = ack_; this.status_ = status_;
  `, ctx);
  const keys = ctx.WebPush.generateVapid();
  store.vapid = JSON.stringify(keys);
  store.pin = '123456';
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  w.register = (extra) => ctx.subscribe_({ pin: '123456', sub, follows: { c: [1, 100], comp: [], f1: true, drivers: [], mute: [] }, rules: { ht: true, lineup: true, f1Start: true }, ...(extra || {}) });
  w.sub = sub;
  w.tick = () => { const before = ctx.__sent.length; ctx.tick(); return ctx.__sent.slice(before); };
  w.next = (min) => { w.clock += (min || 1) * 60000; };
  w.store = store;
  w.ctx = ctx;
  return w;
}
const foot = (over) => ({
  id: 7, sportId: 1, competitionId: 113, competitionDisplayName: 'Brasileirão', startTime: new Date(Date.parse('2026-11-04T22:30:00Z')).toISOString(),
  statusGroup: 2, statusText: 'Programação',
  homeCompetitor: { id: 1, name: 'Flamengo', score: -1 }, awayCompetitor: { id: 2, name: 'Grêmio', score: -1 }, stages: [], ...over
});
const score = (g, h, a) => { g.homeCompetitor = { ...g.homeCompetitor, score: h }; g.awayCompetitor = { ...g.awayCompetitor, score: a }; };
const goal = (comp, min, player) => ({ competitorId: comp, gameTime: min, gameTimeDisplay: min + "'", playerId: player, stageId: 7, eventType: { id: 1, name: 'Gol' } });
const titles = (m) => m.map((x) => x.title);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('OK  ' + name); };

t('jogo completo: lembrete, inicio, gol, intervalo, vermelho, fim, sem repetir', () => {
  const w = world(); w.register();
  const g = foot(); w.games = [g];
  assert.deepEqual(titles(w.tick()), [], 'faltam 30 min: nada');
  w.next(12);
  assert.deepEqual(titles(w.tick()), ['Flamengo x Grêmio'], 'lembrete');
  w.next(); assert.deepEqual(w.tick(), [], 'lembrete nao repete');
  w.next(20);
  g.statusGroup = 3; g.statusText = '1º tempo'; score(g, 0, 0);
  w.details[7] = { events: [], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }], stages: [] };
  assert.deepEqual(titles(w.tick()), ['Bola rolando']);
  w.next();
  score(g, 1, 0); w.details[7].events = [goal(1, 20, 9)];
  const m = w.tick();
  assert.deepEqual(titles(m), ['GOL do Flamengo!']);
  assert.ok(m[0].body.includes('Flamengo 1 x 0 Grêmio') && m[0].body.includes('Pedro'), m[0].body);
  w.next(); assert.deepEqual(w.tick(), [], 'gol nao repete');
  w.next(); g.statusText = 'Intervalo';
  assert.deepEqual(titles(w.tick()), ['Intervalo']);
  w.next(); w.details[7].events.push({ competitorId: 2, gameTime: 50, gameTimeDisplay: "50'", playerId: 9, stageId: 7, eventType: { id: 3 } });
  g.statusText = '2º tempo';
  assert.deepEqual(titles(w.tick()), ['Vermelho: Grêmio']);
  w.next(); g.statusGroup = 4; g.statusText = 'Fim';
  assert.deepEqual(titles(w.tick()), ['Fim de jogo']);
  w.next(); assert.deepEqual(w.tick(), [], 'fim nao repete');
});

t('placar chega antes do lance: um aviso so', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next();
  score(g, 1, 0); w.details[7] = { events: [], members: [], stages: [] };
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']);
  w.next(); w.details[7].events = [goal(1, 20, 9)];
  assert.deepEqual(w.tick(), [], 'lance atrasado nao repete');
  w.next(); assert.deepEqual(w.tick(), []);
  w.next(); score(g, 2, 0); w.details[7].events.push(goal(1, 30, 10));
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!'], 'gol seguinte avisa');
});

t('autor chega depois do gol: atualiza o mesmo aviso com quem fez, uma vez so', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }], stages: [] }; w.tick(); w.next();
  score(g, 1, 0);
  const m1 = w.tick();
  assert.deepEqual(titles(m1), ['GOL do Flamengo!']);
  w.next(); w.details[7].events = [goal(1, 20, 9)];
  const m2 = w.tick();
  assert.deepEqual(titles(m2), ["Gol de Pedro 20'"], 'nome chegou');
  assert.equal(m2[0].tag, m1[0].tag, 'troca o aviso anterior, nao empilha');
  assert.ok(m2[0].body.includes('1 x 0') && m2[0].body.includes('Flamengo'), m2[0].body);
  w.next(); assert.deepEqual(w.tick(), [], 'nao repete');
  w.next(); score(g, 1, 1); w.details[7].events.push(goal(2, 40, 9));
  assert.deepEqual(titles(w.tick()), ['GOL do Grêmio!'], 'gol com autor na hora segue igual');
});

t('autor atrasado: dois gols sem nome, lances fora de ordem e lance que chega primeiro sem jogador', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }, { id: 10, athleteId: 10, shortName: 'Bruno' }], stages: [] }; w.tick(); w.next();
  score(g, 2, 0);
  const m1 = w.tick();
  assert.deepEqual(titles(m1), ['GOL do Flamengo!', 'GOL do Flamengo!']);
  w.next(); w.details[7].events = [goal(1, 30, 10)];
  const m2 = w.tick();
  assert.deepEqual(titles(m2), ["Gol de Bruno 30'"]);
  assert.equal(m2[0].tag, m1[0].tag, 'por ora e o 1o gol conhecido');
  w.next(); w.details[7].events = [goal(1, 20, 0), goal(1, 30, 10)];
  assert.deepEqual(w.tick(), [], 'lance sem jogador espera');
  w.next(); w.details[7].events = [goal(1, 20, 9), goal(1, 30, 10)];
  const m3 = w.tick();
  assert.deepEqual(titles(m3), ["Gol de Pedro 20'"], 'nome chega depois e ainda avisa');
  w.next(); assert.deepEqual(w.tick(), [], 'nada repete');
});

t('lance chega antes do placar: espera e avisa com numero certo', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next();
  w.details[7] = { events: [goal(1, 20, 9)], members: [], stages: [] };
  assert.deepEqual(w.tick(), [], 'placar ainda 0-0');
  w.next(); score(g, 1, 0);
  const m = w.tick();
  assert.deepEqual(titles(m), ['GOL do Flamengo!']);
  assert.ok(m[0].body.includes('1 x 0'), m[0].body);
});

t('gol anulado e novo gol', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next();
  score(g, 1, 0); assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']); w.next();
  score(g, 0, 0); assert.deepEqual(titles(w.tick()), ['Gol anulado']); w.next();
  score(g, 1, 0); assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!'], 'novo gol vale');
});

t('disputa de penaltis nao vira GOL', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 1, 1); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [{ id: 11, name: 'Pênaltis', shortName: 'Pen.' }] };
  w.tick(); w.next();
  w.details[7].events = [1, 2, 3].map((i) => ({ ...goal(i % 2 ? 1 : 2, 120, i), stageId: 11 }));
  assert.deepEqual(w.tick(), []);
});

t('primeira leitura com jogo em andamento nao dispara o passado', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 3, 1); w.games = [g];
  w.details[7] = { events: [goal(1, 5, 1), goal(1, 6, 2), goal(1, 7, 3), goal(2, 8, 4)], members: [], stages: [] };
  assert.deepEqual(w.tick(), []);
  w.next(); assert.deepEqual(w.tick(), []);
  w.next(); score(g, 4, 1); w.details[7].events.push(goal(1, 40, 5));
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']);
});

t('robo parado 1 hora nao solta rajada de avisos velhos', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick();
  w.next(60); score(g, 3, 0); g.statusGroup = 4;
  assert.deepEqual(w.tick(), []);
});

t('tenis: sets vazios para 0-0 nao avisa; fim de set e resultado sim', () => {
  const w = world(); w.register();
  const g = { id: 8, sportId: 3, competitionId: 5, competitionDisplayName: 'Viena', startTime: new Date(w.clock + 5 * 60000).toISOString(), statusGroup: 2, statusText: 'Prog.', stages: [],
    homeCompetitor: { id: 100, name: 'João Fonseca', score: -1 }, awayCompetitor: { id: 200, name: 'Rival', score: -1 } };
  w.games = [g];
  assert.deepEqual(titles(w.tick()), ['João Fonseca x Rival'], 'lembrete'); w.next();
  const st = (a, b, sa, sb) => [{ id: 27, shortName: 'S1', homeCompetitorScore: sa, awayCompetitorScore: sb }, { id: 35, shortName: 'Sets', homeCompetitorScore: a, awayCompetitorScore: b }];
  g.statusGroup = 3; g.stages = st(0, 0, 0, 0);
  assert.deepEqual(titles(w.tick()), ['Em quadra']); w.next();
  g.stages = st(1, 0, 6, 4);
  assert.deepEqual(titles(w.tick()), ['Set encerrado: 1-0']); w.next();
  g.statusGroup = 4; g.homeCompetitor.isWinner = true;
  assert.deepEqual(titles(w.tick()), ['João Fonseca venceu']);
});

t('jogo ao vivo alem da janela de 5h continua vigiado', () => {
  const w = world(); w.register();
  const g = foot({ statusGroup: 3, startTime: new Date(w.clock - 7 * 36e5).toISOString() }); score(g, 0, 0); w.games = [g];
  w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']);
});

t('Apple fora do ar: aviso entra em fila e sai depois, sem repetir', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next();
  w.pushCode = 503; score(g, 1, 0); w.tick();
  assert.equal(w.pushes.length, 0);
  assert.ok(w.store.queue, 'fila criada'); w.next();
  w.pushCode = 200; w.tick();
  assert.equal(w.pushes.length, 1, 'reenviado');
  assert.ok(!w.store.queue, 'fila limpa'); w.next(); w.tick();
  assert.equal(w.pushes.length, 1, 'nao repete');
});

t('assinatura morta (410) guarda o aparelho; renovar nao pede PIN', () => {
  const w = world(); const r = w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next();
  w.pushCode = 410; score(g, 1, 0); w.tick();
  const d = JSON.parse(w.store['dev:' + r.id]);
  assert.equal(d.sub, null);
  const again = w.ctx.subscribe_({ id: r.id, secret: r.secret, sub: { ...w.sub, endpoint: 'https://web.push.apple.com/novo' }, follows: { c: [1] } });
  assert.ok(again.ok && again.id === r.id);
});

t('detalhe fora do ar: nao derruba; gol avisa sem autor e erro fica registrado', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.detailFail = true; score(g, 1, 0);
  assert.deepEqual(w.tick(), [], 'espera no proximo minuto');
  assert.ok(w.store.lastError.includes('jogo 7'));
  w.next(); w.detailFail = false;
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!'], 'recupera sem perder');
});

t('15 minutos sem API geram um aviso unico', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick();
  w.failApi = true; let all = [];
  for (let i = 0; i < 20; i++) { w.next(); all = all.concat(w.tick()); }
  assert.deepEqual(titles(all), ['Tribuna: avisos com problema']);
});

t('seguranca: PIN errado recusado e bloqueio temporario', () => {
  const w = world();
  assert.equal(w.ctx.subscribe_({ pin: '', sub: w.sub }).code, 'pin');
  assert.equal(w.store.pinFails, undefined, 'PIN vazio nao conta');
  for (let i = 0; i < 10; i++) w.ctx.subscribe_({ pin: '000000', sub: w.sub });
  assert.equal(w.register().code, 'locked');
  w.next(16);
  assert.ok(w.register().ok, 'volta depois de 15 min');
  assert.ok(!w.ctx.subscribe_({ pin: '123456', sub: { ...w.sub, endpoint: 'https://evil.example.com/x' } }).ok, 'endpoint fora da lista');
});

t('regras: gol desligado, silencio, spoiler e campeonato silenciado', () => {
  let w = world(); w.register({ rules: { goal: false } }); let g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(w.tick(), [], 'gol desligado');
  w = world(); w.register({ spoiler: true }); g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(w.tick(), [], 'spoiler');
  w = world(); w.register({ quiet: { on: true, from: 10, to: 14 } }); g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(w.tick(), [], 'silencio');
  w = world(); w.register({ follows: { c: [], comp: [113], mute: [-113] } }); g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(w.tick(), [], 'campeonato silenciado');
  w = world(); w.register({ follows: { c: [], comp: [113], mute: [113] } }); g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g]; w.tick(); w.next(); score(g, 1, 0);
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!'], 'time com id 113 silenciado nao cala o campeonato 113');
});

t('F1: lembrete, largada, resultado atrasado e piloto seguido', () => {
  const w = world();
  w.register({ follows: { c: [], comp: [], f1: true, drivers: ['Bortoleto'], mute: [] }, rules: { f1Start: true } });
  const a = w.clock + 40 * 60000, z = a + 2 * 36e5;
  w.f1.sessions = [{ session_key: 5, session_name: 'Race', country_name: 'Brazil', date_start: new Date(a).toISOString(), date_end: new Date(z).toISOString() },
    { session_key: 6, session_name: 'Practice 1', country_name: 'Brazil', date_start: new Date(a).toISOString(), date_end: new Date(z).toISOString() }];
  assert.deepEqual(w.tick(), [], 'primeira leitura so registra'); w.next(11);
  assert.deepEqual(titles(w.tick()), ['Corrida em 29 min']); w.next(10);
  assert.deepEqual(w.tick(), [], 'lembrete nao repete'); w.next(19);
  assert.deepEqual(titles(w.tick()), ['Corrida começou']); w.next(121);
  assert.deepEqual(w.tick(), [], 'acabou, resultado ainda nao saiu'); w.next();
  w.f1.results = [1, 2, 3, 4, 5].map((i) => ({ position: i, driver_number: i }));
  w.f1.drivers = ['Norris', 'Hamilton', 'Russell', 'Leclerc', 'Bortoleto'].map((n, i) => ({ driver_number: i + 1, first_name: 'X', last_name: n }));
  const m = w.tick();
  assert.deepEqual(titles(m), ['Corrida: GP do Brasil']);
  assert.ok(m[0].body.includes('1. Norris') && m[0].body.includes('5. Bortoleto'), m[0].body);
  w.next(); assert.deepEqual(w.tick(), [], 'resultado nao repete');
});

t('F1: sessao ja encerrada na primeira leitura nao avisa', () => {
  const w = world(); w.register();
  w.f1.sessions = [{ session_key: 7, session_name: 'Race', country_name: 'Brazil', date_start: new Date(w.clock - 3 * 36e5).toISOString(), date_end: new Date(w.clock - 36e5).toISOString() }];
  w.f1.results = [{ position: 1, driver_number: 1 }];
  assert.deepEqual(w.tick(), []);
  w.next(); assert.deepEqual(w.tick(), []);
});

t('limpeza exige PIN e aparelho morto nao gera vigia', () => {
  const w = world(); const r = w.register();
  assert.equal(w.ctx.purge_({ pin: '000000' }).code, 'pin');
  assert.ok(w.store['dev:' + r.id], 'PIN errado nao apaga');
  const d = JSON.parse(w.store['dev:' + r.id]); d.sub = null; w.store['dev:' + r.id] = JSON.stringify(d);
  const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.tick();
  assert.ok(!w.store.plan && !w.store['g:7'], 'sem aparelho vivo nao le jogos');
  assert.equal(w.ctx.purge_({ pin: '123456' }).removed, 1);
  assert.ok(!w.store['dev:' + r.id]);
});

let fmSeq = 1;
const fmJogo = (h, a, sh, sa, ini, over) => ({ id: fmSeq++, home: { name: h, score: sh }, away: { name: a, score: sa }, status: { utcTime: ini, started: true, finished: false, liveTime: { short: "50'" }, ...(over || {}) } });

t('reserva: 365 cai no meio do jogo, FotMob assume sem repetir nem inventar', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 1, 0); w.games = [g];
  w.details[7] = { events: [goal(1, 20, 9)], members: [], stages: [] };
  w.tick(); w.next();
  assert.deepEqual(w.tick(), [], 'sem novidade');
  w.next(); w.fora.s365 = true;
  w.fm = [fmJogo('CR Flamengo', 'Gremio', 1, 0, g.startTime)];
  assert.deepEqual(w.tick(), [], 'trocar de fonte nao gera aviso');
  assert.equal(w.store.fonte, 'FotMob');
  assert.ok(!w.store.lastError, 'reserva funcionando nao e falha: ' + w.store.lastError);
  w.next(); w.fm[0].home.score = 2;
  const m = w.tick();
  assert.deepEqual(titles(m), ['GOL do Flamengo!']);
  assert.ok(m[0].body.includes('2 x 0'), m[0].body);
  w.next(); w.fm[0].home.score = 1;
  assert.deepEqual(w.tick(), [], 'reserva atrasada nao vira gol anulado');
  w.next(); w.fm[0].status = { ...w.fm[0].status, finished: true }; w.fm[0].home.score = 2;
  assert.deepEqual(titles(w.tick()), ['Fim de jogo']);
});

t('reserva: 365 volta e o lance atrasado nao repete o gol', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora.s365 = true; w.fm = [fmJogo('Flamengo', 'Grêmio', 1, 0, g.startTime)];
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']); w.next();
  w.fora.s365 = false; score(g, 1, 0); w.details[7].events = [goal(1, 50, 9)];
  assert.deepEqual(w.tick(), [], 'nao repete');
  assert.equal(w.store.fonte || '', '', 'voltou para a principal');
});

t('reserva nunca casa jogo errado: outro adversario, feminino, reserva ou ambiguo', () => {
  const cen = (home, away, fm, liga) => {
    const w = world(); w.register({ follows: { c: [1], comp: [], f1: false, mute: [] } });
    const g = foot({ statusGroup: 3, competitionDisplayName: liga || 'Liga' });
    g.homeCompetitor.name = home; g.awayCompetitor.name = away; score(g, 0, 0); w.games = [g];
    w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
    w.fora.s365 = true; w.fm = fm.map((x) => fmJogo(x[0], x[1], 3, 0, g.startTime));
    return w.tick();
  };
  assert.deepEqual(cen('Club Deportivo Bocas', 'Cd Universitario Ii', [['Union Cocle', 'CD Universitario']]), [], 'so um time igual');
  assert.deepEqual(cen('Corinthians (F)', 'Cruzeiro (F)', [['Corinthians', 'Cruzeiro']]), [], 'feminino x masculino');
  assert.deepEqual(cen('Santos II', 'Bahia', [['Santos', 'Bahia']]), [], 'reserva x principal');
  assert.deepEqual(cen('Flamengo', 'Fluminense', [['Flamengo', 'Fluminense'], ['Flamengo RJ', 'Fluminense FC']]), [], 'dois candidatos');
  assert.equal(titles(cen('Atlético-MG', 'Cruzeiro', [['Atletico Mineiro', 'Cruzeiro']]))[0], 'GOL do Atlético-MG!', 'apelido valido casa');
  assert.equal(titles(cen('PSG', 'Lyon', [['Paris Saint-Germain', 'Lyon']]))[0], 'GOL do PSG!', 'PSG casa');
  assert.equal(titles(cen('Sporting CP', 'Porto', [['Sporting CP', 'FC Porto']]))[0], 'GOL do Sporting CP!', 'nome so com palavra comum casa');
});

t('reserva: mesmo jogo repetido na FotMob nao vira ambiguidade', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora.s365 = true;
  const m = fmJogo('Flamengo', 'Grêmio', 1, 0, g.startTime);
  w.fm = [m, { ...m }];
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']);
});

t('reserva da reserva: 365 e FotMob fora, ESPN assume', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora.s365 = true; w.fora.fotmob = true;
  w.ev = [{ date: g.startTime, status: { type: { state: 'in', description: 'Second Half' } }, competitions: [{ competitors: [{ homeAway: 'home', score: '1', team: { displayName: 'Flamengo' } }, { homeAway: 'away', score: '0', team: { displayName: 'Gremio' } }] }] }];
  assert.deepEqual(titles(w.tick()), ['GOL do Flamengo!']);
  assert.equal(w.store.fonte, 'ESPN');
});

t('todas as fontes fora: nao inventa nada e registra a falha', () => {
  const w = world(); w.register(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora = { s365: true, fotmob: true, espn: true };
  assert.deepEqual(w.tick(), []);
  assert.ok(w.store.lastError, 'erro registrado');
});

t('reserva tenis: set encerrado pela ESPN', () => {
  const w = world(); w.register();
  const st = (a, b, sa, sb) => [{ id: 27, shortName: 'S1', homeCompetitorScore: sa, awayCompetitorScore: sb }, { id: 35, shortName: 'Sets', homeCompetitorScore: a, awayCompetitorScore: b }];
  const g = { id: 8, sportId: 3, competitionId: 5, competitionDisplayName: 'Viena', startTime: new Date(w.clock - 36e5).toISOString(), statusGroup: 3, statusText: '1º set', stages: st(0, 0, 4, 4), homeCompetitor: { id: 100, name: 'João Fonseca', score: 0 }, awayCompetitor: { id: 200, name: 'Carlos Alcaraz', score: 0 } };
  w.games = [g]; w.tick(); w.next();
  w.fora.s365 = true;
  w.ten = [{ groupings: [{ competitions: [{ date: g.startTime, status: { type: { state: 'in' } }, competitors: [{ athlete: { displayName: 'Joao Fonseca' }, linescores: [{ value: 6, winner: true }] }, { athlete: { displayName: 'Carlos Alcaraz' }, linescores: [{ value: 4, winner: false }] }] }] }] }];
  assert.deepEqual(titles(w.tick()), ['Set encerrado: 1-0']);
});

t('F1: OpenF1 fora, ESPN assume sem repetir lembrete', () => {
  const w = world(); w.register({ follows: { c: [], comp: [], f1: true, drivers: [], mute: [] } });
  const a = w.clock + 25 * 60000, z = a + 2 * 36e5;
  w.f1.sessions = [{ session_key: 5, session_name: 'Race', country_name: 'Brazil', date_start: new Date(a).toISOString(), date_end: new Date(z).toISOString() }];
  w.tick(); w.next();
  assert.deepEqual(titles(w.tick()), ['Corrida em 24 min']); w.next();
  w.fora.openf1 = true;
  const comp = (state, comps) => [{ id: '77', date: new Date(a).toISOString(), type: { abbreviation: 'Race' }, status: { type: { state } }, competitors: comps || [] }];
  w.espnF1 = { events: [{ name: 'GP do Brasil', competitions: comp('pre') }] };
  assert.deepEqual(w.tick(), [], 'lembrete nao repete na troca de fonte');
  w.clock = z + 60000;
  w.store.lastPoll = String(w.clock - 60000);
  w.espnF1.events[0].competitions = comp('post', [{ order: 2, athlete: { displayName: 'Lewis Hamilton' } }, { order: 1, athlete: { displayName: 'Lando Norris' } }]);
  const m = w.tick();
  assert.equal(m.length, 1);
  assert.ok(m[0].body.startsWith('1. Norris'), m[0].body);
});

const statsDe = (posse, gol, chutes, esc) => [
  ['Posse de Bola', posse], ['Chutes no gol', gol], ['Total de chutes', chutes], ['Escanteios', esc]
].flatMap(([name, v]) => [{ name, competitorId: 1, value: String(v[0]) }, { name, competitorId: 2, value: String(v[1]) }]);
const acompanhar = (w, m, g, extra) => w.register({ follows: { c: [], comp: [], f1: false, mute: [] }, watch: [{ g: 7, c: [1, 2], m: m || 'main', t: new Date(g.startTime).getTime() }], ...(extra || {}) });

t('cartao: autor atrasado atualiza o cartao de quem acompanha', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 60, gameTimeDisplay: "60'" }); score(g, 0, 0); w.games = [g];
  acompanhar(w, 'main', g);
  w.details[7] = { events: [], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }], stages: [] };
  w.tick(); w.next(); score(g, 1, 0);
  let m = w.tick();
  assert.equal(m.length, 1); assert.equal(m[0].tag, 'live7');
  w.next(); w.details[7].events = [goal(1, 61, 9)];
  m = w.tick();
  assert.equal(m.length, 1, 'um cartao');
  assert.ok(m[0].body.startsWith("GOL! Pedro 61'"), m[0].body);
});

t('cartao: primeiro resumo, gol atualiza o mesmo cartao, amarelo so no modo completo', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 60, gameTimeDisplay: "60'" }); score(g, 0, 0); w.games = [g];
  acompanhar(w, 'main', g);
  w.stats = statsDe(['58%', '42%'], [5, 2], [11, 6], [6, 3]);
  w.details[7] = { events: [], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }], stages: [] };
  let m = w.tick();
  assert.equal(m.length, 1, 'cartao inicial');
  assert.equal(m[0].tag, 'live7'); assert.equal(m[0].live, true);
  assert.equal(m[0].title, "Flamengo 0 x 0 Grêmio · 60'");
  assert.ok(m[0].body.includes('Posse 58% x 42% · No gol 5 x 2') && m[0].body.includes('Chutes 11 x 6 · Escanteios 6 x 3'), m[0].body);
  w.next(); assert.deepEqual(w.tick(), [], 'sem lance nao toca');
  w.next(); score(g, 1, 0); w.details[7].events = [goal(1, 62, 9)]; g.gameTimeDisplay = "62'";
  m = w.tick();
  assert.equal(m.length, 1, 'um cartao, nao aviso e cartao');
  assert.equal(m[0].tag, 'live7');
  assert.ok(m[0].title.startsWith('Flamengo 1 x 0') && m[0].body.startsWith("GOL! Pedro 62'"), m[0].title + ' / ' + m[0].body);
  w.next(); w.details[7].events.push({ competitorId: 2, gameTime: 64, gameTimeDisplay: "64'", playerId: 9, stageId: 7, eventType: { id: 2, name: 'Cartão Amarelo' } });
  assert.deepEqual(w.tick(), [], 'modo principal ignora amarelo');
});

t('cartao completo: amarelo e troca atualizam; resumo sai a cada 15 min; ultimo lance fica', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 30, gameTimeDisplay: "30'" }); score(g, 1, 0); w.games = [g];
  acompanhar(w, 'all', g);
  w.details[7] = { events: [goal(1, 20, 9)], members: [{ id: 9, athleteId: 9, shortName: 'Pedro' }, { id: 8, athleteId: 8, shortName: 'Gabi' }], stages: [] };
  w.stats = statsDe(['50%', '50%'], [1, 1], [2, 2], [1, 1]);
  const m0 = w.tick();
  assert.ok(m0[0].body.includes("Último lance: GOL! Pedro 20'"), m0[0].body);
  w.next(); w.details[7].events.push({ competitorId: 2, gameTime: 31, gameTimeDisplay: "31'", playerId: 8, stageId: 7, eventType: { id: 2, name: 'Cartão Amarelo' } });
  let m = w.tick();
  assert.ok(m[0].body.startsWith("Amarelo: Gabi 31' (Grêmio)"), m[0].body);
  w.next(); w.details[7].events.push({ competitorId: 1, gameTime: 33, gameTimeDisplay: "33'", playerId: 8, extraPlayers: [9], stageId: 7, eventType: { id: 1000, name: 'Substitution' } });
  m = w.tick();
  assert.ok(m[0].body.startsWith("Flamengo: entra Gabi, sai Pedro 33'"), m[0].body);
  w.next(5); assert.deepEqual(w.tick(), [], 'antes dos 15 min');
  w.next(10);
  m = w.tick();
  assert.equal(m.length, 1, 'resumo de 15 min');
  assert.ok(m[0].body.startsWith('Último lance: Flamengo: entra Gabi'), m[0].body);
});

t('cartao: fim encerra a vigia e silencio/spoiler nao bloqueiam quem pediu para acompanhar', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 89, gameTimeDisplay: "89'" }); score(g, 2, 1); w.games = [g];
  const r = acompanhar(w, 'main', g, { quiet: { on: true, from: 0, to: 23 }, spoiler: true });
  w.stats = statsDe(['60%', '40%'], [7, 3], [14, 8], [8, 2]);
  w.details[7] = { events: [], members: [], stages: [] };
  assert.equal(w.tick().length, 1); w.next();
  g.statusGroup = 4; g.statusText = 'Fim';
  const m = w.tick();
  assert.equal(m.length, 1);
  assert.equal(m[0].title, 'Flamengo 2 x 1 Grêmio · Fim');
  assert.ok(m[0].body.startsWith('Fim de jogo') && m[0].body.includes('No gol 7 x 3'), m[0].body);
  assert.equal(JSON.parse(w.store['dev:' + r.id]).watch.length, 0, 'vigia encerrada');
  w.next(20); assert.deepEqual(w.tick(), [], 'nada depois do fim');
});

t('cartao: jogo fora dos seguidos e antes do inicio', () => {
  const w = world(); const g = foot(); w.games = [g];
  acompanhar(w, 'main', g);
  const m = w.tick();
  assert.equal(m.length, 1);
  assert.equal(m[0].title, 'Flamengo x Grêmio');
  assert.ok(m[0].body.startsWith('Começa às'), m[0].body);
  w.next(12);
  const r2 = w.tick();
  assert.ok(r2[0] && r2[0].body.startsWith('Começa em') && r2[0].tag === 'live7', JSON.stringify(r2));
});

t('cartao: pressao aparece quando um lado finaliza muito mais', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 70, gameTimeDisplay: "70'" }); score(g, 0, 0); w.games = [g];
  acompanhar(w, 'main', g);
  w.stats = statsDe(['55%', '45%'], [4, 1], [9, 3], [5, 1]);
  w.details[7] = { events: [], members: [], stages: [], chartEvents: { events: [["60'", 1], ["63'", 1], ["66'", 1], ["68'", 1], ["61'", 2], ["10'", 2], ["12'", 2]].map(([time, competitorNum]) => ({ time, competitorNum })) } };
  const m = w.tick();
  assert.ok(m[0].body.includes('Pressão: Flamengo (4 x 1 chutes em 15 min)'), m[0].body);
});

t('cartao tenis e cartao na reserva FotMob', () => {
  let w = world();
  const st = [{ id: 34, shortName: 'Game', isLive: true, homeCompetitorScore: 30, awayCompetitorScore: 15 }, { id: 27, shortName: 'S1', homeCompetitorScore: 6, awayCompetitorScore: 4 }, { id: 28, shortName: 'S2', homeCompetitorScore: 2, awayCompetitorScore: 1, isLive: true }, { id: 35, shortName: 'Sets', homeCompetitorScore: 1, awayCompetitorScore: 0 }];
  const g = { id: 7, sportId: 3, competitionId: 5, startTime: new Date(w.clock - 36e5).toISOString(), statusGroup: 3, statusText: '2º set', stages: st, homeCompetitor: { id: 1, name: 'João Fonseca', score: 1 }, awayCompetitor: { id: 2, name: 'Carlos Alcaraz', score: 0 } };
  w.games = [g];
  acompanhar(w, 'main', g);
  w.stats = [['Ace', 5, 2], ['Dupla falta', 1, 3], ['Break points vencidos', '2', '1'], ['Total de pontos ganhos', '40/70 (57%)', '30/70 (43%)']].flatMap(([name, a, b]) => [{ name, competitorId: 1, value: String(a) }, { name, competitorId: 2, value: String(b) }]);
  let m = w.tick();
  assert.equal(m[0].title, 'Fonseca 6-4 2-1 Alcaraz');
  assert.ok(m[0].body.includes('Game 30-15') && m[0].body.includes('Aces 5 x 2 · Duplas 1 x 3') && m[0].body.includes('Quebras 2 x 1 · Pontos 40 x 30'), m[0].body);

  w = world(); const f = foot({ statusGroup: 3 }); score(f, 0, 0); w.games = [f];
  acompanhar(w, 'main', f);
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora.s365 = true;
  w.fm = [fmJogo('Flamengo', 'Grêmio', 1, 0, f.startTime)];
  w.fmDet = { stats: { Periods: { All: { stats: [{ stats: [{ key: 'BallPossesion', stats: [61, 39] }, { key: 'ShotsOnTarget', stats: [3, 1] }] }] } } } };
  m = w.tick();
  assert.equal(m.length, 1);
  assert.ok(m[0].title.startsWith('Flamengo 1 x 0 Grêmio') && m[0].body.includes('Posse 61% x 39% · No gol 3 x 1'), m[0].title + ' / ' + m[0].body);
});

t('plano cheio nunca passa de 9 KB e o robo segue vivo; acompanhado fica na reserva', () => {
  const w = world();
  const muitos = [];
  for (let i = 0; i < 300; i++) {
    const g = foot({ id: 1000 + i, statusGroup: i % 2 ? 2 : 3, competitionDisplayName: 'Campeonato Internacional de Nome Bem Comprido - Grupo ' + i });
    g.homeCompetitor = { id: 5000 + i, name: 'Associação Atlética Muito Comprida ' + i, shortName: 'AA' + i, score: 0 };
    g.awayCompetitor = { id: 6000 + i, name: 'Sociedade Esportiva Também Comprida ' + i, shortName: 'SE' + i, score: 0 };
    muitos.push(g);
  }
  w.games = muitos;
  w.register({ follows: { c: muitos.slice(0, 200).map((g) => g.homeCompetitor.id), comp: [], f1: false, mute: [] }, watch: [{ g: 1299, c: [5299, 6299], m: 'main', t: Date.now() }] });
  w.details = {};
  w.tick();
  assert.ok(Buffer.byteLength(w.store.plan) <= 8600, 'plano com ' + Buffer.byteLength(w.store.plan) + ' bytes');
  assert.equal(w.store.lastError || '', '');
  assert.equal(JSON.parse(w.store.plan).games[0].id, 1299, 'acompanhado vem primeiro');
});

t('fim visto so depois da parada: sai o cartao final e a vigia encerra', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 60, gameTimeDisplay: "60'" }); score(g, 1, 0); w.games = [g];
  const r = acompanhar(w, 'main', g);
  w.details[7] = { events: [], members: [], stages: [] };
  w.tick();
  w.next(60); g.statusGroup = 4; g.statusText = 'Fim'; score(g, 2, 0);
  const m = w.tick();
  assert.equal(m.length, 1);
  assert.equal(m[0].title, 'Flamengo 2 x 0 Grêmio · Fim');
  assert.ok(m[0].body.startsWith('Fim de jogo'), m[0].body);
  assert.equal(m[0].fim, true);
  assert.equal(JSON.parse(w.store['dev:' + r.id]).watch.length, 0);
  w.next(); assert.deepEqual(w.tick(), []);
  w.ctx.savePrefs_(JSON.parse(w.store['dev:' + r.id]), { follows: { c: [] }, watch: [{ g: 7, c: [1, 2], m: 'main', t: 1 }] });
  assert.equal(JSON.parse(w.store['dev:' + r.id]).watch.length, 0, 'app reenviando jogo acabado nao reativa');
});

t('parar e voltar a acompanhar: novo cartao sem esperar 15 min', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 20, gameTimeDisplay: "20'" }); score(g, 0, 0); w.games = [g];
  const r = acompanhar(w, 'main', g);
  w.details[7] = { events: [], members: [], stages: [] };
  assert.equal(w.tick().length, 1); w.next();
  assert.equal(w.tick().length, 0, 'sem novidade');
  const dev = () => JSON.parse(w.store['dev:' + r.id]);
  w.ctx.savePrefs_(dev(), { follows: { c: [] }, watch: [] }); w.next();
  assert.equal(w.tick().length, 0, 'parado');
  w.ctx.savePrefs_(dev(), { follows: { c: [] }, watch: [{ g: 7, c: [1, 2], m: 'main', t: new Date(g.startTime).getTime() }] }); w.next();
  assert.equal(w.tick().length, 1, 'volta na hora');
});

t('salvar preferencia nao apaga o plano e a reserva segue com 365 fora', () => {
  const w = world(); const g = foot({ statusGroup: 3 }); score(g, 0, 0); w.games = [g];
  const r = acompanhar(w, 'main', g);
  w.details[7] = { events: [], members: [], stages: [] }; w.tick(); w.next();
  w.fora.s365 = true;
  w.ctx.savePrefs_(JSON.parse(w.store['dev:' + r.id]), { follows: { c: [] }, watch: [{ g: 7, c: [1, 2], m: 'main', t: new Date(g.startTime).getTime() }] });
  w.fm = [fmJogo('Flamengo', 'Grêmio', 1, 0, g.startTime)];
  const m = w.tick();
  assert.equal(m.length, 1, 'reserva continuou: ' + w.store.lastError);
  assert.ok(m[0].title.startsWith('Flamengo 1 x 0'));
});

t('fila nao ressuscita cartao velho e modos nao se misturam; Topic no cabecalho', () => {
  const w = world(); const g = foot({ statusGroup: 3, gameTime: 50, gameTimeDisplay: "50'" }); score(g, 0, 0); w.games = [g];
  acompanhar(w, 'main', g);
  w.details[7] = { events: [], members: [], stages: [] };
  w.tick();
  assert.equal(w.ultimosCab.Topic, 'live7');
  w.next(); w.pushCode = 503; score(g, 1, 0); w.tick();
  assert.ok(w.store.queue); w.next();
  w.pushCode = 200; score(g, 2, 0);
  const antes = w.ctx.__sent.length;
  w.tick();
  const novos = w.ctx.__sent.slice(antes);
  assert.equal(novos.length, 1, 'so o mais novo: ' + novos.map((x) => x.title));
  assert.ok(novos[0].title.includes('2 x 0'), novos[0].title);
  assert.ok(!w.store.queue);
});

t('aviso de teste registra cada etapa sem expor endereco nem aceitar confirmacao falsa', () => {
  const w = world(); const r = w.register();
  const dev = JSON.parse(w.store['dev:' + r.id]);
  const u = 'https://script.google.com/macros/s/AKfy_x-1/exec';
  w.pushCode = 403;
  const rec = w.ctx.sendTest_(dev, { u });
  assert.equal(rec.ok, false);
  assert.equal(JSON.parse(w.store.testDiag).codes[0], 403);
  assert.ok(JSON.parse(w.store.lastSend).erro.startsWith('403'));
  w.pushCode = 200;
  assert.equal(w.ctx.sendTest_(dev, { u }).ok, true);
  const msg = w.ctx.__sent[w.ctx.__sent.length - 1];
  assert.equal(msg.ack.u, u);
  assert.equal(w.ctx.ack_({ t: 'falso', mostrou: 1 }).ok, false);
  assert.equal(JSON.parse(w.store.testDiag).recebido, 0);
  assert.equal(w.ctx.ack_({ t: msg.ack.t, mostrou: 1, perm: 'granted', v: 'tribuna-10' }).ok, true);
  const st = w.ctx.status_();
  assert.equal(st.teste.mostrou, 1);
  assert.equal(st.aparelhos[0].host, 'web.push.apple.com');
  const txt = JSON.stringify(st);
  assert.ok(!txt.includes('abc') && !txt.includes(r.secret) && !txt.includes(msg.ack.t));
  w.ctx.sendTest_(dev, { u: 'https://mau.example/exec' });
  assert.equal(w.ctx.__sent[w.ctx.__sent.length - 1].ack, undefined, 'so confirma para o robo');
});

console.log(`ROBO OK: ${n} cenarios`);
