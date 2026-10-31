'use strict';
/* Tribuna: placares de quem voce escolhe. Sem framework para abrir rapido no iPhone. */

// ---------- Constantes ----------
const API = 'https://webws.365scores.com/web';
const API_Q = 'appTypeId=5&langId=31&timezoneName=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo') + '&userCountryId=21';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1 = 'https://api.openf1.org/v1';
const ROBO = window.TRIBUNA_ROBO || '';
const POLL_MS = 15000;
const YEAR = new Date().getFullYear();

const LEAGUES = [
  { id: 113, name: 'Brasileirão Série A', iv: 11 }, { id: 116, name: 'Brasileirão Série B', iv: 6 },
  { id: 115, name: 'Copa do Brasil', iv: 4 }, { id: 102, name: 'Libertadores', iv: 6 },
  { id: 389, name: 'Sul-Americana', iv: 2 }, { id: 572, name: 'Champions League', iv: 5 },
  { id: 7, name: 'Premier League', iv: 12 }, { id: 11, name: 'La Liga', iv: 7 },
  { id: 17, name: 'Serie A Italiana', iv: 3 }, { id: 25, name: 'Bundesliga', iv: 2 },
  { id: 35, name: 'Ligue 1', iv: 5 }, { id: 5930, name: 'Copa do Mundo', iv: 19 }
];
const TENNIS_TOP = [
  { id: 72178, name: 'João Fonseca', iv: 7 }, { id: 10496, name: 'Bia Haddad', iv: 7 },
  { id: 56386, name: 'Carlos Alcaraz', iv: 5 }, { id: 52703, name: 'Jannik Sinner', iv: 7 },
  { id: 2409, name: 'Novak Djokovic', iv: 8 }, { id: 12954, name: 'Alexander Zverev', iv: 5 },
  { id: 24337, name: 'Taylor Fritz', iv: 5 }, { id: 55853, name: 'Iga Swiatek', iv: 5 },
  { id: 30110, name: 'Aryna Sabalenka', iv: 5 }, { id: 53726, name: 'Coco Gauff', iv: 6 }
].map((p) => ({ ...p, sportId: 3 }));
const F1_TEAMS = {
  mercedes: '#27F4D2', ferrari: '#E8002D', red_bull: '#3671C6', mclaren: '#FF8000', rb: '#6692FF', alpine: '#FF87BC',
  haas: '#B6BABD', audi: '#BB0A30', aston_martin: '#229971', williams: '#64C4FF', cadillac: '#C8B273'
};
const F1_NAMES = { FP1: 'Treino 1', FP2: 'Treino 2', FP3: 'Treino 3', Qual: 'Classificação', Race: 'Corrida', SS: 'Classif. Sprint', SQ: 'Classif. Sprint', Sprint: 'Sprint', SR: 'Sprint' };
const F1_SHORT = { FP1: 'TL1', FP2: 'TL2', FP3: 'TL3', Qual: 'Classif.', Race: 'Corrida', SS: 'C. Sprint', SQ: 'C. Sprint', Sprint: 'Sprint', SR: 'Sprint' };
const F1_MAJOR = { Qual: 1, Race: 1, Sprint: 1, SR: 1 };
const F1_ABBR = { 'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3', Qualifying: 'Qual', Race: 'Race', Sprint: 'Sprint', 'Sprint Qualifying': 'SQ', 'Sprint Shootout': 'SQ' };
const F1_GP = {
  Australia: 'da Austrália', China: 'da China', Japan: 'do Japão', Bahrain: 'do Bahrein', 'Saudi Arabia': 'da Arábia Saudita',
  'United States': 'dos Estados Unidos', Italy: 'da Itália', Monaco: 'de Mônaco', Spain: 'da Espanha', Canada: 'do Canadá',
  Austria: 'da Áustria', 'United Kingdom': 'da Inglaterra', Belgium: 'da Bélgica', Hungary: 'da Hungria', Netherlands: 'da Holanda',
  Azerbaijan: 'do Azerbaijão', Singapore: 'de Singapura', Mexico: 'do México', Brazil: 'do Brasil', Qatar: 'do Catar',
  'United Arab Emirates': 'de Abu Dhabi'
};

const DEFAULT_RULES = {
  remind: true, lineup: false, kick: true, goal: true, red: true, ht: false, end: true,
  tStart: true, tSet: true, tEnd: true, f1Remind: true, f1Start: false, f1End: true
};

const ICONS = {
  now: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l2.5-7 5 14L17 12h4"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>',
  starOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l16 16M8.5 5.4A6 6 0 0 1 18 10c0 3 .5 4.800 1 5.800M6 10c0 6-2 7-2 7h13M10 20.500a2.200 2.200 0 0 0 4 0"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l16 16M10 5.800A9 9 0 0 1 12 5.500C18 5.500 21.500 12 21.500 12a17 17 0 0 1-3 3.800M6.500 7.800A16 16 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 4-1"/></svg>',
  goal: '<svg class="ic-goal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path fill="currentColor" stroke="none" d="m12 7.500 4.300 3.100-1.600 5h-5.400l-1.600-5z"/></svg>',
  sub: '<svg class="ic-sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v14M3.500 14.500 7 18l3.500-3.500M17 20V6M13.500 9.500 17 6l3.500 3.500"/></svg>'
};

// ---------- Estado ----------
const KEY = 'tribuna.v1';
const S = Object.assign({
  onboarded: false,
  teams: [],
  comps: [],
  f1: { on: true, drivers: [] },
  mute: [],
  rules: { ...DEFAULT_RULES },
  spoiler: false,
  quiet: { on: false, from: 23, to: 7 },
  device: null,
  filter: 'all'
}, safeParse(localStorage.getItem(KEY)));
S.rules = { ...DEFAULT_RULES, ...S.rules };

const R = {
  mainRoute: '#/agora', reveal: new Set(), scores: new Map(), lastOk: 0, failed: false, polling: false,
  home: null, f1: null, f1Res: {}, f1Static: null, gameTab: {}, game: {}, stats: {}, standings: {}, nav: 0, f1Tab: 'fds', f1Session: null,
  exLive: 1, exQuery: '', known: {}
};

function safeParse(s) { try { return JSON.parse(s) || {}; } catch (_) { return {}; } }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

// ---------- Utilidades ----------
const $ = (s, el) => (el || document).querySelector(s);
const main = () => $('#main');
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function colorOf(c) {
  const hex = /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#7D8891';
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.16 ? '#7D8891' : hex;
}
function imgUrl(kind, id, iv, size) {
  const s = size || 48;
  return `https://imagecache.365scores.com/image/upload/f_png,w_${s},h_${s},c_limit,q_auto:eco,dpr_2,d_${kind}:default1.png/v${Number(iv) || 1}/${kind}/${Number(id)}`;
}
function initials(n) { return String(n || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); }
function crest(c, size) {
  const round = (c.sportId === 3 || c.type === 4) ? ' round' : '';
  return `<img class="crest${round}" loading="lazy" decoding="async" alt="" width="24" height="24" data-mono="${esc(initials(c.name))}" src="${imgUrl('Competitors', c.id, c.imageVersion || c.iv, size)}">`;
}
function leagueImg(l, cls) {
  return `<img class="${cls || 'crest'}" loading="lazy" alt="" width="24" height="24" data-mono="${esc(initials(l.name))}" src="${imgUrl('Competitions', l.id, l.imageVersion || l.iv)}">`;
}
function dayKey(d) { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; }
function hm(d) { return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function dayLabel(d) {
  const x = new Date(d), now = new Date(), tom = new Date(Date.now() + 864e5), yes = new Date(Date.now() - 864e5);
  if (dayKey(x) === dayKey(now)) return 'Hoje';
  if (dayKey(x) === dayKey(tom)) return 'Amanhã';
  if (dayKey(x) === dayKey(yes)) return 'Ontem';
  return x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
}
function inTime(ms) {
  if (ms <= 0) return 'agora';
  const m = Math.round(ms / 6e4);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${String(m % 60).padStart(2, '0')}`;
  return `${Math.round(h / 24)} dias`;
}
function num(x) { return x == null || x < 0 ? 0 : Math.round(x); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}
async function getJson(url, ms) {
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), ms || 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(tid); }
}
const api = (path) => getJson(`${API}${path}${path.includes('?') ? '&' : '?'}${API_Q}`);
function remember(list) { (list || []).forEach((c) => { if (c && c.id) R.known[c.id] = c; }); }
function dedupeGames(lists) {
  const m = new Map();
  lists.forEach((arr) => (arr || []).forEach((g) => m.set(g.id, g)));
  return [...m.values()];
}

// ---------- Seguir ----------
const isTeam = (id) => S.teams.some((t) => t.id === Number(id));
const isComp = (id) => S.comps.some((t) => t.id === Number(id));
const isMuted = (id) => S.mute.includes(Number(id));
function toggleTeam(c) {
  const id = Number(c.id);
  if (isTeam(id)) { S.teams = S.teams.filter((t) => t.id !== id); S.mute = S.mute.filter((x) => x !== id); }
  else S.teams.push({ id, name: c.name, sportId: c.sportId || 1, iv: c.imageVersion || c.iv || 1, color: c.color || '', type: c.type || 0 });
  save(); syncPrefs(); R.home = null;
}
function toggleComp(c) {
  const id = Number(c.id);
  if (isComp(id)) { S.comps = S.comps.filter((t) => t.id !== id); S.mute = S.mute.filter((x) => x !== -id); }
  else S.comps.push({ id, name: c.name, iv: c.imageVersion || c.iv || 1, sportId: c.sportId || 1 });
  save(); syncPrefs(); R.home = null;
}
function gameIsMine(g) {
  return isTeam(g.homeCompetitor.id) || isTeam(g.awayCompetitor.id) || isComp(g.competitionId);
}
function gameIsFav(g) { return isTeam(g.homeCompetitor.id) || isTeam(g.awayCompetitor.id); }

// ---------- Cartao de jogo ----------
function liveLabel(g) {
  const st = g.statusText || '';
  if (g.sportId === 3) return st || 'Ao vivo';
  if (/intervalo|pênalti|penalti|prorrog/i.test(st) && !g.gameTimeDisplay) return st;
  if (g.gameTimeDisplay) return g.gameTimeDisplay.replace(/\s/g, '');
  if (g.gameTime > 0) return Math.floor(g.gameTime) + "'";
  return st || 'Ao vivo';
}
function hidden(g) { return S.spoiler && g.statusGroup !== 2 && !R.reveal.has(g.id); }
function tennisSets(g) {
  return (g.stages || []).filter((s) => /^S\d/.test(s.shortName || '') && s.homeCompetitorScore >= 0);
}
function tennisGame(g) { return (g.stages || []).find((s) => s.id === 34 && s.isLive); }

function gameCard(g, opts) {
  opts = opts || {};
  const h = g.homeCompetitor, a = g.awayCompetitor;
  const live = g.statusGroup === 3, done = g.statusGroup === 4, soon = g.statusGroup === 2;
  const spoil = hidden(g);
  const hWin = done && !spoil && h.isWinner, aWin = done && !spoil && a.isWinner;
  const selected = location.hash === '#/jogo/' + g.id;
  const status = live
    ? `<span class="status on"><i class="pulse" aria-hidden="true"></i><span class="tn">${esc(liveLabel(g))}</span><span class="vh">ao vivo</span></span>`
    : done ? `<span class="status">${esc(spoil ? dayLabel(g.startTime) : (g.shortStatusText || 'Fim'))}</span>`
    : `<span class="status">${esc(dayLabel(g.startTime))}</span>`;
  const compLine = g.competitionDisplayName || '';
  let rows;
  if (g.sportId === 3 && !soon) {
    const sets = tennisSets(g), gm = live ? tennisGame(g) : null;
    const col = (side) => spoil ? '<span>·</span><span>·</span>' : sets.map((s) => {
      const me = side === 'h' ? s.homeCompetitorScore : s.awayCompetitorScore;
      const ot = side === 'h' ? s.awayCompetitorScore : s.homeCompetitorScore;
      return `<span class="${s.isLive ? 'cur' : me > ot ? 'won' : 'lost'}">${num(me)}</span>`;
    }).join('');
    const pts = (side) => gm ? `<span class="game">${spoil ? '·' : esc(fmtPoint(side === 'h' ? gm.homeCompetitorScore : gm.awayCompetitorScore))}</span>` : '';
    rows = `
      <div class="row ${aWin ? 'lose' : ''}">${crest(h)}<span class="name">${esc(h.name)}</span><span class="sets tn ${spoil ? 'spoil' : ''}">${col('h')}${pts('h')}</span></div>
      <div class="row ${hWin ? 'lose' : ''}">${crest(a)}<span class="name">${esc(a.name)}</span><span class="sets tn ${spoil ? 'spoil' : ''}">${col('a')}${pts('a')}</span></div>`;
  } else {
    const sc = (c) => soon ? '' : `<span class="pts tn ${spoil ? 'spoil' : ''}">${spoil ? '0' : num(c.score)}</span>`;
    rows = `
      <div class="row ${aWin ? 'lose' : ''}">${crest(h)}<span class="name">${esc(h.shortName || h.name)}</span>${sc(h)}</div>
      <div class="row ${hWin ? 'lose' : ''}">${crest(a)}<span class="name">${esc(a.shortName || a.name)}</span>${sc(a)}</div>`;
  }
  const when = soon ? `<div class="when"><b class="tn">${hm(g.startTime)}</b><small>${esc(opts.hideIn ? '' : 'em ' + inTime(new Date(g.startTime) - Date.now()))}</small></div>` : '';
  return `<a class="card ${live ? 'live' : ''} ${soon ? 'has-when' : ''} ${selected ? 'selected' : ''}" href="#/jogo/${Number(g.id)}" data-g="${Number(g.id)}" style="--c1:${colorOf(h.color)};--c2:${colorOf(a.color)}">
    <i class="stripe" aria-hidden="true"></i>
    <div class="meta"><span>${esc(compLine)}</span>${status}</div>
    ${rows}${when}
  </a>`;
}
function fmtPoint(v) { return v === 50 ? 'AD' : num(v); }

// ---------- Carregar painel ----------
async function loadHome() {
  const ids = S.teams.map((t) => t.id);
  const comps = S.comps.map((c) => c.id);
  const calls = [];
  if (ids.length) {
    calls.push(api(`/games/current/?competitors=${ids.join(',')}`));
    calls.push(api(`/games/fixtures/?competitors=${ids.join(',')}`));
  }
  if (comps.length) calls.push(api(`/games/current/?competitions=${comps.join(',')}`));
  const f1Call = S.f1.on ? f1Current().catch(() => R.f1) : Promise.resolve(null);
  const [res, f1] = await Promise.all([Promise.all(calls), f1Call]);
  // A lista "current" e a mais fresca: entra por ultimo para sobrescrever fixtures.
  const games = dedupeGames([res[1] && res[1].games, res[0] && res[0].games, res[2] && res[2].games].filter(Boolean)
    .concat(ids.length ? [] : res.map((r) => r.games)));
  res.forEach((r) => remember(r.competitors));
  R.home = { games, at: Date.now() };
  R.f1 = f1;
  R.lastOk = Date.now(); R.failed = false;
  try { localStorage.setItem('tribuna.snap', JSON.stringify({ games: games.slice(0, 60), at: R.home.at })); } catch (_) {}
  return R.home;
}

function nextF1Session(ev) {
  if (!ev) return null;
  const list = ev.competitions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  return list.find((s) => s.status.type.state === 'in') || list.find((s) => s.status.type.state === 'pre') || null;
}
function f1Card(ev) {
  const sessions = ev.competitions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const nx = nextF1Session(ev);
  const top = nx
    ? (nx.status.type.state === 'in' ? `<span class="status on"><i class="pulse" aria-hidden="true"></i>${esc(F1_NAMES[nx.type.abbreviation] || nx.type.abbreviation)} ao vivo</span>`
      : `<span>${esc(F1_NAMES[nx.type.abbreviation] || nx.type.abbreviation)} · ${esc(dayLabel(nx.date))} ${hm(nx.date)} · em ${inTime(new Date(nx.date) - Date.now())}</span>`)
    : '<span>Fim de semana encerrado</span>';
  const track = sessions.map((s) => {
    const st = s.status.type.state;
    const cls = st === 'in' ? 'on' : st === 'post' ? 'done' : nx && s.id === nx.id ? 'next' : '';
    return `<div class="${cls}">${esc(F1_SHORT[s.type.abbreviation] || s.type.abbreviation)}</div>`;
  }).join('');
  return `<a class="f1card" href="#/f1"><div class="f1top">${top}</div><h3>${esc(ev.name)}</h3><div class="track">${track}</div></a>`;
}

function heroLine(mine, live, f1ev) {
  const favLive = live.filter(gameIsFav);
  if (favLive.length === 1) {
    const g = favLive[0];
    const me = isTeam(g.homeCompetitor.id) ? g.homeCompetitor : g.awayCompetitor;
    return `<b>${esc(me.shortName || me.name)}</b> está ${g.sportId === 3 ? 'em quadra' : 'em campo'} agora.`;
  }
  if (live.length) return `<b>${live.length} ${live.length === 1 ? 'jogo seu' : 'jogos seus'}</b> ao vivo agora.`;
  const up = mine.filter((g) => g.statusGroup === 2 && new Date(g.startTime) > Date.now())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const f1s = f1ev ? nextF1Session(f1ev) : null;
  const gT = up[0] ? new Date(up[0].startTime).getTime() : Infinity;
  const fT = f1s ? new Date(f1s.date).getTime() : Infinity;
  if (gT === Infinity && fT === Infinity) return 'Nada seu marcado por enquanto.';
  if (fT < gT) {
    const nm = F1_NAMES[f1s.type.abbreviation] || f1s.type.abbreviation;
    return `<b>${esc(nm)} da F1</b> ${esc(dayLabel(f1s.date).toLowerCase())} às ${hm(f1s.date)}, em ${inTime(fT - Date.now())}.`;
  }
  const g = up[0];
  const lbl = dayLabel(g.startTime);
  return `Próximo: <b>${esc(g.homeCompetitor.shortName || g.homeCompetitor.name)} x ${esc(g.awayCompetitor.shortName || g.awayCompetitor.name)}</b>, ${esc(lbl.toLowerCase())} às ${hm(g.startTime)}.`;
}

async function checkRobo() {
  if (!ROBO || !S.device) return;
  try {
    const st = await getJson(`${ROBO}?a=status`, 25000);
    R.roboBad = !st.lastTick || st.now - st.lastTick > 10 * 6e4 || st.fails >= 5;
    renderMainView();
  } catch (_) {}
}
function freshHtml() {
  return `<div class="fresh ${R.failed ? 'bad' : ''}" id="fresh"><i aria-hidden="true"></i><span>${freshText()}</span></div>`;
}
function freshText() {
  if (!R.lastOk) return R.failed ? 'sem conexão' : 'carregando';
  const s = Math.round((Date.now() - R.lastOk) / 1000);
  const t = s < 5 ? 'agora' : s < 60 ? `há ${s} s` : `há ${Math.round(s / 60)} min`;
  return R.failed ? `sem conexão · ${t}` : `atualizado ${t}`;
}

function renderAgora() {
  const home = R.home;
  const eyeBtn = `<button class="icon-btn ${S.spoiler ? 'on' : ''}" data-act="spoiler" aria-pressed="${S.spoiler}" aria-label="${S.spoiler ? 'Desligar' : 'Ligar'} modo sem spoiler">${S.spoiler ? ICONS.eyeOff : ICONS.eye}</button>`;
  const top = `<header class="top"><h1>Tribuna</h1><div style="display:flex;align-items:center;gap:4px">${freshHtml()}${eyeBtn}</div></header>`;
  if (!home) return top + '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  const f = S.filter;
  const sportOk = (g) => f === 'all' || (f === 'foot' && g.sportId === 1) || (f === 'ten' && g.sportId === 3);
  const mine = home.games.filter(gameIsMine);
  const shown = mine.filter(sportOk);
  const now = Date.now();
  const byStart = (a, b) => new Date(a.startTime) - new Date(b.startTime);
  const favFirst = (a, b) => (gameIsFav(b) - gameIsFav(a)) || byStart(a, b);
  const live = shown.filter((g) => g.statusGroup === 3).sort(favFirst);
  const today = shown.filter((g) => g.statusGroup === 2 && dayKey(g.startTime) === dayKey(now)).sort(byStart);
  const next = shown.filter((g) => g.statusGroup === 2 && dayKey(g.startTime) !== dayKey(now) && new Date(g.startTime) > now).sort(byStart).slice(0, 5);
  const ended = shown.filter((g) => g.statusGroup === 4 && now - new Date(g.startTime) < 60 * 36e5).sort((a, b) => byStart(b, a)).slice(0, 8);
  const ev = S.f1.on && R.f1 && R.f1.events && R.f1.events[0];
  const showF1 = ev && (f === 'all' || f === 'f1');

  const chip = (k, label) => `<button class="chip" data-act="filter" data-v="${k}" aria-pressed="${f === k}">${label}</button>`;
  const section = (title, list, opts) => list.length ? `<div class="sec"><h2>${title}</h2></div><div class="stack">${list.map((g) => gameCard(g, opts)).join('')}</div>` : '';
  const hasAny = live.length || today.length || next.length || ended.length || showF1;
  const f1Weekend = showF1 && ev.competitions.some((s) => Math.abs(new Date(s.date) - now) < 5 * 864e5);
  return `${top}
    ${R.failed ? `<div class="banner">Não consegui atualizar agora. O que está na tela é da última leitura.</div>` : ''}
    ${R.roboBad ? `<div class="banner">O robô de avisos está parado. Os placares daqui seguem normais, mas os avisos podem não chegar. <a href="#/ajustes" style="text-decoration:underline">Ver detalhes</a></div>` : ''}
    <p class="hero">${heroLine(mine, mine.filter((g) => g.statusGroup === 3), S.f1.on ? ev : null)}</p>
    <div class="chips" role="group" aria-label="Filtrar esporte">${chip('all', 'Tudo')}${chip('foot', 'Futebol')}${chip('ten', 'Tênis')}${S.f1.on ? chip('f1', 'Fórmula 1') : ''}</div>
    ${f !== 'f1' ? section('Ao vivo', live) : ''}
    ${showF1 && f1Weekend ? `<div class="sec"><h2>Fórmula 1</h2></div>${f1Card(ev)}` : ''}
    ${f !== 'f1' ? section('Hoje', today) : ''}
    ${f !== 'f1' ? section('Próximos', next) : ''}
    ${showF1 && !f1Weekend ? `<div class="sec"><h2>Fórmula 1</h2></div>${f1Card(ev)}` : ''}
    ${f !== 'f1' ? section('Encerrados', ended) : ''}
    ${hasAny ? '' : `<div class="empty"><b>Nada por aqui ainda</b>Siga mais times ou tenistas em <a href="#/explorar" style="text-decoration:underline">Explorar</a>.</div>`}`;
}

// ---------- Agenda ----------
async function loadAgenda() {
  const ids = S.teams.map((t) => t.id);
  const lists = [];
  if (ids.length) lists.push((await api(`/games/fixtures/?competitors=${ids.join(',')}`)).games);
  if (S.comps.length) lists.push((await api(`/games/fixtures/?competitions=${S.comps.map((c) => c.id).join(',')}`)).games);
  const sessions = S.f1.on ? await loadF1Sessions().catch(() => []) : [];
  R.agenda = { games: dedupeGames(lists).filter(gameIsMine), sessions, at: Date.now() };
  R.lastOk = Date.now(); R.failed = false;
}
async function loadF1Sessions() {
  const c = safeParse(localStorage.getItem('tribuna.f1s'));
  if (c.at && Date.now() - c.at < 6 * 36e5 && c.list && c.list.length) return c.list;
  try {
    const list = await getJson(`${OPENF1}/sessions?year=${YEAR}`);
    localStorage.setItem('tribuna.f1s', JSON.stringify({ at: Date.now(), list }));
    return list;
  } catch (e) {
    if (c.list && c.list.length) return c.list;
    throw e;
  }
}
function renderAgenda() {
  const head = `<header class="top"><h1>Agenda</h1></header>`;
  if (!R.agenda) return head + '<div class="skeleton"></div><div class="skeleton"></div>';
  const now = Date.now();
  const items = [];
  R.agenda.games.forEach((g) => {
    const t = new Date(g.startTime).getTime();
    if (g.statusGroup === 2 && t > now - 36e5) items.push({ t, kind: g.sportId === 3 ? 'ten' : 'foot', g });
  });
  R.agenda.sessions.forEach((s) => {
    const t = new Date(s.date_start).getTime();
    if (t > now - 2 * 36e5 && t < now + 30 * 864e5 && !s.is_cancelled) items.push({ t, kind: 'f1', s });
  });
  items.sort((a, b) => a.t - b.t);
  const horizon = 14;
  const counts = {};
  items.forEach((it) => { const k = dayKey(it.t); counts[k] = (counts[k] || 0) + 1; });
  let strip = '';
  for (let i = 0; i < horizon; i++) {
    const d = new Date(now + i * 864e5), k = dayKey(d), n = counts[k] || 0;
    const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    strip += `<button class="day-pill ${n ? '' : 'none'}" data-act="jumpday" data-v="${k}" aria-label="${esc(d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}: ${n} eventos"><span>${esc(wd)}</span><b class="tn">${d.getDate()}</b><span class="dots">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
  }
  let html = '', cur = '';
  items.forEach((it) => {
    const k = dayKey(it.t);
    if (k !== cur) {
      cur = k;
      const lbl = dayLabel(it.t);
      const wd = new Date(it.t).toLocaleDateString('pt-BR', { weekday: 'long' });
      html += `<div class="day-h" id="d-${k}"><span>${esc(/^(Hoje|Amanhã|Ontem)$/.test(lbl) ? lbl : wd[0].toUpperCase() + wd.slice(1))}</span><small>${esc(new Date(it.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }))}</small></div>`;
    }
    if (it.g) {
      const g = it.g;
      const label = g.sportId === 3 ? `${g.homeCompetitor.name} x ${g.awayCompetitor.name}` : `${g.homeCompetitor.shortName || g.homeCompetitor.name} x ${g.awayCompetitor.shortName || g.awayCompetitor.name}`;
      html += `<a class="line-item" href="#/jogo/${Number(g.id)}"><span class="h tn">${hm(it.t)}</span><span class="mid"><span class="t1" style="display:block">${esc(label)}</span><span class="t2" style="display:block">${esc(g.competitionDisplayName || '')}</span></span><span class="tag">${g.sportId === 3 ? 'Tênis' : 'Futebol'}</span></a>`;
    } else {
      html += `<a class="line-item" href="#/f1"><span class="h tn">${hm(it.t)}</span><span class="mid"><span class="t1" style="display:block">${esc(ptSession(it.s.session_name))}</span><span class="t2" style="display:block">GP ${esc(it.s.country_name)} · ${esc(it.s.location)}</span></span><span class="tag">F1</span></a>`;
    }
  });
  return `${head}<div class="weekstrip">${strip}</div>${html || '<div class="empty"><b>Agenda vazia</b>Nenhum evento dos seus seguidos nos próximos dias.</div>'}
    <p class="muted" style="font-size:13px;margin-top:14px">Horários no fuso deste aparelho. Jogos de tênis só aparecem quando a organização publica a programação do dia.</p>`;
}
function ptSession(n) {
  return ({ 'Practice 1': 'Treino 1', 'Practice 2': 'Treino 2', 'Practice 3': 'Treino 3', Qualifying: 'Classificação', Race: 'Corrida', Sprint: 'Sprint', 'Sprint Qualifying': 'Classif. Sprint', 'Sprint Shootout': 'Classif. Sprint' })[n] || n;
}

// ---------- Explorar ----------
function renderExplorarShell() {
  const leagues = LEAGUES.map((l) => `<a class="item" href="#/liga/${l.id}">${leagueImg(l)}<span class="grow t1">${esc(l.name)}</span></a>`).join('');
  return `<header class="top"><h1>Explorar</h1></header>
    <div class="search">${ICONS.search}<label class="vh" for="q">Buscar</label><input id="q" type="search" placeholder="Time, seleção ou tenista" autocomplete="off" autocapitalize="off" enterkeyhint="search" value="${esc(R.exQuery)}"></div>
    <div id="ex-results"></div>
    <div id="ex-browse">
      <div class="chips" role="group" aria-label="Esporte">
        <button class="chip" data-act="exsport" data-v="1" aria-pressed="${R.exLive === 1}">Futebol ao vivo</button>
        <button class="chip" data-act="exsport" data-v="3" aria-pressed="${R.exLive === 3}">Tênis ao vivo</button>
        <a class="chip" href="#/f1">Fórmula 1</a>
      </div>
      <div id="ex-live"><div class="skeleton"></div></div>
      <div class="sec"><h2>Campeonatos</h2></div>
      <div class="list">${leagues}</div>
    </div>`;
}
async function loadExLive() {
  const el = $('#ex-live');
  if (!el) return;
  const sport = R.exLive;
  const d = await api(`/games/current/?sports=${sport}`);
  R.lastOk = Date.now(); R.failed = false;
  if (R.exLive !== sport || !$('#ex-live')) return;
  remember(d.competitors);
  const compOf = {}; (d.competitions || []).forEach((c) => { compOf[c.id] = c; });
  const live = d.games.filter((g) => g.statusGroup === 3);
  const groups = {};
  live.forEach((g) => { (groups[g.competitionId] = groups[g.competitionId] || []).push(g); });
  const order = Object.keys(groups).sort((a, b) => ((compOf[b] && compOf[b].popularityRank) || 0) - ((compOf[a] && compOf[a].popularityRank) || 0));
  const html = order.slice(0, 15).map((id) => {
    const c = compOf[id] || { id, name: '' };
    return `<div class="sec"><h2><a href="#/liga/${Number(id)}" style="color:inherit;font:inherit">${esc(c.name)}</a></h2></div><div class="stack">${groups[id].map((g) => gameCard(g)).join('')}</div>`;
  }).join('') || '<div class="empty"><b>Nada ao vivo agora</b>Os jogos em andamento aparecem aqui.</div>';
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
}
let searchTimer, searchLatest = '';
function onSearch(value, target, sportFilter, render) {
  clearTimeout(searchTimer);
  const q = value.trim();
  searchLatest = q;
  if (q.length < 2) { target.innerHTML = ''; if (render) render(false); return; }
  searchTimer = setTimeout(async () => {
    try {
      const d = await api(`/search/?query=${encodeURIComponent(q)}&filter=all`);
      if (searchLatest !== q) return;
      remember(d.competitors);
      let list = (d.competitors || []).filter((c) => (c.sportId === 1 || c.sportId === 3) && !c.hideOnSearch);
      if (sportFilter) list = list.filter((c) => c.sportId === sportFilter);
      if (render) render(true, list);
      else target.innerHTML = list.length ? `<div class="list">${list.slice(0, 12).map((c) => `
        <div class="item">${crest(c)}<a class="grow" href="#/time/${Number(c.id)}"><div class="t1">${esc(c.name)}</div><div class="t2">${c.sportId === 3 ? 'Tênis' : 'Futebol'}</div></a>
        <button class="follow ${isTeam(c.id) ? 'on' : ''}" data-act="follow" data-id="${Number(c.id)}" aria-pressed="${isTeam(c.id)}">${isTeam(c.id) ? 'Seguindo' : 'Seguir'}</button></div>`).join('')}</div><div style="height:10px"></div>`
        : '<div class="empty">Nada encontrado.</div>';
    } catch (_) { target.innerHTML = '<div class="banner">A busca não respondeu. Tente de novo.</div>'; }
  }, 280);
}

// ---------- Time ----------
async function loadTeam(id) {
  const [fx, rs] = await Promise.all([api(`/games/fixtures/?competitors=${id}`), api(`/games/results/?competitors=${id}`)]);
  remember(fx.competitors); remember(rs.competitors);
  R.team = { id, fixtures: fx.games || [], results: (rs.games || []).slice().sort((a, b) => new Date(b.startTime) - new Date(a.startTime)) };
  R.lastOk = Date.now(); R.failed = false;
}
function backBtn() { return `<button class="icon-btn" data-act="back" aria-label="Voltar">${ICONS.back}</button>`; }
function renderTeam(id) {
  const c = R.known[id] || S.teams.find((t) => t.id === id) || { id, name: '' };
  const t = R.team && R.team.id === id ? R.team : null;
  const on = isTeam(id);
  const head = `<header class="top" style="justify-content:flex-start">${backBtn()}${c.name ? crest(c, 64) : ''}<h1 style="font-size:22px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</h1>
    ${on ? `<button class="icon-btn ${isMuted(id) ? '' : 'on'}" data-act="mute" data-id="${id}" aria-pressed="${!isMuted(id)}" aria-label="Avisos deste">${isMuted(id) ? ICONS.bellOff : ICONS.bell}</button>` : ''}
    <button class="follow ${on ? 'on' : ''}" data-act="follow" data-id="${id}" aria-pressed="${on}">${on ? 'Seguindo' : 'Seguir'}</button></header>`;
  if (!t) return head + '<div class="skeleton"></div><div class="skeleton"></div>';
  const fx = t.fixtures.slice(0, 5), rs = t.results.slice(0, 10);
  return `${head}
    ${fx.length ? `<div class="sec"><h2>Próximos</h2></div><div class="stack">${fx.map((g) => gameCard(g)).join('')}</div>` : ''}
    ${rs.length ? `<div class="sec"><h2>Resultados</h2></div><div class="stack">${rs.map((g) => gameCard(g)).join('')}</div>` : ''}
    ${fx.length || rs.length ? '' : '<div class="empty">Sem jogos registrados no momento.</div>'}`;
}

// ---------- Campeonato ----------
async function loadStandings(id) {
  const d = await api(`/standings/?competitions=${id}`);
  (d.standings || []).forEach((s) => (s.rows || []).forEach((r) => remember([r.competitor])));
  R.standings[id] = d;
  return d;
}
function standingsTable(d, highlight) {
  const st = d && d.standings && d.standings[0];
  if (!st || !st.rows || !st.rows.length) return '<div class="empty">Sem tabela para esta fase.</div>';
  const groups = {};
  st.rows.forEach((r) => { const k = r.groupNum || 0; (groups[k] = groups[k] || []).push(r); });
  const names = {}; (st.groups || []).forEach((g) => { names[g.num] = g.name; });
  return Object.keys(groups).map((k) => {
    const rows = groups[k].slice().sort((a, b) => (a.position || 0) - (b.position || 0)).map((r) => {
      const c = r.competitor;
      const sg = r.ratio != null ? r.ratio : (r.for || 0) - (r.against || 0);
      return `<tr class="${highlight && highlight.includes(c.id) ? 'me' : ''}"><td class="pos tn">${r.position || ''}</td>
        <td class="tm"><a href="#/time/${Number(c.id)}">${crest(c)}<em>${esc(c.shortName || c.name)}</em></a></td>
        <td class="b tn">${num(r.points)}</td><td class="tn">${num(r.gamePlayed)}</td><td class="tn">${num(r.gamesWon)}</td><td class="tn">${num(r.gamesEven)}</td><td class="tn">${num(r.gamesLost)}</td><td class="tn">${sg > 0 ? '+' : ''}${Math.round(sg)}</td></tr>`;
    }).join('');
    return `${k !== '0' && names[k] ? `<div class="subhead">${esc(names[k])}</div>` : ''}<table class="table"><thead><tr><th><span class="vh">Posição</span></th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
}
async function loadLeague(id) {
  const [st, gm] = await Promise.all([loadStandings(id).catch(() => null), api(`/games/current/?competitions=${id}`)]);
  const fx = await api(`/games/fixtures/?competitions=${id}`).catch(() => ({ games: [] }));
  const comp = (gm.competitions || []).find((c) => c.id === id) || (st && st.competitions || []).find((c) => c.id === id) || LEAGUES.find((l) => l.id === id) || { id, name: '' };
  R.league = { id, comp, st, games: dedupeGames([fx.games, gm.games]) };
  R.lastOk = Date.now(); R.failed = false;
}
function renderLeague(id) {
  const L = R.league && R.league.id === id ? R.league : null;
  const comp = L ? L.comp : (LEAGUES.find((l) => l.id === id) || { id, name: '' });
  const on = isComp(id);
  const head = `<header class="top" style="justify-content:flex-start">${backBtn()}${comp.name ? leagueImg(comp) : ''}<h1 style="font-size:20px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(comp.name)}</h1>
    <button class="follow ${on ? 'on' : ''}" data-act="followcomp" data-id="${id}" aria-pressed="${on}">${on ? 'Seguindo' : 'Seguir'}</button></header>`;
  if (!L) return head + '<div class="skeleton"></div><div class="skeleton"></div>';
  const by = (a, b) => new Date(a.startTime) - new Date(b.startTime);
  const live = L.games.filter((g) => g.statusGroup === 3);
  const up = L.games.filter((g) => g.statusGroup === 2).sort(by).slice(0, 8);
  const done = L.games.filter((g) => g.statusGroup === 4).sort((a, b) => by(b, a)).slice(0, 6);
  const block = (t, arr) => arr.length ? `<div class="sec"><h2>${t}</h2></div><div class="stack">${arr.map((g) => gameCard(g)).join('')}</div>` : '';
  return `${head}${block('Ao vivo', live)}${block('Próximos', up)}${block('Últimos', done)}
    <div class="sec"><h2>Tabela</h2></div>${S.spoiler && !R.reveal.has('l' + id) ? `<button class="btn" data-act="revealleague" data-v="${id}">Mostrar tabela</button>` : standingsTable(L.st, S.teams.map((t) => t.id))}`;
}

// ---------- Formula 1 ----------
// Monta o fim de semana atual a partir do calendario da OpenF1.
function f1Weekend_(list) {
  const now = Date.now();
  const valid = list.filter((s) => !s.is_cancelled && /^(Practice|Qualifying|Race|Sprint)/.test(s.session_name));
  const groups = {};
  valid.forEach((s) => { (groups[s.meeting_key] = groups[s.meeting_key] || []).push(s); });
  const meetings = Object.values(groups).map((g) => g.sort((a, b) => new Date(a.date_start) - new Date(b.date_start)))
    .sort((a, b) => new Date(a[0].date_start) - new Date(b[0].date_start));
  // Fica no GP ate 12 horas depois da corrida; depois passa para o proximo.
  const cur = meetings.find((g) => new Date(g[g.length - 1].date_end) > now - 12 * 36e5) || meetings[meetings.length - 1];
  if (!cur) return null;
  const gp = F1_GP[cur[0].country_name];
  return {
    name: gp ? `GP ${gp}` : `GP: ${cur[0].country_name}`,
    circuit: cur[0].circuit_short_name,
    competitions: cur.map((s) => {
      const a = new Date(s.date_start).getTime(), z = new Date(s.date_end).getTime();
      return {
        id: String(s.session_key), date: s.date_start, gmt: s.gmt_offset,
        type: { abbreviation: F1_ABBR[s.session_name] || s.session_name },
        status: { type: { state: now < a ? 'pre' : now <= z ? 'in' : 'post' } }
      };
    })
  };
}
async function f1Current() {
  const ev = f1Weekend_(await loadF1Sessions());
  return { events: ev ? [ev] : [] };
}
// Resultado de cada sessao: fica guardado quando ja saiu.
async function loadF1Result(key) {
  const c = R.f1Res[key];
  if (c && c.list.length && Date.now() - c.at < 30 * 6e4) return;
  const [res, drv] = await Promise.all([
    getJson(`${OPENF1}/session_result?session_key=${key}`),
    getJson(`${OPENF1}/drivers?session_key=${key}`)
  ]);
  const byNum = {};
  drv.forEach((d) => { byNum[d.driver_number] = d; });
  R.f1Res[key] = {
    at: Date.now(),
    list: res.filter((r) => r.position != null || r.dnf || r.dns || r.dsq)
      .sort((a, b) => (a.position || 99) - (b.position || 99))
      .map((r) => ({ ...r, driver: byNum[r.driver_number] || {} }))
  };
}
function f1SelectedSession(ev) {
  const done = ev.competitions.filter((s) => s.status.type.state === 'post');
  return done.find((s) => s.id === R.f1Session) || done[done.length - 1] || null;
}
async function loadF1Page() {
  const [cur, sessions] = await Promise.all([f1Current(), loadF1Sessions().catch(() => [])]);
  R.f1 = cur;
  const ev = cur.events[0];
  const sel = ev && f1SelectedSession(ev);
  if (sel) await loadF1Result(sel.id).catch(() => { R.f1Res[sel.id] = R.f1Res[sel.id] || { at: 0, list: [], failed: true }; });
  const c = safeParse(localStorage.getItem('tribuna.f1st'));
  if (c.at && Date.now() - c.at < 36e5 && c.drivers) R.f1Static = c;
  else {
    const [dr, co] = await Promise.all([getJson(`${JOLPICA}/current/driverStandings.json`), getJson(`${JOLPICA}/current/constructorStandings.json`)]);
    const drivers = dr.MRData.StandingsTable.StandingsLists[0].DriverStandings;
    const cons = co.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
    R.f1Static = { at: Date.now(), drivers, cons, round: dr.MRData.StandingsTable.StandingsLists[0].round };
    localStorage.setItem('tribuna.f1st', JSON.stringify(R.f1Static));
  }
  R.f1Sessions = sessions;
  R.lastOk = Date.now(); R.failed = false;
}
function normName(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function followsDriver(fullName) { const n = normName(fullName); return S.f1.drivers.some((d) => n.includes(normName(d))); }
function renderF1() {
  const ev = R.f1 && R.f1.events && R.f1.events[0];
  const head = `<header class="top" style="justify-content:flex-start">${backBtn()}<h1 style="flex:1;font-size:24px">Fórmula 1</h1>
    <button class="follow ${S.f1.on ? 'on' : ''}" data-act="f1toggle" aria-pressed="${S.f1.on}">${S.f1.on ? 'Seguindo' : 'Seguir'}</button></header>`;
  if (!ev && !R.f1Static) return head + '<div class="skeleton"></div><div class="skeleton"></div>';
  const tab = (k, t) => `<button class="chip" data-act="f1tab" data-v="${k}" aria-pressed="${R.f1Tab === k}">${t}</button>`;
  const tabs = `<div class="chips" role="group" aria-label="Seção">${tab('fds', 'Fim de semana')}${tab('pil', 'Pilotos')}${tab('eqp', 'Equipes')}</div>`;
  let body = '';
  if (R.f1Tab === 'fds' && ev) body = f1Weekend(ev);
  if (R.f1Tab === 'pil') body = f1Drivers();
  if (R.f1Tab === 'eqp') body = f1Teams();
  return head + tabs + body;
}
function f1Weekend(ev) {
  const sessions = ev.competitions;
  const trackTime = (x) => {
    if (!x.gmt) return '';
    const neg = x.gmt.startsWith('-');
    const [h, m] = x.gmt.replace('-', '').split(':').map(Number);
    const t = new Date(new Date(x.date).getTime() + (neg ? -1 : 1) * (h * 36e5 + m * 6e4));
    return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')} na pista`;
  };
  const sel = f1SelectedSession(ev);
  const rows = sessions.map((s) => {
    const ab = s.type.abbreviation, st = s.status.type.state;
    const when = `${dayLabel(s.date)} ${hm(s.date)}`;
    const tag = st === 'in' ? '<span class="status on"><i class="pulse" aria-hidden="true"></i>ao vivo</span>' : st === 'post' ? 'encerrado · ver resultado' : `em ${inTime(new Date(s.date) - Date.now())}`;
    const inner = `<b>${esc(F1_NAMES[ab] || ab)}</b><span class="t tn">${esc(when)}</span><small>${tag}</small><small class="r tn">${esc(trackTime(s))}</small>`;
    const cls = `sess ${F1_MAJOR[ab] ? 'major' : ''} ${sel && sel.id === s.id ? 'sel' : ''}`;
    return st === 'post' ? `<button class="${cls}" style="width:100%;text-align:left" data-act="f1sess" data-v="${esc(s.id)}" aria-pressed="${!!sel && sel.id === s.id}">${inner}</button>`
      : `<div class="${cls}">${inner}</div>`;
  }).join('');
  const liveNow = sessions.find((s) => s.status.type.state === 'in');
  let results = liveNow ? `<div class="sec"><h2>${esc(F1_NAMES[liveNow.type.abbreviation] || liveNow.type.abbreviation)} ao vivo</h2></div><p class="muted" style="font-size:14px;margin-bottom:8px">A classificação aparece aqui ao fim da sessão. As fontes abertas não trazem tempos ao vivo.</p>` : '';
  if (sel) {
    const data = R.f1Res[sel.id];
    const hiddenRes = S.spoiler && !R.reveal.has('f1' + sel.id);
    const isRace = ['Race', 'Sprint'].includes(sel.type.abbreviation);
    results += `<div class="sec"><h2>${esc(F1_NAMES[sel.type.abbreviation] || sel.type.abbreviation)}: resultado</h2></div>`;
    if (hiddenRes) results += `<button class="btn" data-act="revealf1" data-v="${esc(sel.id)}">Mostrar resultado</button>`;
    else if (!data) results += '<div class="skeleton"></div>';
    else if (!data.list.length) results += `<div class="empty">${data.failed ? 'Não consegui buscar este resultado agora.' : 'Resultado ainda não publicado.'}</div>`;
    else results += `<div class="list">${data.list.map((r) => {
      const d = r.driver;
      const name = d.full_name ? `${d.first_name || ''} ${d.last_name || ''}`.trim() : `Carro ${r.driver_number}`;
      const out = r.dsq ? 'DSQ' : r.dns ? 'DNS' : r.dnf ? 'DNF' : '';
      const gap = r.position === 1 ? (isRace ? 'Vencedor' : fmtLap(r.duration)) : (typeof r.gap_to_leader === 'number' ? `+${r.gap_to_leader.toFixed(3)}` : (r.gap_to_leader || ''));
      return `<div class="item" style="min-height:48px;${followsDriver(name) ? 'background:#232B12' : ''}"><span class="tn" style="width:22px;color:var(--muted);font-weight:700">${r.position || '-'}</span><i class="bar-team" style="background:${/^[0-9a-f]{6}$/i.test(d.team_colour || '') ? '#' + d.team_colour : '#7D8891'}" aria-hidden="true"></i><div class="grow"><div class="t1">${esc(name)}</div><div class="t2">${esc(d.team_name || '')}</div></div><span class="tn muted" style="font-size:14px">${esc(out || gap)}</span></div>`;
    }).join('')}</div>`;
  }
  return `<div class="panel" style="padding-top:10px"><h3 style="margin:4px 0 2px;font-size:18px">${esc(ev.name)}</h3><p style="margin:0 0 4px;font-size:13px;color:var(--muted)">${esc(ev.circuit || '')}</p>${rows}</div>${results}`;
}
function fmtLap(v) {
  if (typeof v !== 'number') return '';
  const m = Math.floor(v / 60), sec = (v - m * 60).toFixed(3).padStart(6, '0');
  return m ? `${m}:${sec}` : sec;
}
function f1Drivers() {
  if (!R.f1Static) return '<div class="skeleton"></div>';
  const rows = R.f1Static.drivers.map((d) => {
    const team = d.Constructors[0] || {};
    const fam = d.Driver.familyName;
    const on = S.f1.drivers.includes(fam);
    return `<div class="item" style="min-height:52px"><span class="tn" style="width:22px;color:var(--muted);font-weight:700">${esc(d.position || d.positionText)}</span><i class="bar-team" style="background:${F1_TEAMS[team.constructorId] || '#7D8891'}" aria-hidden="true"></i>
      <div class="grow"><div class="t1">${esc(d.Driver.givenName)} ${esc(fam)}</div><div class="t2">${esc(team.name || '')}</div></div>
      <b class="tn">${esc(d.points)}</b>
      <button class="icon-btn ${on ? 'on' : ''}" data-act="driver" data-v="${esc(fam)}" aria-pressed="${on}" aria-label="Seguir ${esc(fam)}">${on ? ICONS.starOn : ICONS.star}</button></div>`;
  }).join('');
  return `<div class="list">${rows}</div><p class="muted" style="font-size:13px;margin-top:8px">Após a etapa ${esc(R.f1Static.round)}. A estrela destaca o piloto nos resultados e nos avisos.</p>`;
}
function f1Teams() {
  if (!R.f1Static) return '<div class="skeleton"></div>';
  return `<div class="list">${R.f1Static.cons.map((c) => `<div class="item" style="min-height:52px"><span class="tn" style="width:22px;color:var(--muted);font-weight:700">${esc(c.position || c.positionText)}</span><i class="bar-team" style="background:${F1_TEAMS[c.Constructor.constructorId] || '#7D8891'}" aria-hidden="true"></i><div class="grow t1">${esc(c.Constructor.name)}</div><b class="tn">${esc(c.points)}</b></div>`).join('')}</div>`;
}

// ---------- Detalhe do jogo ----------
async function loadGame(id) {
  const d = await api(`/game/?gameId=${id}`);
  R.game[id] = d;
  R.lastOk = Date.now(); R.failed = false;
  const tab = R.gameTab[id];
  if (tab === 'num' || d.game.sportId === 3) {
    R.stats[id] = await api(`/game/stats/?games=${id}`).catch(() => R.stats[id]);
  }
  if (tab === 'tab' && !R.standings[d.game.competitionId]) {
    await loadStandings(d.game.competitionId).catch(() => {});
  }
}
function renderGame(id) {
  const d = R.game[id];
  const bar = (mid) => `<div class="d-bar"><button class="icon-btn" data-act="close" aria-label="Fechar">${ICONS.back}</button><div class="d-comp">${mid || ''}</div><span style="width:44px"></span></div>`;
  if (!d) return `<div class="d-head">${bar()}</div><div class="d-body"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  const g = d.game, h = g.homeCompetitor, a = g.awayCompetitor;
  const tennis = g.sportId === 3;
  const live = g.statusGroup === 3, done = g.statusGroup === 4, soon = g.statusGroup === 2;
  const spoil = hidden(g);
  const center = soon
    ? `<div class="big tn" style="font-size:30px;padding-top:8px">${hm(g.startTime)}</div><small>${esc(dayLabel(g.startTime))}${new Date(g.startTime) > Date.now() ? ' · em ' + inTime(new Date(g.startTime) - Date.now()) : ''}</small>`
    : spoil ? `<button class="btn" style="min-height:44px;margin-top:6px;font-size:14px" data-act="reveal" data-id="${g.id}">Mostrar placar</button>`
    : tennis ? `<div class="big tn">${setsOf(g)}</div><small class="${live ? 'on' : ''}">${esc(live ? liveLabel(g) : g.statusText)}</small>`
    : `<div class="big tn">${num(h.score)} - ${num(a.score)}</div><small class="${live ? 'on' : ''}">${esc(live ? liveLabel(g) : g.statusText)}</small>${(g.stages || []).filter((x) => /p[eê]n/i.test(`${x.name || ''} ${x.shortName || ''}`) && x.homeCompetitorScore >= 0).map((x) => `<small class="tn">Pênaltis ${num(x.homeCompetitorScore)} - ${num(x.awayCompetitorScore)}</small>`).join('')}`;
  const penStage = (g.stages || []).find((x) => /p[eê]n/i.test(`${x.name || ''} ${x.shortName || ''}`));
  const scorers = (cid) => (g.events || []).filter((e) => e.eventType.id === 1 && e.competitorId === cid && !(penStage && e.stageId === penStage.id)).map((e) => `${esc(playerName(g, e.playerId))} ${esc(e.gameTimeDisplay || '')}`).join('<br>');
  const teamLink = (c) => `<a class="d-team" href="#/time/${Number(c.id)}"><img class="${tennis ? 'round' : ''}" alt="" width="56" height="56" data-mono="${esc(initials(c.name))}" src="${imgUrl('Competitors', c.id, c.imageVersion, 96)}"><span>${esc(c.shortName || c.name)}${c.rankings && c.rankings[0] ? `<br><small class="muted tn" style="font-weight:500">${esc(c.rankings[0].name)} ${c.rankings[0].position}</small>` : ''}</span></a>`;
  const tabsDef = tennis ? [['jogo', 'Jogo']] : [['jogo', 'Jogo'], ['num', 'Números'], ['esc', 'Escalações'], ...(g.hasStandings ? [['tab', 'Tabela']] : [])];
  const cur = R.gameTab[id] || 'jogo';
  const tabs = tabsDef.length > 1 ? `<div class="tabs" role="tablist">${tabsDef.map(([k, t]) => `<button class="tab" role="tab" data-act="gtab" data-id="${id}" data-v="${k}" aria-selected="${cur === k}">${t}</button>`).join('')}</div>` : '';
  const hs = !tennis && !spoil ? scorers(h.id) : '', as = !tennis && !spoil ? scorers(a.id) : '';
  let body;
  if (tennis) body = tabTennis(g, id, spoil);
  else if (cur === 'num') body = spoil ? spoilNote(g.id) : tabStats(g, id);
  else if (cur === 'esc') body = tabLineups(g);
  else if (cur === 'tab' && spoil) body = spoilNote(g.id);
  else if (cur === 'tab') body = R.standings[g.competitionId] ? standingsTable(R.standings[g.competitionId], [h.id, a.id]) : '<div class="skeleton"></div>';
  else body = tabGame(g, spoil);
  return `<div class="d-head" style="--c1:${colorOf(h.color)};--c2:${colorOf(a.color)}">${bar(esc(g.competitionDisplayName || ''))}
      <div class="d-score">${teamLink(h)}<div class="d-center">${center}</div>${teamLink(a)}</div>
      ${hs || as ? `<div class="d-scorers"><div>${hs}</div><div>${as}</div></div>` : ''}
    </div>${tabs}<div class="d-body" role="tabpanel">${body}</div>`;
}
function setsOf(g) {
  const s = (g.stages || []).find((x) => x.id === 35 || x.shortName === 'Sets');
  return s ? `${num(s.homeCompetitorScore)} - ${num(s.awayCompetitorScore)}` : `${num(g.homeCompetitor.score)} - ${num(g.awayCompetitor.score)}`;
}
function spoilNote(id) { return `<div class="empty"><b>Modo sem spoiler</b>Os números ficam escondidos até você revelar.<div style="height:12px"></div><button class="btn" data-act="reveal" data-id="${id}">Mostrar tudo</button></div>`; }
function playerName(g, id) {
  const m = (g.members || []).find((x) => x.athleteId === id || x.id === id);
  return m ? (m.shortName || m.name) : '';
}
function infoBlock(g) {
  const tv = (g.tvNetworks || []).map((t) => (t.name || '').trim()).filter(Boolean);
  const ref = (g.officials || [])[0];
  const parts = [];
  if (tv.length) parts.push(`<div class="info"><span>Onde ver</span><b style="font-weight:600">${esc(tv.join(' · '))}</b></div>`);
  parts.push(`<div class="info"><span>Início</span><span class="tn" style="width:auto;color:var(--ink);font-size:15px">${esc(dayLabel(g.startTime))}, ${hm(g.startTime)}</span></div>`);
  if (g.venue && g.venue.name) parts.push(`<div class="info"><span>Local</span><span style="width:auto;color:var(--ink);font-size:15px">${esc(g.venue.name)}</span></div>`);
  if (ref && ref.name) parts.push(`<div class="info"><span>Árbitro</span><span style="width:auto;color:var(--ink);font-size:15px">${esc(ref.name)}</span></div>`);
  return `<div class="panel" style="padding:4px 14px">${parts.join('')}</div>`;
}
function pulseChart(g) {
  const ev = g.chartEvents && g.chartEvents.events;
  if (!ev || !ev.length) return '';
  const minOf = (t) => { const m = String(t).match(/(\d+)(?:\+(\d+))?/); return m ? Number(m[1]) + Number(m[2] || 0) : 0; };
  const pts = ev.map((e) => ({ m: minOf(e.time), xg: parseFloat(e.xg) || 0, home: e.competitorNum === 1, goal: e.outcome && e.outcome.name === 'Gol', out: e.outcome ? e.outcome.name : '', time: e.time, player: playerName(g, e.playerId) }));
  const maxM = Math.max(90, ...pts.map((p) => p.m));
  const W = 340, H = 164, mid = 74, L = 6, R0 = 6, amp = 56;
  const x = (m) => L + (m / maxM) * (W - L - R0);
  const marks = pts.map((p) => {
    const hgt = 8 + Math.sqrt(Math.min(1, p.xg)) * amp;
    const y2 = p.home ? mid - hgt : mid + hgt;
    const col = p.home ? 'var(--home)' : 'var(--away)';
    const team = p.home ? (g.homeCompetitor.shortName || g.homeCompetitor.name) : (g.awayCompetitor.shortName || g.awayCompetitor.name);
    const tip = `${p.time} · ${team}${p.player ? ' · ' + p.player : ''} · ${p.out} · xG ${p.xg.toFixed(2)}`;
    return `<g data-tip="${esc(tip)}" tabindex="0" role="img" aria-label="${esc(tip)}">
      <line x1="${x(p.m).toFixed(1)}" x2="${x(p.m).toFixed(1)}" y1="${mid}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>
      ${p.goal ? `<circle cx="${x(p.m).toFixed(1)}" cy="${y2.toFixed(1)}" r="6" fill="var(--ink)" stroke="${col}" stroke-width="3"/>` : `<circle cx="${x(p.m).toFixed(1)}" cy="${y2.toFixed(1)}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`}
      <rect x="${(x(p.m) - 7).toFixed(1)}" y="${p.home ? 0 : mid}" width="14" height="${p.home ? mid : H - mid - 14}" fill="transparent"/></g>`;
  }).join('');
  const ticks = [0, 45, 90].map((m) => `<text x="${x(m).toFixed(1)}" y="${H - 2}" font-size="11" fill="var(--muted)" text-anchor="${m === 0 ? 'start' : m === 90 ? 'end' : 'middle'}">${m}'</text>`).join('');
  return `<section class="viz"><h3>Pulso do jogo</h3><p>Cada traço é uma finalização. Quanto mais alto, maior a chance de gol. Toque para ver.</p>
    <div class="legend"><span><i style="background:var(--home)"></i>${esc(g.homeCompetitor.shortName || g.homeCompetitor.name)} (acima)</span><span><i style="background:var(--away)"></i>${esc(g.awayCompetitor.shortName || g.awayCompetitor.name)} (abaixo)</span><span><i style="background:var(--ink)"></i>Gol</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Finalizações por minuto"><line x1="${L}" x2="${W - R0}" y1="${mid}" y2="${mid}" stroke="var(--line)"/>${ticks}${marks}</svg>
    <div class="tip tn" id="pulse-tip" aria-live="polite"></div></section>`;
}
function tabGame(g, spoil) {
  const info = infoBlock(g);
  if (spoil) return spoilNote(g.id) + '<div style="height:12px"></div>' + info;
  const events = (g.events || []).filter((e) => e.eventType);
  if (!events.length) return info + (g.statusGroup === 2 ? '' : '<div style="height:12px"></div><div class="empty">Sem lances registrados ainda.</div>');
  const hid = g.homeCompetitor.id;
  const row = (e) => {
    const home = e.competitorId === hid;
    const tp = e.eventType.id;
    const icon = tp === 1 ? ICONS.goal : tp === 2 ? '<i class="ic-card ic-y" aria-label="Cartão amarelo"></i>' : tp === 3 ? '<i class="ic-card ic-r" aria-label="Cartão vermelho"></i>' : tp === 1000 ? ICONS.sub : '<i class="ic-card" style="background:var(--muted);height:10px;border-radius:50%" aria-hidden="true"></i>';
    const nm = playerName(g, e.playerId);
    const extra = (e.extraPlayers || []).map((p) => playerName(g, p)).filter(Boolean)[0];
    const sub = tp === 1000 && extra ? `<span class="tl-sub">sai ${esc(extra)}</span>` : tp === 1 && extra ? `<span class="tl-sub">assist. ${esc(extra)}</span>` : '';
    const label = e.eventType.subTypeName || '';
    const kind = tp === 1 && /contra|p[eê]n/i.test(label) ? `<span class="tl-sub">${esc(label)}</span>` : tp !== 1 && tp !== 2 && tp !== 3 && tp !== 1000 ? `<span class="tl-sub">${esc(e.eventType.name || '')}</span>` : '';
    const who = `<span class="tl-who" ${home ? 'style="flex-direction:row-reverse"' : ''}>${icon}<span>${tp === 1 ? `<b>${esc(nm)}</b>` : esc(nm)}${sub}${kind}</span></span>`;
    return `<div class="tl-row"><div class="tl-l">${home ? who : ''}</div><div class="tl-min tn">${esc(e.gameTimeDisplay || '')}</div><div class="tl-r">${home ? '' : who}</div></div>`;
  };
  const seq = [];
  let cur = null;
  const stages = g.stages || [];
  events.forEach((e) => {
    if (cur !== null && e.stageId !== cur) {
      const st = stages.find((s) => s.id === cur);
      if (st && st.isEnded) seq.push(`<div class="tl-sep"><span class="tn">${esc(st.shortName || st.name)} ${num(st.homeCompetitorScore)} - ${num(st.awayCompetitorScore)}</span></div>`);
    }
    cur = e.stageId;
    seq.push(row(e));
  });
  const ordered = g.statusGroup === 3 ? seq.reverse() : seq;
  return `${pulseChart(g)}<div class="tl">${ordered.join('')}</div><div style="height:14px"></div>${info}`;
}
function statPair(rowH, rowA) {
  const val = (r) => {
    if (!r) return 0;
    const v = String(r.value || '0');
    const p = v.match(/\(([\d.]+)%\)/) || v.match(/^([\d.]+)%$/);
    return parseFloat(p ? p[1] : v) || 0;
  };
  const a = val(rowH), b = val(rowA), t = a + b;
  if (!t) {
    return `<div class="stat"><div class="stat-h"><b class="tn">${esc(rowH ? rowH.value : '-')}</b><span>${esc((rowH || rowA).name)}</span><b class="tn">${esc(rowA ? rowA.value : '-')}</b></div><div class="stat-b" aria-hidden="true"><i style="width:100%;background:var(--line)"></i></div></div>`;
  }
  const ph = (a / t) * 100;
  return `<div class="stat"><div class="stat-h"><b class="tn">${esc(rowH ? rowH.value : '-')}</b><span>${esc((rowH || rowA).name)}</span><b class="tn">${esc(rowA ? rowA.value : '-')}</b></div>
    <div class="stat-b" aria-hidden="true"><i class="h" style="width:${ph.toFixed(1)}%"></i><i class="a" style="width:${(100 - ph).toFixed(1)}%"></i></div></div>`;
}
function statPairs(list, hid, aid) {
  const by = new Map();
  list.forEach((s) => {
    const k = s.id + '|' + s.name;
    if (!by.has(k)) by.set(k, { order: s.order || 0, cat: s.categoryName || '', major: s.isMajor, top: s.isTop || s.isPrimary });
    const o = by.get(k);
    if (s.competitorId === hid) o.h = s; else if (s.competitorId === aid) o.a = s;
  });
  return [...by.values()].filter((o) => o.h || o.a).sort((x, y) => x.order - y.order);
}
function tabStats(g, id) {
  const d = R.stats[id];
  if (!d) return '<div class="skeleton"></div>';
  const pairs = statPairs(d.statistics || [], g.homeCompetitor.id, g.awayCompetitor.id);
  if (!pairs.length) return '<div class="empty">Estatísticas ainda não disponíveis.</div>';
  const legend = `<div class="legend" style="justify-content:space-between;margin-bottom:12px"><span><i style="background:var(--home)"></i>${esc(g.homeCompetitor.shortName || g.homeCompetitor.name)}</span><span><i style="background:var(--away)"></i>${esc(g.awayCompetitor.shortName || g.awayCompetitor.name)}</span></div>`;
  const top = pairs.filter((p) => p.top || p.major);
  const rest = pairs.filter((p) => !(p.top || p.major));
  const cats = {};
  rest.forEach((p) => { (cats[p.cat || 'Outros'] = cats[p.cat || 'Outros'] || []).push(p); });
  return legend + top.map((p) => statPair(p.h, p.a)).join('') + Object.keys(cats).map((c) => `<div class="subhead">${esc(c)}</div>${cats[c].map((p) => statPair(p.h, p.a)).join('')}`).join('');
}
function tabLineups(g) {
  const hl = g.homeCompetitor.lineups, al = g.awayCompetitor.lineups;
  if (!hl || !al || !hl.members || !al.members) return '<div class="empty"><b>Escalações ainda não saíram</b>Costumam aparecer cerca de uma hora antes do jogo.</div>';
  const mem = {}; (g.members || []).forEach((m) => { mem[m.id] = m; });
  const hasField = (l) => l.members.some((x) => x.status === 1 && x.yardFormation);
  const pl = (x, side) => {
    const m = mem[x.id] || {}, y = x.yardFormation;
    if (!y) return '';
    const line = y.fieldLine, sideX = y.fieldSide;
    // Mandante ataca para baixo e visitante para cima, cada um na propria metade.
    const top = side === 'h' ? 6 + line * 0.36 : 94 - line * 0.36;
    const left = 12 + (side === 'h' ? sideX : 100 - sideX) * 0.76;
    return `<div class="pl ${side}" style="top:${top.toFixed(1)}%;left:${left.toFixed(1)}%"><b class="tn">${esc(m.jerseyNumber != null ? m.jerseyNumber : '')}</b><span>${esc(m.shortName || m.name || '')}</span></div>`;
  };
  const starters = (l) => l.members.filter((x) => x.status === 1);
  const subs = (l) => l.members.filter((x) => x.status === 2);
  const out = (l) => l.members.filter((x) => x.status === 3);
  const nm = (x) => { const m = mem[x.id] || {}; return `${m.jerseyNumber != null ? m.jerseyNumber + '  ' : ''}${m.shortName || m.name || ''}`; };
  const pitch = hasField(hl) && hasField(al) ? `<div class="pitch" role="img" aria-label="Escalações em campo">
      <span class="pitch-label" style="top:8px">${esc(g.homeCompetitor.shortName || g.homeCompetitor.name)} · ${esc(hl.formation || '')}</span>
      <span class="pitch-label" style="bottom:8px">${esc(g.awayCompetitor.shortName || g.awayCompetitor.name)} · ${esc(al.formation || '')}</span>
      ${starters(hl).map((x) => pl(x, 'h')).join('')}${starters(al).map((x) => pl(x, 'a')).join('')}</div>` : '';
  const listBlock = (title, arr) => arr.length ? `<div class="subhead">${title}</div><div class="subs tn">${arr.map((x) => `<div>${esc(nm(x))}</div>`).join('')}</div>` : '';
  const prob = hl.status && !/confirm/i.test(hl.status) ? `<p class="muted" style="font-size:13px;margin-bottom:10px">${esc(hl.status)}. Pode mudar até o início.</p>` : '';
  return `${prob}${pitch}
    ${pitch ? '' : listBlock(esc(g.homeCompetitor.name), starters(hl)) + listBlock(esc(g.awayCompetitor.name), starters(al))}
    ${listBlock('Banco: ' + esc(g.homeCompetitor.shortName || g.homeCompetitor.name), subs(hl))}
    ${listBlock('Banco: ' + esc(g.awayCompetitor.shortName || g.awayCompetitor.name), subs(al))}
    ${listBlock('Desfalques: ' + esc(g.homeCompetitor.shortName || g.homeCompetitor.name), out(hl))}
    ${listBlock('Desfalques: ' + esc(g.awayCompetitor.shortName || g.awayCompetitor.name), out(al))}`;
}
function tabTennis(g, id, spoil) {
  if (spoil) return spoilNote(g.id);
  const sets = tennisSets(g), gm = tennisGame(g);
  const cols = `minmax(0,1fr) repeat(${sets.length + (gm ? 1 : 0)}, 34px)`;
  const cell = (s, side) => {
    const me = side === 'h' ? s.homeCompetitorScore : s.awayCompetitorScore, ot = side === 'h' ? s.awayCompetitorScore : s.homeCompetitorScore;
    return `<span class="c tn ${s.isLive ? 'on' : me < ot ? 'lost' : ''}">${num(me)}</span>`;
  };
  const line = (c, side) => `<div class="gr" style="grid-template-columns:${cols}"><span class="n">${crest(c)}<span>${esc(c.name)}</span></span>${sets.map((s) => cell(s, side)).join('')}${gm ? `<span class="c tn on">${esc(fmtPoint(side === 'h' ? gm.homeCompetitorScore : gm.awayCompetitorScore))}</span>` : ''}</div>`;
  const grid = sets.length ? `<div class="grid-set"><div class="gr head" style="grid-template-columns:${cols}"><span></span>${sets.map((s, i) => `<span class="c">${i + 1}º</span>`).join('')}${gm ? '<span class="c">Pts</span>' : ''}</div>${line(g.homeCompetitor, 'h')}${line(g.awayCompetitor, 'a')}</div>` : '';
  const d = R.stats[id];
  const pairs = d ? statPairs(d.statistics || [], g.homeCompetitor.id, g.awayCompetitor.id) : [];
  const legend = pairs.length ? `<div class="subhead">Números</div><div class="legend" style="justify-content:space-between;margin-bottom:12px"><span><i style="background:var(--home)"></i>${esc(g.homeCompetitor.name)}</span><span><i style="background:var(--away)"></i>${esc(g.awayCompetitor.name)}</span></div>` : '';
  return `${grid}${legend}${pairs.map((p) => statPair(p.h, p.a)).join('')}<div style="height:14px"></div>${infoBlock(g)}`;
}

// ---------- Notificacoes ----------
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const pushCapable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function followsPayload() {
  return {
    follows: {
      c: S.teams.map((t) => t.id), comp: S.comps.map((c) => c.id), f1: S.f1.on,
      drivers: S.f1.drivers, mute: S.mute
    },
    rules: S.rules, spoiler: S.spoiler, quiet: S.quiet
  };
}
async function roboPost(body) {
  const r = await fetch(ROBO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
let syncTimer;
function syncPrefs() {
  if (!ROBO || !S.device) return;
  clearTimeout(syncTimer);
  S.dirty = true; save();
  syncTimer = setTimeout(flushPrefs, 900);
}
async function flushPrefs() {
  if (!ROBO || !S.device) return;
  try {
    const r = await roboPost({ a: 'prefs', id: S.device.id, secret: S.device.secret, ...followsPayload() });
    if (r.ok) { S.dirty = false; save(); }
    else if (r.code === 'auth') { S.device = null; save(); toast('Este aparelho precisa ativar os avisos de novo.'); }
  } catch (_) { /* tenta de novo ao abrir o app */ }
}
function b64ToBytes(b) {
  const s = atob(b.replace(/-/g, '+').replace(/_/g, '/').padEnd(b.length + (4 - b.length % 4) % 4, '='));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function enablePush(pin) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão de notificação não concedida.');
  const st = await getJson(`${ROBO}?a=status`, 25000);
  if (!st.publicKey) throw new Error('O robô ainda não terminou de instalar.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const want = b64ToBytes(st.publicKey);
    if (!cur || cur.length !== want.length || cur.some((v, i) => v !== want[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(st.publicKey) });
  const body = { a: 'subscribe', pin, sub: sub.toJSON(), ...followsPayload() };
  if (S.device) { body.id = S.device.id; body.secret = S.device.secret; }
  const r = await roboPost(body);
  if (!r.ok) throw new Error(r.error || 'O robô recusou.');
  S.device = { id: r.id, secret: r.secret, endpoint: sub.endpoint, key: st.publicKey };
  S.dirty = false; save();
}
// Apple e Google podem trocar a assinatura sem avisar: confere toda vez que abre.
async function keepPushAlive() {
  if (!ROBO || !S.device || !pushCapable() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(S.device.key) });
    if (sub.endpoint !== S.device.endpoint) {
      const r = await roboPost({ a: 'subscribe', id: S.device.id, secret: S.device.secret, sub: sub.toJSON(), ...followsPayload() });
      if (r.ok) { S.device.endpoint = sub.endpoint; save(); }
      else if (r.code === 'pin' || r.code === 'auth') { S.device = null; save(); toast('Os avisos deste aparelho precisam ser ligados de novo.'); }
    } else {
      // O robo marca assinatura morta; reenviar a mesma nao custa nada e restaura o aparelho.
      const r = await roboPost({ a: 'subscribe', id: S.device.id, secret: S.device.secret, sub: sub.toJSON(), ...followsPayload() });
      if (r.ok) { S.dirty = false; save(); }
      else if (r.code === 'pin' || r.code === 'auth') { S.device = null; save(); toast('Os avisos deste aparelho precisam ser ligados de novo.'); }
    }
  } catch (_) {}
}
function pushPanel() {
  if (!ROBO) return `<div class="panel"><h3>Avisos</h3><p>O robô de avisos ainda não foi ligado.</p></div>`;
  if (isIOS() && !isStandalone()) {
    return `<div class="panel"><h3>Instale para receber avisos</h3><p>No iPhone, os avisos só funcionam com a Tribuna na Tela de Início.</p>
      <ol class="steps"><li>Toque no botão <b>Compartilhar</b> do Safari (quadrado com seta para cima).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b> e abra a Tribuna pelo ícone novo.</li></ol></div>`;
  }
  if (!pushCapable()) return `<div class="panel"><h3>Avisos</h3><p>Este navegador não oferece notificações. No iPhone, é preciso iOS 16.4 ou mais novo.</p></div>`;
  if (Notification.permission === 'denied') {
    return `<div class="panel"><h3>Avisos bloqueados</h3><p>${isIOS() ? 'Abra Ajustes do iPhone, Notificações, Tribuna, e ligue Permitir Notificações.' : 'Clique no cadeado ao lado do endereço e permita notificações.'}</p></div>`;
  }
  if (S.device && Notification.permission === 'granted') {
    return `<div class="panel"><div class="state ok" style="margin-bottom:12px"><i aria-hidden="true"></i>Avisos ligados neste aparelho</div>
      <div class="stack"><button class="btn" data-act="pushtest">Enviar aviso de teste</button><button class="btn" data-act="pushoff" style="background:none;color:var(--muted);min-height:44px">Desligar neste aparelho</button></div></div>`;
  }
  return `<div class="panel"><h3>Ligar os avisos</h3><p>Digite o PIN de 6 dígitos que você recebeu. Ele só é pedido uma vez em cada aparelho.</p>
    <label class="field">PIN<input id="pin" class="tn" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"></label>
    <button class="btn primary" data-act="pushon">Ligar avisos</button></div>`;
}
async function loadRoboStatus() {
  const el = $('#robo');
  if (!el || !ROBO) return;
  try {
    const st = await getJson(`${ROBO}?a=status`, 25000);
    const age = (st.now - st.lastTick) / 6e4;
    const ok = st.lastTick && age < 6 && !(st.fails >= 5);
    const last = st.lastPoll ? `leu placares às ${hm(st.lastPoll)}` : 'ainda sem jogo para vigiar';
    el.className = 'state ' + (ok ? 'ok' : 'bad');
    el.innerHTML = `<i aria-hidden="true"></i><span>${ok ? `Robô em dia: ${esc(last)}` : `Robô parado ou com erro (${esc(st.lastError || 'sem sinal há ' + Math.round(age) + ' min')})`}</span>`;
  } catch (_) {
    el.className = 'state bad';
    el.innerHTML = '<i aria-hidden="true"></i><span>Não consegui falar com o robô agora.</span>';
  }
}

// ---------- Ajustes ----------
function sw(key, label, hint) {
  return `<label class="sw"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" role="switch" data-act="rule" data-v="${key}" ${S.rules[key] ? 'checked' : ''}></label>`;
}
function renderAjustes() {
  const follows = [
    ...S.teams.map((t) => `<div class="item">${crest({ ...t, imageVersion: t.iv })}<a class="grow" href="#/time/${t.id}"><div class="t1">${esc(t.name)}</div><div class="t2">${t.sportId === 3 ? 'Tênis' : 'Futebol'}</div></a>
       <button class="icon-btn ${isMuted(t.id) ? '' : 'on'}" data-act="mute" data-id="${t.id}" aria-pressed="${!isMuted(t.id)}" aria-label="Avisos de ${esc(t.name)}">${isMuted(t.id) ? ICONS.bellOff : ICONS.bell}</button>
       <button class="icon-btn on" data-act="follow" data-id="${t.id}" aria-label="Deixar de seguir ${esc(t.name)}">${ICONS.starOn}</button></div>`),
    ...S.comps.map((c) => `<div class="item">${leagueImg(c)}<a class="grow" href="#/liga/${c.id}"><div class="t1">${esc(c.name)}</div><div class="t2">Campeonato inteiro</div></a>
       <button class="icon-btn ${isMuted(-c.id) ? '' : 'on'}" data-act="mute" data-id="${-c.id}" aria-pressed="${!isMuted(-c.id)}" aria-label="Avisos de ${esc(c.name)}">${isMuted(-c.id) ? ICONS.bellOff : ICONS.bell}</button>
       <button class="icon-btn on" data-act="followcomp" data-id="${c.id}" aria-label="Deixar de seguir ${esc(c.name)}">${ICONS.starOn}</button></div>`)
  ].join('');
  const opts = (v) => Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === v ? 'selected' : ''}>${String(h).padStart(2, '0')}h</option>`).join('');
  return `<header class="top"><h1>Ajustes</h1></header>
    ${pushPanel()}
    ${ROBO ? '<div class="panel"><div class="state" id="robo"><i aria-hidden="true"></i><span>Verificando o robô</span></div></div>' : ''}

    <div class="sec"><h2>Quem você segue</h2><button data-act="reonboard">Escolher mais</button></div>
    <div class="list">${follows || '<div class="item muted">Ninguém ainda.</div>'}
      <label class="sw"><span>Fórmula 1<small>Fim de semana no painel e avisos</small></span><input type="checkbox" role="switch" data-act="f1switch" ${S.f1.on ? 'checked' : ''}></label>
    </div>

    <div class="sec"><h2>Avisar no futebol</h2></div>
    <div class="set-group">
      ${sw('remind', 'Lembrete antes do jogo', '20 minutos antes')}${sw('lineup', 'Escalações confirmadas')}${sw('kick', 'Início do jogo')}
      ${sw('goal', 'Gols')}${sw('red', 'Cartão vermelho')}${sw('ht', 'Intervalo')}${sw('end', 'Fim do jogo')}
    </div>
    <div class="sec"><h2>Avisar no tênis</h2></div>
    <div class="set-group">${sw('tStart', 'Início da partida')}${sw('tSet', 'Fim de cada set')}${sw('tEnd', 'Resultado final')}</div>
    <div class="sec"><h2>Avisar na Fórmula 1</h2></div>
    <div class="set-group">${sw('f1Remind', 'Lembrete', '30 minutos antes da classificação, sprint e corrida')}${sw('f1Start', 'Largada')}${sw('f1End', 'Pódio e resultado')}</div>

    <div class="sec"><h2>Sossego</h2></div>
    <div class="set-group">
      <label class="sw"><span>Modo sem spoiler<small>Esconde placares no app e corta avisos que contam o resultado</small></span><input type="checkbox" role="switch" data-act="spoilersw" ${S.spoiler ? 'checked' : ''}></label>
      <label class="sw"><span>Horário silencioso<small>Nenhum aviso neste intervalo</small></span><input type="checkbox" role="switch" data-act="quiet" ${S.quiet.on ? 'checked' : ''}></label>
      ${S.quiet.on ? `<div class="hours"><label>Das <select data-act="quietfrom" aria-label="Início">${opts(S.quiet.from)}</select></label><label>às <select data-act="quietto" aria-label="Fim">${opts(S.quiet.to)}</select></label></div>` : ''}
    </div>
    <p class="muted" style="font-size:13px;margin:18px 2px 0">Dados: 365Scores (futebol e tênis), ESPN, Jolpica e OpenF1 (Fórmula 1). Não são fontes oficiais e podem atrasar ou mudar. Seus seguidos ficam neste aparelho; para os avisos, a lista também vai para o seu robô.</p>`;
}

// ---------- Boas-vindas ----------
const OB = { step: 0, teams: null, results: null };
function obProgress() { return `<div class="ob-prog" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i <= OB.step ? 'on' : ''}"></i>`).join('')}</div>`; }
function pickBtn(c, on, act) {
  const round = c.sportId === 3 ? 'round' : '';
  const src = act === 'obcomp' ? imgUrl('Competitions', c.id, c.iv, 64) : imgUrl('Competitors', c.id, c.imageVersion || c.iv, 64);
  return `<button class="pick" data-act="${act}" data-id="${Number(c.id)}" aria-pressed="${on}"><img class="${round}" loading="lazy" alt="" width="36" height="36" data-mono="${esc(initials(c.name))}" src="${src}"><span>${esc(c.shortName || c.name)}</span></button>`;
}
function renderOnboarding() {
  const el = $('#onboarding');
  if (S.onboarded && OB.step === 0 && !OB.force) { el.hidden = true; return; }
  el.hidden = false;
  const foot = (next, skip) => `<div class="ob-foot"><button class="btn primary" data-act="obnext">${next}</button>${skip ? `<button class="ob-skip" data-act="obnext">${skip}</button>` : ''}</div>`;
  const searchBox = (ph) => `<div class="search">${ICONS.search}<label class="vh" for="obq">Buscar</label><input id="obq" type="search" placeholder="${ph}" autocomplete="off" enterkeyhint="search"></div>`;
  if (OB.step === 0) {
    const teams = OB.teams || [];
    el.innerHTML = `<div class="ob">${obProgress()}<h1>Quem é o seu time?</h1><p class="lead">Sua Tribuna mostra só quem você escolher. Sem anúncio, sem aposta.</p>
      <div class="ob-body">${searchBox('Buscar time ou seleção')}<div id="obres"></div>
        <div class="sec" style="margin-top:0"><h2>Série A</h2></div><div class="grid-pick" id="obteams">${teams.map((c) => pickBtn(c, isTeam(c.id), 'obteam')).join('') || '<div class="skeleton" style="grid-column:1/-1"></div>'}</div>
        <div class="sec"><h2>Campeonatos inteiros</h2></div><div class="grid-pick">${LEAGUES.map((l) => pickBtn(l, isComp(l.id), 'obcomp')).join('')}</div>
      </div>${foot('Continuar')}</div>`;
    if (!OB.teams) loadObTeams();
  } else if (OB.step === 1) {
    el.innerHTML = `<div class="ob">${obProgress()}<h1>E no tênis?</h1><p class="lead">Escolha quem você quer acompanhar.</p>
      <div class="ob-body">${searchBox('Buscar tenista')}<div id="obres"></div>
        <div class="grid-pick">${TENNIS_TOP.map((c) => pickBtn(c, isTeam(c.id), 'obteam')).join('')}</div></div>${foot('Continuar', 'Não acompanho tênis')}</div>`;
  } else if (OB.step === 2) {
    el.innerHTML = `<div class="ob">${obProgress()}<h1>Fórmula 1</h1><p class="lead">Fim de semana de corrida no seu fuso, com aviso antes de cada sessão importante.</p>
      <div class="ob-body"><div class="set-group"><label class="sw"><span>Acompanhar a Fórmula 1</span><input type="checkbox" role="switch" data-act="f1switch" ${S.f1.on ? 'checked' : ''}></label></div>
      <div id="obf1">${S.f1.on ? '<div class="skeleton"></div>' : ''}</div></div>${foot('Continuar')}</div>`;
    if (S.f1.on) loadObF1();
  } else {
    el.innerHTML = `<div class="ob">${obProgress()}<h1>Quer ser avisado?</h1><p class="lead">Gol, fim de jogo, início da corrida. Você ajusta tudo depois em Ajustes.</p>
      <div class="ob-body">${pushPanel()}</div>${foot('Abrir a Tribuna')}</div>`;
  }
  const q = $('#obq');
  if (q) {
    const sport = OB.step === 1 ? 3 : 1;
    q.addEventListener('input', () => {
      const box = $('#obres');
      onSearch(q.value, box, sport, (has, list) => {
        if (!has) { box.innerHTML = ''; return; }
        OB.results = list;
        box.innerHTML = list.length ? `<div class="sec" style="margin-top:0"><h2>Resultados</h2></div><div class="grid-pick">${list.slice(0, 9).map((c) => pickBtn(c, isTeam(c.id), 'obteam')).join('')}</div><div style="height:12px"></div>` : '<div class="empty" style="margin-bottom:12px">Nada encontrado.</div>';
      });
    });
  }
}
async function loadObTeams() {
  try {
    const d = await api('/standings/?competitions=113');
    const rows = (d.standings && d.standings[0] && d.standings[0].rows) || [];
    OB.teams = rows.map((r) => r.competitor).sort((a, b) => (b.popularityRank || 0) - (a.popularityRank || 0));
    remember(OB.teams);
    if (OB.step === 0) { const y = $('#onboarding').scrollTop; renderOnboarding(); $('#onboarding').scrollTop = y; }
  } catch (_) {
    OB.teams = [];
    const g = $('#obteams'); if (g) g.innerHTML = '<div class="banner" style="grid-column:1/-1">Não consegui carregar a lista. Use a busca acima ou continue e escolha depois.</div>';
  }
}
async function loadObF1() {
  const box = $('#obf1');
  try {
    await loadF1Static();
    const b = $('#obf1');
    if (b) b.innerHTML = `<div class="sec"><h2>Pilotos para destacar (opcional)</h2></div>${f1Drivers()}`;
  } catch (_) { if (box) box.innerHTML = ''; }
}
async function loadF1Static() {
  if (R.f1Static) return;
  const c = safeParse(localStorage.getItem('tribuna.f1st'));
  if (c.at && Date.now() - c.at < 36e5 && c.drivers) { R.f1Static = c; return; }
  const [dr, co] = await Promise.all([getJson(`${JOLPICA}/current/driverStandings.json`), getJson(`${JOLPICA}/current/constructorStandings.json`)]);
  const l = dr.MRData.StandingsTable.StandingsLists[0];
  R.f1Static = { at: Date.now(), drivers: l.DriverStandings, cons: co.MRData.StandingsTable.StandingsLists[0].ConstructorStandings, round: l.round };
  localStorage.setItem('tribuna.f1st', JSON.stringify(R.f1Static));
}

// ---------- Navegacao ----------
function parseHash() {
  const p = (location.hash || '#/agora').replace(/^#\//, '').split('/');
  return { view: p[0] || 'agora', id: p[1] ? Number(p[1]) : null };
}
function renderNav() {
  const r = parseHash();
  const cur = R.mainRoute.replace(/^#\//, '').split('/')[0];
  const active = (k) => (k === cur || (k === 'explorar' && ['time', 'liga', 'f1'].includes(cur)) ? 'aria-current="page"' : '');
  const liveMine = R.home ? R.home.games.filter((g) => g.statusGroup === 3 && gameIsMine(g)).length : 0;
  const item = (k, ic, t, dot) => `<a class="nav-item" href="#/${k}" ${active(k)}>${ICONS[ic]}<span>${t}</span>${dot ? '<i class="nav-dot" aria-label="Ao vivo"></i>' : ''}</a>`;
  const html = `<div class="nav-brand"><img src="icons/favicon-32.png" alt="" width="28" height="28">Tribuna</div>${item('agora', 'now', 'Agora', liveMine > 0)}${item('agenda', 'cal', 'Agenda')}${item('explorar', 'search', 'Explorar')}${item('ajustes', 'gear', 'Ajustes')}`;
  const n = $('#nav');
  if (n.dataset.h !== html) { n.innerHTML = html; n.dataset.h = html; }
  void r;
}
function setMain(html) {
  const m = main();
  if (m.dataset.h === html) return;
  m.innerHTML = html;
  m.dataset.h = html;
  flashChanges(m);
}
function flashChanges(root) {
  const games = (R.home && R.home.games) || [];
  games.forEach((g) => {
    if (g.statusGroup !== 3 && g.statusGroup !== 4) return;
    const k = `${num(g.homeCompetitor.score)}-${num(g.awayCompetitor.score)}|${(g.stages || []).map((s) => s.homeCompetitorScore + ':' + s.awayCompetitorScore).join(',')}`;
    const prev = R.scores.get(g.id);
    R.scores.set(g.id, k);
    if (prev && prev !== k && !hidden(g)) {
      const el = root.querySelector(`[data-g="${Number(g.id)}"]`);
      if (el) el.classList.add('flash');
    }
  });
}
function renderMainView() {
  const r = R.mainRoute.replace(/^#\//, '').split('/');
  const v = r[0], id = r[1] ? Number(r[1]) : null;
  if (v === 'agenda') return setMain(renderAgenda());
  if (v === 'ajustes') return;
  if (v === 'explorar') return;
  if (v === 'time') return setMain(renderTeam(id));
  if (v === 'liga') return setMain(renderLeague(id));
  if (v === 'f1') return setMain(renderF1());
  setMain(renderAgora());
}
async function loadMainView() {
  const r = R.mainRoute.replace(/^#\//, '').split('/');
  const v = r[0], id = r[1] ? Number(r[1]) : null;
  if (v === 'agenda') await loadAgenda();
  else if (v === 'explorar') await loadExLive();
  else if (v === 'time') await loadTeam(id);
  else if (v === 'liga') await loadLeague(id);
  else if (v === 'f1') await loadF1Page();
  else if (v !== 'ajustes') await loadHome();
  else return;
}
function renderDetail() {
  const r = parseHash();
  const el = $('#detail');
  if (r.view === 'jogo' && r.id) {
    el.classList.add('open');
    document.body.style.overflow = matchMedia('(min-width:1000px)').matches ? '' : 'hidden';
    const html = renderGame(r.id);
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  } else {
    el.classList.remove('open');
    document.body.style.overflow = '';
    const html = `<div class="placeholder"><div>Escolha um jogo para ver os detalhes.</div></div>`;
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }
}
async function route() {
  const r = parseHash();
  R.nav++;
  if (r.view !== 'jogo') {
    const h = location.hash || '#/agora';
    const changed = h !== R.mainRoute;
    R.mainRoute = h;
    if (changed || !R.routed) {
      window.scrollTo(0, 0); main().scrollTop = 0;
      delete main().dataset.h;
      if (r.view === 'explorar') {
        main().innerHTML = renderExplorarShell();
        bindExplorar();
      } else if (r.view === 'ajustes') {
        main().innerHTML = renderAjustes();
        loadRoboStatus();
      }
    }
    R.routed = true;
  }
  renderNav();
  renderDetail();
  renderMainView();
  poll(true);
}
function bindExplorar() {
  const q = $('#q'), res = $('#ex-results'), br = $('#ex-browse');
  q.addEventListener('input', () => {
    R.exQuery = q.value.trim();
    br.hidden = R.exQuery.length >= 2;
    onSearch(q.value, res);
  });
  if (R.exQuery.length >= 2) { br.hidden = true; onSearch(R.exQuery, res); }
}
function updateBadge() {
  if (!('setAppBadge' in navigator) || !R.home) return;
  const n = R.home.games.filter((g) => g.statusGroup === 3 && gameIsFav(g)).length;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
async function poll(force) {
  if (R.polling && !force) return;
  if (document.hidden) return;
  if (!S.onboarded) return;
  R.polling = true;
  const r = parseHash();
  try {
    const tasks = [loadMainView()];
    if (r.view === 'jogo' && r.id) tasks.push(loadGame(r.id));
    const needsHome = R.mainRoute.indexOf('agora') < 0 && (!R.home || Date.now() - R.home.at > 60000);
    if (needsHome) tasks.push(loadHome().catch(() => {}));
    await Promise.all(tasks);
  } catch (e) {
    R.failed = true;
    console.warn('falha ao atualizar', e);
  } finally {
    R.polling = false;
  }
  renderMainView();
  renderDetail();
  renderNav();
  updateBadge();
  if (R.failed) showLoadError();
}
function showLoadError() {
  ['#main', '#detail'].forEach((sel) => {
    const list = document.querySelectorAll(`${sel} .skeleton`);
    if (!list.length) return;
    list.forEach((el, i) => { if (i) el.remove(); });
    list[0].outerHTML = '<div class="banner">Não consegui carregar agora. Vou tentar de novo sozinho.</div>';
  });
}
function tickFresh() {
  const el = $('#fresh');
  if (el) { el.className = 'fresh ' + (R.failed ? 'bad' : ''); el.querySelector('span').textContent = freshText(); main().dataset.h = main().dataset.h; }
}

// ---------- Acoes ----------
const ACTIONS = {
  spoiler() { S.spoiler = !S.spoiler; R.reveal.clear(); save(); syncPrefs(); toast(S.spoiler ? 'Modo sem spoiler ligado' : 'Placares visíveis'); rerender(); },
  filter(el) { S.filter = el.dataset.v; save(); rerender(); },
  jumpday(el) { const t = document.getElementById('d-' + el.dataset.v); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  exsport(el) {
    R.exLive = Number(el.dataset.v);
    document.querySelectorAll('[data-act="exsport"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
    const box = $('#ex-live'); box.innerHTML = '<div class="skeleton"></div>'; delete box.dataset.h;
    loadExLive().catch(() => { box.innerHTML = '<div class="banner">Não consegui carregar os jogos ao vivo.</div>'; });
  },
  follow(el) {
    const id = Number(el.dataset.id);
    const c = R.known[id] || S.teams.find((t) => t.id === id);
    if (!c) return;
    toggleTeam(c);
    const on = isTeam(id);
    if (R.mainRoute === '#/ajustes') main().innerHTML = renderAjustes(), loadRoboStatus();
    else if (el.closest('#ex-results')) { el.classList.toggle('on', on); el.textContent = on ? 'Seguindo' : 'Seguir'; el.setAttribute('aria-pressed', on); }
    else rerender();
    toast(on ? `Seguindo ${c.name}` : `Deixou de seguir ${c.name}`);
  },
  followcomp(el) {
    const id = Number(el.dataset.id);
    const c = S.comps.find((x) => x.id === id) || (R.league && R.league.comp) || LEAGUES.find((l) => l.id === id);
    if (!c) return;
    toggleComp(c);
    if (R.mainRoute === '#/ajustes') main().innerHTML = renderAjustes(), loadRoboStatus(); else rerender();
  },
  mute(el) {
    const id = Number(el.dataset.id);
    S.mute = isMuted(id) ? S.mute.filter((x) => x !== id) : [...S.mute, id];
    save(); syncPrefs();
    if (R.mainRoute === '#/ajustes') main().innerHTML = renderAjustes(), loadRoboStatus(); else rerender();
    toast(isMuted(id) ? 'Avisos desligados para este' : 'Avisos ligados para este');
  },
  driver(el) {
    const v = el.dataset.v;
    S.f1.drivers = S.f1.drivers.includes(v) ? S.f1.drivers.filter((x) => x !== v) : [...S.f1.drivers, v];
    save(); syncPrefs();
    if (!$('#onboarding').hidden) { const b = $('#obf1'); if (b) b.innerHTML = `<div class="sec"><h2>Pilotos para destacar (opcional)</h2></div>${f1Drivers()}`; }
    else rerender();
  },
  f1toggle() { S.f1.on = !S.f1.on; save(); syncPrefs(); rerender(); },
  f1tab(el) { R.f1Tab = el.dataset.v; rerender(); },
  f1sess(el) { R.f1Session = el.dataset.v; rerender(); },
  revealleague(el) { R.reveal.add('l' + el.dataset.v); rerender(); },
  revealf1(el) { R.reveal.add('f1' + el.dataset.v); rerender(); },
  reveal(el) { R.reveal.add(Number(el.dataset.id)); rerender(); },
  gtab(el) { R.gameTab[Number(el.dataset.id)] = el.dataset.v; renderDetail(); poll(true); },
  close() { location.hash = R.mainRoute; },
  back() { if (R.nav > 1) history.back(); else location.hash = '#/agora'; },
  async pushon() {
    const pinEl = $('#pin');
    const pin = pinEl ? pinEl.value.trim() : '';
    if (!S.device && !/^\d{6}$/.test(pin)) { toast('Digite os 6 dígitos do PIN'); return; }
    try {
      await enablePush(pin);
      toast('Avisos ligados');
      refreshPushPanelViews();
    } catch (e) { toast(e.message || 'Não consegui ligar os avisos'); refreshPushPanelViews(); }
  },
  async pushtest(el) {
    el.disabled = true;
    try {
      const r = await roboPost({ a: 'test', id: S.device.id, secret: S.device.secret });
      toast(r.ok ? 'Enviado. Deve chegar em segundos.' : (r.error || 'Falhou'));
    } catch (_) { toast('Não consegui falar com o robô'); }
    el.disabled = false;
  },
  async pushoff() {
    try {
      await roboPost({ a: 'unsubscribe', id: S.device.id, secret: S.device.secret });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (_) { toast('Não consegui desligar agora. Tente de novo com internet.'); return; }
    S.device = null; save();
    refreshPushPanelViews();
  },
  reonboard() { OB.step = 0; OB.force = true; renderOnboarding(); },
  obteam(el) {
    const id = Number(el.dataset.id);
    const c = R.known[id] || TENNIS_TOP.find((t) => t.id === id) || (OB.results || []).find((t) => t.id === id);
    if (!c) return;
    toggleTeam(c);
    document.querySelectorAll(`[data-act="obteam"][data-id="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', isTeam(id)));
  },
  obcomp(el) {
    const id = Number(el.dataset.id);
    toggleComp(LEAGUES.find((l) => l.id === id));
    el.setAttribute('aria-pressed', isComp(id));
  },
  obnext() {
    const box = $('#onboarding');
    if (OB.step < 3) { OB.step++; renderOnboarding(); box.scrollTop = 0; return; }
    S.onboarded = true; save();
    OB.step = 0; OB.force = false;
    box.hidden = true;
    R.home = null;
    if (location.hash === '#/ajustes') main().innerHTML = renderAjustes();
    route();
  }
};
function refreshPushPanelViews() {
  if (!$('#onboarding').hidden) renderOnboarding();
  else if (R.mainRoute === '#/ajustes') { main().innerHTML = renderAjustes(); loadRoboStatus(); }
}
function rerender() {
  renderMainView();
  renderDetail();
  poll(true);
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  const act = el.dataset && el.dataset.act;
  if (!act) return;
  if (act === 'rule') { S.rules[el.dataset.v] = el.checked; }
  else if (act === 'f1switch') {
    S.f1.on = el.checked; R.home = null;
    if (!$('#onboarding').hidden) renderOnboarding();
  } else if (act === 'spoilersw') { S.spoiler = el.checked; R.reveal.clear(); }
  else if (act === 'quiet') { S.quiet.on = el.checked; main().innerHTML = renderAjustes(); loadRoboStatus(); }
  else if (act === 'quietfrom') { S.quiet.from = Number(el.value); }
  else if (act === 'quietto') { S.quiet.to = Number(el.value); }
  else return;
  save(); syncPrefs();
});
// Dica do grafico: toque no celular, mouse ou teclado no PC.
function showTip(g) {
  const t = $('#pulse-tip');
  if (t && g && g.dataset.tip) t.textContent = g.dataset.tip;
}
document.addEventListener('pointerover', (e) => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) showTip(g); });
document.addEventListener('click', (e) => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) showTip(g); });
document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) showTip(g); });
// Logo que falha vira iniciais.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset.mono) {
    const d = document.createElement('span');
    d.className = 'mono'; d.textContent = t.dataset.mono; d.setAttribute('aria-hidden', 'true');
    t.replaceWith(d);
  }
}, true);

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { poll(true); keepPushAlive(); checkRobo(); } });
window.addEventListener('online', () => poll(true));
setInterval(() => poll(false), POLL_MS);
setInterval(tickFresh, 1000);

// ---------- Inicio ----------
(function boot() {
  const snap = safeParse(localStorage.getItem('tribuna.snap'));
  if (snap.games && snap.games.length) { R.home = { games: snap.games, at: snap.at }; R.lastOk = snap.at; }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'open') location.hash = e.data.hash;
    });
  }
  if (!S.onboarded) renderOnboarding();
  route();
  keepPushAlive();
  checkRobo();
})();
