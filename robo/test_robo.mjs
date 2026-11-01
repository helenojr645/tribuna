// Simula jogos inteiros contra o robo real, com API e Apple falsas, e confere cada aviso.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const code = readFileSync(new URL('./dist/Code.js', import.meta.url), 'utf8');

function world() {
  const store = {};
  const w = { games: [], details: {}, f1: { sessions: [], results: [], drivers: [] }, pushes: [], pushCode: 200, failApi: false, clock: Date.parse('2026-11-04T22:00:00Z'), detailFail: false };
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
      newBlob: (s) => ({ getBytes: () => [...Buffer.from(typeof s === 'string' ? s : [])] }),
      formatDate: () => '12'
    },
    UrlFetchApp: {
      fetch(url) {
        if (w.failApi) throw new Error('fora do ar');
        if (url.includes('/session_result')) return ok(w.f1.results);
        if (url.includes('/drivers')) return ok(w.f1.drivers);
        if (url.includes('/sessions')) return ok(w.f1.sessions);
        if (url.includes('/game/')) {
          if (w.detailFail) throw new Error('detalhe fora');
          const id = url.match(/gameId=(\d+)/)[1];
          return ok({ game: w.details[id] || { events: [], members: [], stages: [], homeCompetitor: {}, awayCompetitor: {} } });
        }
        return ok({ games: w.games });
      },
      fetchAll(reqs) {
        return reqs.map(() => {
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

console.log(`ROBO OK: ${n} cenarios`);
