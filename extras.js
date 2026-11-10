'use strict';
/* Funcoes novas (10/11/2026): jogos por dia, pre-jogo e artilharia.
   Carrega ANTES do app.js e so define funcoes: R, S, api, gameCard etc. do app.js sao usados na hora da chamada.
   Fonte unica: 365Scores, sem reserva. Falha some com a secao ou deixa uma nota discreta. */

// ---------- Jogos por dia: #/dia/AAAA-MM-DD[/3] ----------
const DIA_LOTE = 25; // campeonatos "outros" por vez
function diaIso(t) { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
function diaDeIso(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
function diaSoma(base, n) { const d = new Date(base); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
function rotaDia(n, sport) { return `#/dia/${diaIso(diaSoma(Date.now(), n))}${sport === 3 ? '/3' : ''}`; }
function diaAtual() {
  const p = R.mainRoute.replace(/^#\//, '').split('/');
  const iso = diaDeIso(p[1]) ? p[1] : diaIso(Date.now());
  return { iso, sport: p[2] === '3' ? 3 : 1, k: iso + ':' + (p[2] === '3' ? 3 : 1) };
}
function diaRotulo(iso) {
  const hoje = diaIso(Date.now());
  if (iso === hoje) return 'Hoje';
  if (iso === diaIso(diaSoma(Date.now(), 1))) return 'Amanhã';
  if (iso === diaIso(diaSoma(Date.now(), -1))) return 'Ontem';
  return diaDeIso(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}
// Cache: dia passado ou futuro 10 min; hoje 5 min, ou 1 min com jogo rolando (placar ao vivo velho engana).
async function loadDia() {
  const { iso, sport, k } = diaAtual();
  R.dias = R.dias || {};
  const c = R.dias[k];
  const hoje = iso === diaIso(Date.now());
  const vivo = c && c.v && c.v.games.some((g) => g.statusGroup === 3);
  const ttl = !c ? 0 : c.erro ? 6e4 : hoje ? (vivo ? 6e4 : 5 * 6e4) : 10 * 6e4;
  if (c && Date.now() - c.at < ttl) return;
  if (!campsDosTimes().length || meusCampsSalvos().c.key !== meusCampsSalvos().key) await loadMeusCamps().catch(() => {});
  const d0 = diaDeIso(iso), dd = diaApi(d0);
  try {
    const d = await api(`/games/allscores/?sports=${sport}&startDate=${dd}&endDate=${dd}&showOdds=false`);
    if (!Array.isArray(d.games)) throw new Error('resposta sem jogos');
    remember(d.competitors);
    const compOf = {}; (d.competitions || []).forEach((x) => { compOf[x.id] = x; });
    const pais = {}; (d.countries || []).forEach((x) => { pais[x.id] = x.name; });
    const games = d.games.filter((g) => g.sportId === sport && dayKey(g.startTime) === dayKey(d0));
    R.dias[k] = { at: Date.now(), v: { compOf, pais, games } };
    R.lastOk = Date.now(); R.failed = false;
  } catch (e) {
    console.warn('jogos do dia', e);
    R.dias[k] = { at: Date.now(), v: c ? c.v : null, erro: true };
  }
  // Nao acumula dias antigos na memoria.
  Object.keys(R.dias).forEach((x) => { if (x !== k && Date.now() - R.dias[x].at > 30 * 6e4) delete R.dias[x]; });
}
function atalhoDias(sport) {
  return `<nav class="dia-atalho" aria-label="Jogos de todos os campeonatos por dia"><span class="t2">Todos os jogos</span>
    <a class="chip" href="${rotaDia(-1, sport)}">Ontem</a><a class="chip" href="${rotaDia(0, sport)}">Hoje</a><a class="chip" href="${rotaDia(1, sport)}">Amanhã</a></nav>`;
}
function renderDia() {
  const { iso, sport, k } = diaAtual();
  const d0 = diaDeIso(iso), hojeIso = diaIso(Date.now());
  const suf = sport === 3 ? '/3' : '';
  const chip = (s, t) => `<button class="chip" data-nv="diasport" data-v="${s}" aria-pressed="${sport === s}">${t}</button>`;
  let strip = '';
  for (let i = -2; i <= 2; i++) {
    const d = diaSoma(d0, i), di = diaIso(d), sel = di === iso;
    const longo = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    strip += `<a class="day-pill dia-pill${sel ? ' sel' : ''}${di === hojeIso ? ' today' : ''}" href="#/dia/${di}${suf}" data-nv="diair"${sel ? ' aria-current="date"' : ''} aria-label="${esc(longo)}"><span>${esc(diaRotulo(di))}</span><b class="tn">${d.getDate()}</b><span class="mes">${esc(d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''))}</span></a>`;
  }
  strip += `<label class="day-pill dia-escolher">${ICONS.cal}<span>Data</span><input type="date" data-nv="diadata" value="${esc(iso)}" aria-label="Escolher uma data"></label>`;
  const titulo = d0.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const head = `<header class="top" style="justify-content:flex-start">${backBtn()}<h1 style="flex:1;font-size:24px">Jogos do dia</h1>${freshHtml()}</header>
    <div class="chips" role="group" aria-label="Esporte">${chip(1, 'Futebol')}${chip(3, 'Tênis')}</div>
    <div class="dia-strip">${strip}</div>`;
  const c = R.dias && R.dias[k];
  if (!c) return head + '<div class="skeleton"></div><div class="skeleton"></div>';
  if (!c.v) return head + '<div class="empty"><b>Não consegui carregar os jogos deste dia</b>Tento de novo sozinho em instantes.</div>';
  const A = c.v;
  const nota = c.erro ? '<p class="dia-nota">A fonte não respondeu agora. Mostrando a última leitura.</p>' : '';
  const por = (a, b) => new Date(a.startTime) - new Date(b.startTime);
  const seus = A.games.filter(gameIsMine).sort((a, b) => (gameIsFav(b) - gameIsFav(a)) || por(a, b));
  const ja = new Set(seus.map((g) => g.id));
  const grupos = {};
  A.games.forEach((g) => { if (ja.has(g.id)) return; const x = g.competitionId || g.competitionDisplayName; (grupos[x] = grupos[x] || []).push(g); });
  const meus = campsDosTimes();
  const chaves = Object.keys(grupos);
  const destaque = chaves.filter((x) => meus.includes(Number(x))).sort((a, b) => meus.indexOf(Number(a)) - meus.indexOf(Number(b)));
  const pop = (x) => (A.compOf[x] && A.compOf[x].popularityRank) || 0;
  const outros = chaves.filter((x) => !destaque.includes(x)).sort((a, b) => pop(b) - pop(a));
  R.diaMais = R.diaMais || {};
  const lim = R.diaMais[k] || DIA_LOTE;
  const bloco = (x) => {
    const cp = A.compOf[x] || { id: x, name: grupos[x][0].competitionDisplayName || x };
    const pais = A.pais[cp.countryId];
    const nome = `${esc(cp.name)}${pais && !String(cp.name).includes(pais) ? ` <small>${esc(pais)}</small>` : ''}`;
    const jogos = grupos[x].slice().sort(por);
    return `<div class="sec av-camp"><h2>${Number(x) ? `<a href="#/liga/${Number(x)}">${leagueImg(cp)}${nome}</a>` : nome}</h2><span class="muted">${jogos.length}</span></div><div class="stack">${jogos.map((g) => gameCard(g)).join('')}</div>`;
  };
  const total = A.games.length;
  if (!total) return `${head}${nota}<p class="hero dia-titulo">${esc(titulo)}</p><div class="empty"><b>Nenhum jogo neste dia</b>A fonte não tem ${sport === 3 ? 'partidas de tênis' : 'jogos de futebol'} marcados para esta data.</div>`;
  const vivos = A.games.filter((g) => g.statusGroup === 3).length;
  const resumo = `${total} ${total === 1 ? 'jogo' : 'jogos'}${vivos ? `, ${vivos} ao vivo` : ''}${seus.length ? `, ${seus.length} ${seus.length === 1 ? 'seu' : 'seus'}` : ''}`;
  const resto = outros.length - lim;
  return `${head}${nota}<p class="hero dia-titulo"><b>${esc(titulo[0].toUpperCase() + titulo.slice(1))}</b> · ${resumo}</p>
    ${seus.length ? `<div class="sec"><h2>Seus jogos</h2></div><div class="stack">${seus.map((g) => gameCard(g)).join('')}</div>` : ''}
    ${destaque.length ? `<div class="subhead">Campeonatos dos seus times</div>${destaque.map(bloco).join('')}` : ''}
    ${outros.length ? `<div class="subhead">${destaque.length || seus.length ? 'Outros campeonatos' : 'Campeonatos'}</div>${outros.slice(0, lim).map(bloco).join('')}` : ''}
    ${resto > 0 ? `<button class="btn dia-mais" data-nv="diamais">Mostrar mais ${Math.min(resto, DIA_LOTE)} campeonatos (faltam ${resto})</button>` : ''}`;
}

// ---------- Pre-jogo: confronto direto, forma recente e agregado ----------
// /games/h2h/?gameId= traz h2hGames e recentGames de cada lado (mesmo com hasPreviousMeetings false). Cache 10 min.
function jogoValido(g) {
  return g && g.statusGroup === 4 && Number(g.homeCompetitor && g.homeCompetitor.score) >= 0 && Number(g.awayCompetitor && g.awayCompetitor.score) >= 0
    && !/adiad|cancel|abandon|suspens|postpon|w\.?o\b/i.test(`${g.statusText || ''} ${g.shortStatusText || ''}`);
}
async function loadPreJogo(g) {
  if (!g || g.statusGroup !== 2 || g.id >= 7e8) return;
  R.preJogo = R.preJogo || {};
  const c = R.preJogo[g.id];
  if (c && Date.now() - c.at < (c.v ? 10 : 5) * 6e4) return;
  try {
    const d = await api(`/games/h2h/?gameId=${g.id}`);
    const x = d.game || {};
    const desc = (a, b) => new Date(b.startTime) - new Date(a.startTime);
    const lista = (t) => ((t && t.recentGames) || []).filter(jogoValido).sort(desc).slice(0, 5);
    R.preJogo[g.id] = { at: Date.now(), v: { h2h: (x.h2hGames || []).filter(jogoValido).sort(desc).slice(0, 10), rh: lista(x.homeCompetitor), ra: lista(x.awayCompetitor) } };
  } catch (e) {
    console.warn('pre-jogo', e);
    R.preJogo[g.id] = { at: Date.now(), v: c ? c.v : null };
  }
}
function golsDe(j, id) {
  if (j.homeCompetitor.id === id) return num(j.homeCompetitor.score);
  if (j.awayCompetitor.id === id) return num(j.awayCompetitor.score);
  return null;
}
function formaPills(id, lista) {
  return lista.map((j) => {
    const eu = golsDe(j, id), ele = j.homeCompetitor.id === id ? num(j.awayCompetitor.score) : num(j.homeCompetitor.score);
    const rival = j.homeCompetitor.id === id ? j.awayCompetitor : j.homeCompetitor;
    const k = eu > ele ? 'v' : eu < ele ? 'd' : 'e';
    const txt = { v: 'Vitória', e: 'Empate', d: 'Derrota' }[k];
    return `<a class="fm ${k}" href="#/jogo/${Number(j.id)}" title="${txt} ${eu}x${ele} contra ${esc(rival.shortName || rival.name)}"><span aria-hidden="true">${k.toUpperCase()}</span><span class="vh">${txt} ${eu} a ${ele} contra ${esc(rival.name)}</span></a>`;
  }).reverse().join('');
}
function agregadoHtml(g) {
  if (!(g.legNum >= 2)) return '';
  const ida = (g.relatedGames || []).filter((r) => r.legNum < g.legNum && jogoValido(r)).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  if (!ida.length) return '';
  const h = g.homeCompetitor, a = g.awayCompetitor;
  const soma = (id) => ida.reduce((t, j) => t + (golsDe(j, id) || 0), 0);
  if (ida.some((j) => golsDe(j, h.id) == null || golsDe(j, a.id) == null)) return '';
  const gh = soma(h.id), ga = soma(a.id);
  const j1 = ida[ida.length - 1];
  const linhaIda = `${esc(j1.homeCompetitor.shortName || j1.homeCompetitor.name)} ${num(j1.homeCompetitor.score)} x ${num(j1.awayCompetitor.score)} ${esc(j1.awayCompetitor.shortName || j1.awayCompetitor.name)}`;
  const quem = gh === ga ? 'Confronto empatado' : `${esc((gh > ga ? h : a).shortName || (gh > ga ? h : a).name)} leva vantagem`;
  return `<section class="pj-card pj-agr"><h3>Jogo de volta${g.stageName ? ` · ${esc(g.stageName)}` : ''}</h3>
    <div class="pj-agr-placar"><span>${esc(h.shortName || h.name)}</span><b class="tn">${gh} - ${ga}</b><span>${esc(a.shortName || a.name)}</span></div>
    <p class="t2">Agregado. ${quem}.</p>
    <a class="pj-ida" href="#/jogo/${Number(j1.id)}"><span class="t2">Ida, ${esc(new Date(j1.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}</span><span class="tn">${linhaIda}</span><span class="av-seta" aria-hidden="true">›</span></a></section>`;
}
function preJogoHtml(g) {
  if (!g || g.statusGroup !== 2) return '';
  const agr = agregadoHtml(g);
  const c = R.preJogo && R.preJogo[g.id];
  const v = c && c.v;
  if (!v) return agr ? `<div class="pj">${agr}</div>` : '';
  const h = g.homeCompetitor, a = g.awayCompetitor, tenis = g.sportId === 3;
  const nm = (t) => esc(t.shortName || t.name);
  const forma = [[h, v.rh], [a, v.ra]].filter(([, l]) => l.length).map(([t, l]) => `<div class="pj-forma-l">
      <div class="pj-time">${crest(t)}<span>${nm(t)}</span><small class="t2">últimos ${l.length}</small></div>
      <div class="forma">${formaPills(t.id, l)}</div></div>`).join('');
  let h2h = '';
  const lista = v.h2h.filter((j) => golsDe(j, h.id) != null && golsDe(j, a.id) != null);
  if (lista.length) {
    let vh = 0, va = 0, em = 0;
    lista.forEach((j) => { const x = golsDe(j, h.id), y = golsDe(j, a.id); if (x > y) vh++; else if (y > x) va++; else em++; });
    const cel = (n, t) => `<div><b class="tn">${n}</b><small>${t}</small></div>`;
    const linhas = lista.slice(0, 5).map((j) => {
      const jh = j.homeCompetitor, ja = j.awayCompetitor;
      const x = num(jh.score), y = num(ja.score);
      const data = new Date(j.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const comp = String(j.competitionDisplayName || '');
      return `<a class="pj-jogo" href="#/jogo/${Number(j.id)}"><span class="pj-data"><span class="tn">${esc(data)}</span>${comp ? ` · ${esc(comp)}` : ''}</span>
        <span class="pj-res"><span class="${x > y ? 'w' : ''}">${nm(jh)}</span><b class="tn">${x} - ${y}</b><span class="${y > x ? 'w' : ''}">${nm(ja)}</span></span></a>`;
    }).join('');
    h2h = `<section class="pj-card"><h3>Confronto direto</h3><p class="t2 pj-sub">Últimos ${lista.length} ${lista.length === 1 ? 'jogo' : 'jogos'} entre os dois</p>
      <div class="pj-placar ${tenis ? 'sem-emp' : ''}">${cel(vh, `${vh === 1 ? 'vitória' : 'vitórias'} ${nm(h)}`)}${tenis ? '' : cel(em, em === 1 ? 'empate' : 'empates')}${cel(va, `${va === 1 ? 'vitória' : 'vitórias'} ${nm(a)}`)}</div>
      <div class="pj-lista">${linhas}</div></section>`;
  }
  const fm = forma ? `<section class="pj-card"><h3>Forma recente</h3>${forma}</section>` : '';
  return agr || h2h || fm ? `<div class="pj">${agr}${fm}${h2h}</div>` : '';
}

// ---------- Artilharia do campeonato ----------
// /stats/?competitions= traz stats.athletesStats.tables: id 1 = Gols (2o valor: penaltis), id 3 = Assistencias. Cache 10 min.
async function loadArtilharia(id) {
  R.artilharia = R.artilharia || {};
  const c = R.artilharia[id];
  if (c && Date.now() - c.at < (c.falhou ? 5 : c.v ? 10 : 30) * 6e4) return c.v;
  if (Date.now() < R.primaryDownUntil) return c ? c.v : null;
  try {
    const d = await api(`/stats/?competitions=${id}`);
    remember(d.competitors);
    R.artilharia[id] = { at: Date.now(), v: artilhariaDe(d) };
  } catch (e) {
    console.warn('artilharia', e);
    R.artilharia[id] = { at: Date.now(), v: c ? c.v : null, falhou: true };
  }
  return R.artilharia[id].v;
}
function artilhariaDe(d) {
  const tabs = (((d && d.stats) || {}).athletesStats || {}).tables || [];
  const times = {}; ((d && d.competitors) || []).forEach((t) => { times[t.id] = t; });
  const linhas = (t) => ((t && t.rows) || []).map((r) => {
    const e = r.entity || {}, st = r.stats || [];
    return { id: e.id, nome: e.name, curto: e.shortName || e.name, iv: e.imageVersion, time: times[e.competitorId] || { id: e.competitorId, name: '' },
      valor: Number(st[0] && st[0].value), pen: t.id === 1 && st[1] ? Number(st[1].value) : 0 };
  }).filter((x) => x.id && Number.isFinite(x.valor) && x.valor > 0);
  const gols = linhas(tabs.find((t) => t.id === 1 && /gol/i.test(t.name || '')));
  const assist = linhas(tabs.find((t) => t.id === 3 && /assist/i.test(t.name || '')));
  return gols.length ? { gols, assist } : null;
}
function temArtilharia(id) { return !!(R.artilharia && R.artilharia[id] && R.artilharia[id].v); }
function renderArtilharia(id) {
  const A = R.artilharia && R.artilharia[id] && R.artilharia[id].v;
  if (!A) return '<div class="empty">Artilharia indisponível agora.</div>';
  if (S.spoiler && !R.reveal.has('l' + id)) return `<div style="height:14px"></div><button class="btn" data-act="revealleague" data-v="${id}">Mostrar artilharia</button>`;
  R.artTipo = R.artTipo || {};
  const tipo = A.assist.length && R.artTipo[id] === 'a' ? 'a' : 'g';
  const lista = tipo === 'a' ? A.assist : A.gols;
  const meus = S.teams.map((t) => t.id);
  const chips = A.assist.length ? `<div class="chips art-chips" role="group" aria-label="Ranking"><button class="chip" data-nv="arttipo" data-id="${id}" data-v="g" aria-pressed="${tipo === 'g'}">Gols</button><button class="chip" data-nv="arttipo" data-id="${id}" data-v="a" aria-pressed="${tipo === 'a'}">Assistências</button></div>` : '';
  const linhas = lista.map((x) => {
    const pos = 1 + lista.filter((y) => y.valor > x.valor).length;
    const t = x.time;
    const tm = t.id ? `${crest({ id: t.id, imageVersion: t.imageVersion, name: t.name, color: t.color })}<span>${esc(t.shortName || t.name || '')}</span>` : '';
    const dentro = `<span class="pos tn">${pos}º</span>
      <img class="foto" loading="lazy" alt="" width="40" height="40" data-mono="${esc(initials(x.nome))}" src="${esc(imgUrl('Athletes', x.id, x.iv, 64))}">
      <span class="nm"><b>${esc(x.nome)}</b><small>${tm}</small></span>
      <span class="val tn">${x.valor}${tipo === 'g' && x.pen > 0 ? `<small>${x.pen} pên.</small>` : ''}<span class="vh"> ${tipo === 'g' ? (x.valor === 1 ? 'gol' : 'gols') : (x.valor === 1 ? 'assistência' : 'assistências')}</span></span>`;
    return t.id ? `<a class="art-l${meus.includes(t.id) ? ' me' : ''}" href="#/time/${Number(t.id)}">${dentro}</a>` : `<div class="art-l">${dentro}</div>`;
  }).join('');
  return `<div style="height:8px"></div>${chips}<div class="art-lista">${linhas}</div><p class="art-nota">Os ${lista.length} primeiros, segundo o 365Scores.</p>`;
}

// ---------- Toques e escolha de data ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-nv]');
  if (!el) return;
  const a = el.dataset.nv;
  if (a === 'diadata') { try { if (el.showPicker) el.showPicker(); } catch (_) {} return; }
  e.preventDefault();
  const { iso, k } = diaAtual();
  if (a === 'diasport') location.replace(`#/dia/${iso}${el.dataset.v === '3' ? '/3' : ''}`);
  else if (a === 'diair') location.replace(el.getAttribute('href'));
  else if (a === 'diamais') { R.diaMais = R.diaMais || {}; R.diaMais[k] = (R.diaMais[k] || DIA_LOTE) + DIA_LOTE; renderMainView(); }
  else if (a === 'arttipo') { R.artTipo = { ...(R.artTipo || {}), [Number(el.dataset.id)]: el.dataset.v }; R.animar = true; renderMainView(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el || !el.dataset || el.dataset.nv !== 'diadata' || !diaDeIso(el.value)) return;
  location.replace(`#/dia/${el.value}${diaAtual().sport === 3 ? '/3' : ''}`);
});
