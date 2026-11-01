'use strict';
/* Fontes reservas: convertem FotMob e ESPN para o formato que o app ja usa do 365Scores. */
window.Fontes = (function () {
  const FM = 'https://www.fotmob.com/api/data';
  const EW = 'https://site.web.api.espn.com/apis';
  const TZ = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo');
  // Campeonato do 365Scores -> codigo nas outras fontes.
  const LIGAS_FM = { 268: 113, 8814: 116, 9067: 115, 45: 102, 299: 389, 42: 572, 47: 7, 87: 11, 55: 17, 54: 25, 53: 35, 77: 5930 };
  const LIGAS_ESPN = { 113: 'bra.1', 116: 'bra.2', 115: 'bra.copa_do_brazil', 102: 'conmebol.libertadores', 389: 'conmebol.sudamericana', 572: 'uefa.champions', 7: 'eng.1', 11: 'esp.1', 17: 'ita.1', 25: 'ger.1', 35: 'fra.1', 5930: 'fifa.world' };
  const SESSOES_ESPN = { FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3', Qual: 'Qualifying', Race: 'Race', Sprint: 'Sprint', SR: 'Sprint', SQ: 'Sprint Qualifying', SS: 'Sprint Qualifying' };
  const STOP = new Set(['fc', 'cf', 'cd', 'club', 'clube', 'de', 'del', 'la', 'el', 'sc', 'ac', 'ca', 'afc', 'atletico', 'athletico', 'deportivo', 'real', 'sport', 'sporting', 'esporte', 'do', 'da', 'if', 'sv', 'bk', 'fk', 'ad', 'cs', 'ec', 'se', 'cr', 'rb', 'united', 'city']);
  const APELIDOS = { mg: 'mineiro', pr: 'paranaense', go: 'goianiense', sp: 'paulista', rj: 'carioca', psg: 'germain' };
  const porId = {};

  async function json(url, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 12000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  function tokens(s) {
    const clean = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const todos = clean.split(/\s+/).map((t) => APELIDOS[t] || t).filter((t) => t.length > 2);
    const fortes = todos.filter((t) => !STOP.has(t));
    // "Sporting CP" so tem palavra comum: usa o que houver.
    return fortes.length ? fortes : todos;
  }
  function mesmoNome(a, b) {
    const x = tokens(a), y = tokens(b);
    return x.length > 0 && x.some((t) => y.includes(t));
  }
  // Feminino, reserva e base sao outro time, mesmo com o nome parecido.
  function categoria(nome, liga) {
    const t = `${nome || ''} ${liga || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const c = [];
    if (/\(f\)|\bwomen|\bfemin|\bw\b/.test(t)) c.push('f');
    if (/\b(ii|iii|reserve|reserves|reservas|b team)\b/.test(String(nome || '').toLowerCase())) c.push('r');
    const base = t.match(/\b(?:sub|u)[ -]?(\d{2})\b/);
    if (base) c.push('u' + base[1]);
    else if (/youth|primavera/.test(t)) c.push('base');
    return c.join(',');
  }
  // Na duvida, nao casa: placar de outro jogo geraria aviso falso.
  function mesmoJogo(a, k) {
    if ((a.sportId || 1) !== (k.sportId || 1)) return false;
    if (Math.abs(new Date(a.startTime) - new Date(k.startTime)) > 3 * 36e5) return false;
    if (a.sportId !== 3) {
      const ca = categoria(a.homeCompetitor.name, a.competitionDisplayName);
      const ck = categoria(k.homeCompetitor.name, k.competitionDisplayName);
      if (ca !== ck) return false;
    }
    return mesmoNome(a.homeCompetitor.name, k.homeCompetitor.name) && mesmoNome(a.awayCompetitor.name, k.awayCompetitor.name);
  }
  function lado(c, score, logo) {
    return { id: 0, name: c.name, shortName: c.shortName || '', score, isWinner: false, logo, color: '' };
  }
  function diaLocal(deslocamento) {
    const d = new Date(Date.now() + (deslocamento || 0) * 864e5);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------- FotMob ----------
  function jogoFotmob(m, liga) {
    const st = m.status || {};
    const grupo = st.finished || st.cancelled || st.awarded ? 4 : st.started ? 3 : 2;
    const curto = String((st.liveTime && st.liveTime.short) || '').replace(/[^\dA-Za-z+]/g, '');
    const intervalo = /^HT$/i.test(curto);
    const logo = (id) => `https://images.fotmob.com/image_resources/logo/teamlogo/${Number(id)}_small.png`;
    const hs = st.started ? Number(m.home.score) || 0 : -1, as = st.started ? Number(m.away.score) || 0 : -1;
    const longo = String((st.liveTime && st.liveTime.long) || '').match(/^(\d+):(\d{2})/);
    const g = {
      id: 900000000 + (Number(m.id) % 90000000), _fmId: m.id, _fonte: 'FotMob', sportId: 1,
      competitionId: LIGAS_FM[liga.primaryId], competitionDisplayName: liga.name,
      startTime: st.utcTime, statusGroup: grupo,
      statusText: st.cancelled ? 'Cancelado' : grupo === 4 ? 'Fim' : grupo === 2 ? 'Programação' : intervalo ? 'Intervalo' : 'Ao vivo',
      shortStatusText: st.cancelled ? 'Canc.' : grupo === 4 ? 'Fim' : '',
      gameTime: parseInt(curto, 10) || -1,
      gameTimeDisplay: grupo === 3 && !intervalo && /^\d/.test(curto) ? `${curto}'` : '',
      stages: [],
      preciseGameTime: grupo === 3 && longo ? { minutes: Number(longo[1]), seconds: Number(longo[2]), autoProgress: !intervalo, clockDirection: 1 } : null,
      homeCompetitor: lado(m.home, hs, logo(m.home.id)), awayCompetitor: lado(m.away, as, logo(m.away.id))
    };
    if (grupo === 4 && hs !== as) { g.homeCompetitor.isWinner = hs > as; g.awayCompetitor.isWinner = as > hs; }
    return g;
  }
  async function futebolFotmob() {
    const dias = [diaLocal(0)];
    if (new Date().getHours() < 5) dias.push(diaLocal(-1));
    const ler = async (d) => {
      const url = `${FM}/matches?date=${d}&timezone=${TZ}&ccode3=BRA`;
      // Falha pontual nao troca de fonte: tenta mais uma vez antes.
      try { return await json(url, 20000); } catch (_) {
        await new Promise((r) => setTimeout(r, 1200));
        return json(url, 20000);
      }
    };
    const res = await Promise.all(dias.map(ler));
    const out = [];
    const vistos = new Set();
    // A FotMob repete o mesmo jogo em mais de uma lista.
    res.forEach((r) => (r.leagues || []).forEach((l) => (l.matches || []).forEach((m) => {
      if (vistos.has(m.id)) return;
      vistos.add(m.id);
      out.push(jogoFotmob(m, l));
    })));
    if (!out.length) throw new Error('FotMob sem jogos');
    return out;
  }

  // ---------- ESPN ----------
  function grupoEspn(s) { return s === 'in' ? 3 : s === 'post' ? 4 : 2; }
  function jogoEspnFutebol(e) {
    const c = e.competitions[0];
    const h = c.competitors.find((x) => x.homeAway === 'home'), a = c.competitors.find((x) => x.homeAway === 'away');
    const st = e.status || c.status, grupo = grupoEspn(st.type.state);
    const t = (x) => lado({ name: x.team.displayName, shortName: x.team.shortDisplayName }, grupo === 2 ? -1 : Number(x.score) || 0, x.team.logo);
    const g = {
      id: 800000000 + (Number(e.id) % 90000000), _espnId: e.id, _fonte: 'ESPN', sportId: 1,
      competitionDisplayName: (e.league && e.league.name) || (c.league && c.league.name) || '', startTime: e.date, statusGroup: grupo,
      statusText: grupo === 4 ? 'Fim' : grupo === 2 ? 'Programação' : /half.?time/i.test(st.type.description || '') ? 'Intervalo' : 'Ao vivo',
      shortStatusText: grupo === 4 ? 'Fim' : '', gameTime: parseInt(st.displayClock, 10) || -1,
      gameTimeDisplay: grupo === 3 && !/half.?time/i.test(st.type.description || '') ? String(st.displayClock || '').replace(/\s/g, '') : '',
      stages: [], homeCompetitor: t(h), awayCompetitor: t(a), _detalhes: c.details || []
    };
    if (grupo === 4) { g.homeCompetitor.isWinner = !!h.winner; g.awayCompetitor.isWinner = !!a.winner; }
    return g;
  }
  async function futebolEspn() {
    const d = await json(`${EW}/site/v2/sports/soccer/all/scoreboard`);
    const out = (d.events || []).map(jogoEspnFutebol);
    if (!out.length) throw new Error('ESPN sem jogos');
    return out;
  }
  function jogoEspnTenis(c, ev) {
    const [x, y] = c.competitors;
    const h = x.homeAway === 'away' ? y : x, a = h === x ? y : x;
    const grupo = grupoEspn(c.status.type.state);
    const ls = (p) => p.linescores || [];
    let sh = 0, sa = 0;
    const n = Math.max(ls(h).length, ls(a).length);
    const stages = [];
    for (let i = 0; i < n; i++) {
      const u = ls(h)[i] || {}, v = ls(a)[i] || {};
      if (u.winner) sh++; else if (v.winner) sa++;
      stages.push({ id: 26 + i, name: `${i + 1}º set`, shortName: `S${i + 1}`, homeCompetitorScore: Number(u.value) || 0, awayCompetitorScore: Number(v.value) || 0, isLive: grupo === 3 && i === n - 1 });
    }
    stages.push({ id: 35, name: 'Sets', shortName: 'Sets', homeCompetitorScore: sh, awayCompetitorScore: sa });
    const nome = (p) => ({ name: (p.athlete && p.athlete.displayName) || (p.team && p.team.displayName) || '', shortName: '' });
    const g = {
      id: 700000000 + (Number(c.id) % 90000000), _fonte: 'ESPN', sportId: 3, competitionDisplayName: ev.name || '', startTime: c.date, statusGroup: grupo,
      statusText: grupo === 4 ? 'Fim' : grupo === 2 ? 'Programação' : `${n || 1}º set`, shortStatusText: grupo === 4 ? 'Fim' : '', gameTime: -1, gameTimeDisplay: '', stages,
      homeCompetitor: lado(nome(h), sh, ''), awayCompetitor: lado(nome(a), sa, '')
    };
    g.homeCompetitor.sportId = 3; g.awayCompetitor.sportId = 3;
    if (grupo === 4) { g.homeCompetitor.isWinner = !!h.winner; g.awayCompetitor.isWinner = !!a.winner; }
    return g;
  }
  async function tenisEspn() {
    const res = await Promise.all(['atp', 'wta'].map((t) => json(`${EW}/site/v2/sports/tennis/${t}/scoreboard`)));
    const out = [];
    res.forEach((r) => (r.events || []).forEach((ev) => (ev.groupings || []).forEach((g) => (g.competitions || []).forEach((c) => {
      if ((c.competitors || []).length === 2) out.push(jogoEspnTenis(c, ev));
    }))));
    return out;
  }

  // Cada esporte tenta suas reservas em ordem. So falha se nada responder.
  async function todos(querTenis) {
    let futebol = [], nome = '', erro = null;
    for (const [fn, n] of [[futebolFotmob, 'FotMob'], [futebolEspn, 'ESPN']]) {
      try { futebol = await fn(); nome = n; erro = null; break; } catch (e) { erro = e; console.warn('reserva', n, e); }
    }
    let tenis = [];
    let tenisOk = false;
    if (querTenis) {
      try { tenis = await tenisEspn(); tenisOk = true; } catch (e) { console.warn('reserva tenis', e); }
    }
    if (erro && !tenisOk) throw erro;
    const jogos = futebol.concat(tenis);
    jogos.forEach((g) => { porId[g.id] = g; });
    return { jogos, fonte: nome || 'ESPN' };
  }

  // Encaixa o placar da reserva no jogo ja conhecido, preservando ids, escudos e o link do jogo.
  function reconciliar(reserva, conhecidos, times) {
    const usados = new Set();
    const saida = reserva.map((a) => {
      const pares = conhecidos.filter((x) => !usados.has(x.id) && mesmoJogo(a, x));
      // Dois candidatos: ambiguo, nao arrisca.
      const k = pares.length === 1 ? pares[0] : null;
      if (pares.length > 1) return a;
      if (!k) {
        [a.homeCompetitor, a.awayCompetitor].forEach((c) => {
          const t = times.find((x) => x.sportId === a.sportId && mesmoNome(x.name, c.name));
          if (t) c.id = t.id;
        });
        return a;
      }
      usados.add(k.id);
      const j = JSON.parse(JSON.stringify(k));
      ['statusGroup', 'statusText', 'shortStatusText', 'gameTime', 'gameTimeDisplay', 'preciseGameTime', '_fmId', '_espnId', '_fonte', '_detalhes'].forEach((f) => { j[f] = a[f]; });
      delete j._congelado;
      j.homeCompetitor.score = a.homeCompetitor.score; j.homeCompetitor.isWinner = a.homeCompetitor.isWinner;
      j.awayCompetitor.score = a.awayCompetitor.score; j.awayCompetitor.isWinner = a.awayCompetitor.isWinner;
      if (a.sportId === 3) j.stages = a.stages;
      porId[j.id] = j;
      return j;
    });
    // O que a reserva nao cobre fica com a ultima leitura, e o jogo ao vivo avisa que parou de atualizar.
    return saida.concat(conhecidos.filter((k) => !usados.has(k.id)).map((k) => {
      if (k.statusGroup !== 3) return k;
      const j = JSON.parse(JSON.stringify(k));
      j._congelado = true;
      return j;
    }));
  }

  // ---------- Detalhe do jogo ----------
  const STATS_PT = { BallPossesion: 'Posse de Bola', expected_goals: 'Gols esperados (xG)', total_shots: 'Total de chutes', ShotsOnTarget: 'Chutes no gol', big_chance: 'Grandes chances', corners: 'Escanteios', fouls: 'Faltas', accurate_passes: 'Passes certos', yellow_cards: 'Cartões amarelos', red_cards: 'Cartões vermelhos', Offsides: 'Impedimentos' };
  function membroFm(p, lista) {
    lista.push({ id: p.id, athleteId: p.id, name: p.name, shortName: p.lastName || p.name, jerseyNumber: p.shirtNumber });
  }
  function escalacaoFm(t, membros) {
    if (!t || !t.starters) return null;
    const m = [];
    t.starters.forEach((p) => {
      membroFm(p, membros);
      const v = p.verticalLayout || {};
      m.push({ id: p.id, status: 1, yardFormation: v.y != null ? { fieldLine: Math.max(0, Math.min(100, ((v.y - 0.1) / 0.8) * 100)), fieldSide: Math.max(0, Math.min(100, v.x * 100)) } : null });
    });
    (t.subs || []).forEach((p) => { membroFm(p, membros); m.push({ id: p.id, status: 2 }); });
    (t.unavailable || []).forEach((p) => { membroFm(p, membros); m.push({ id: p.id, status: 3 }); });
    return { status: 'Confirmado', formation: t.formation || '', members: m };
  }
  async function detalheFotmob(base) {
    const d = await json(`${FM}/matchDetails?matchId=${Number(base._fmId)}`);
    const g = JSON.parse(JSON.stringify(base));
    const membros = [];
    const c = d.content || {};
    const lu = c.lineup || {};
    g.homeCompetitor.lineups = escalacaoFm(lu.homeTeam, membros);
    g.awayCompetitor.lineups = escalacaoFm(lu.awayTeam, membros);
    const evs = (c.matchFacts && c.matchFacts.events && c.matchFacts.events.events) || [];
    const nomeId = (p) => {
      if (!p || !p.name) return 0;
      let m = membros.find((x) => String(x.id) === String(p.id));
      if (!m) { m = { id: p.id, athleteId: p.id, name: p.name, shortName: p.name }; membros.push(m); }
      return m.id;
    };
    const cid = (e) => (e.isHome ? g.homeCompetitor.id : g.awayCompetitor.id);
    const tempo = (e) => `${e.time}${e.overloadTime ? '+' + e.overloadTime : ''}'`;
    g.events = [];
    evs.forEach((e) => {
      const base2 = { competitorId: cid(e), gameTime: e.time, gameTimeDisplay: tempo(e), stageId: 0 };
      if (e.type === 'Goal' && !e.isPenaltyShootoutEvent) {
        g.events.push({ ...base2, playerId: nomeId(e.player), extraPlayers: e.assistPlayerId ? [nomeId({ id: e.assistPlayerId, name: e.assistInput || '' })] : [], eventType: { id: 1, name: 'Gol', subTypeName: e.ownGoal ? 'Gol contra' : e.suffix === 'penalty' ? 'Pênalti' : '' } });
      } else if (e.type === 'Card') {
        const v = /red/i.test(e.card || '');
        g.events.push({ ...base2, playerId: nomeId(e.player), eventType: { id: v ? 3 : 2, name: v ? 'Cartão Vermelho' : 'Cartão Amarelo' } });
      } else if (e.type === 'Substitution' && e.swap && e.swap.length === 2) {
        g.events.push({ ...base2, playerId: nomeId(e.swap[0]), extraPlayers: [nomeId(e.swap[1])], eventType: { id: 1000, name: 'Substitution' } });
      }
    });
    g.members = membros;
    g.hasStandings = !!LIGAS_ESPN[g.competitionId] || !!base.hasStandings;
    g._semLances = !g.events.length && g.statusGroup !== 2;
    let stats = null;
    try {
      const all = c.stats.Periods.All.stats;
      const tops = all.find((x) => x.key === 'top_stats') || all[0];
      const lista = [];
      tops.stats.forEach((s, i) => {
        if (!s.stats || s.type === 'title' || s.stats.length !== 2) return;
        [0, 1].forEach((n) => lista.push({ id: 5000 + i, name: STATS_PT[s.key] || s.title, order: i, isMajor: true, competitorId: n ? g.awayCompetitor.id : g.homeCompetitor.id, value: String(s.stats[n] == null ? '0' : s.stats[n]) }));
      });
      stats = { statistics: lista };
    } catch (_) { /* sem numeros nesta fonte */ }
    return { game: g, stats };
  }
  async function detalheEspn(base) {
    const s = await json(`${EW}/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(base._espnId)}`);
    const g = JSON.parse(JSON.stringify(base));
    const membros = [];
    const rosters = s.rosters || [];
    const roster = (r) => {
      if (!r || !r.roster) return null;
      const m = r.roster.map((p) => {
        const a = p.athlete || {};
        membros.push({ id: a.id, athleteId: a.id, name: a.displayName, shortName: a.lastName || a.shortName || a.displayName, jerseyNumber: p.jersey });
        return { id: a.id, status: p.starter ? 1 : 2 };
      });
      return { status: 'Confirmado', formation: r.formation || '', members: m };
    };
    const ehCasa = (r) => r.homeAway === 'home';
    g.homeCompetitor.lineups = roster(rosters.find(ehCasa));
    g.awayCompetitor.lineups = roster(rosters.find((r) => !ehCasa(r)));
    const timeId = {};
    rosters.forEach((r) => { if (r.team) timeId[r.team.id] = ehCasa(r) ? g.homeCompetitor.id : g.awayCompetitor.id; });
    g.events = (base._detalhes || []).filter((e) => e.scoringPlay || e.redCard || e.yellowCard).map((e) => {
      const a = (e.athletesInvolved && e.athletesInvolved[0]) || {};
      if (a.id && !membros.some((m) => String(m.id) === String(a.id))) membros.push({ id: a.id, athleteId: a.id, name: a.displayName, shortName: a.shortName || a.displayName });
      return { competitorId: timeId[e.team && e.team.id] || 0, gameTimeDisplay: (e.clock && e.clock.displayValue) || '', stageId: 0, playerId: a.id, eventType: e.scoringPlay ? { id: 1, name: 'Gol', subTypeName: e.ownGoal ? 'Gol contra' : e.penaltyKick ? 'Pênalti' : '' } : e.redCard ? { id: 3, name: 'Cartão Vermelho' } : { id: 2, name: 'Cartão Amarelo' } };
    });
    g.members = membros;
    g.hasStandings = !!LIGAS_ESPN[g.competitionId] || !!base.hasStandings;
    return { game: g, stats: null };
  }
  // FotMob, depois ESPN; sem nenhuma, fica o cabecalho com o placar conhecido.
  async function detalhe(base) {
    if (base._fmId) { try { return await detalheFotmob(base); } catch (e) { console.warn('detalhe FotMob', e); } }
    if (base._espnId) { try { return await detalheEspn(base); } catch (e) { console.warn('detalhe ESPN', e); } }
    const g = JSON.parse(JSON.stringify(base));
    g.events = g.events || [];
    g._semLances = g.sportId !== 3 && g.statusGroup !== 2;
    return { game: g, stats: null };
  }

  // ---------- Tabela ----------
  async function tabela(compId) {
    const slug = LIGAS_ESPN[compId];
    if (!slug) throw new Error('sem reserva para este campeonato');
    const d = await json(`${EW}/v2/sports/soccer/${slug}/standings`);
    const blocos = (d.children || []).filter((x) => x.standings && x.standings.entries);
    const rows = [];
    const groups = [];
    blocos.forEach((b, i) => {
      if (blocos.length > 1) groups.push({ num: i + 1, name: b.name });
      b.standings.entries.forEach((e, pos) => {
        const st = (n) => { const x = (e.stats || []).find((y) => y.name === n); return x ? Number(x.value) || 0 : 0; };
        rows.push({
          competitor: { id: 0, name: e.team.displayName, shortName: e.team.shortDisplayName, logo: e.team.logos && e.team.logos[0] && e.team.logos[0].href },
          groupNum: blocos.length > 1 ? i + 1 : 0, position: st('rank') || pos + 1, points: st('points'), gamePlayed: st('gamesPlayed'), gamesWon: st('wins'), gamesEven: st('ties'), gamesLost: st('losses'), ratio: st('pointDifferential')
        });
      });
    });
    if (!rows.length) throw new Error('tabela vazia');
    return { standings: [{ rows, groups }], competitions: [], _fonte: 'ESPN' };
  }

  // ---------- Formula 1 ----------
  async function f1Evento() {
    const d = await json(`${EW}/site/v2/sports/racing/f1/scoreboard`);
    return (d.events || [])[0];
  }
  async function f1Sessoes() {
    const ev = await f1Evento();
    if (!ev) throw new Error('ESPN sem GP');
    return ev.competitions.map((c) => ({
      session_key: 'e' + c.id, session_name: SESSOES_ESPN[c.type.abbreviation] || c.type.abbreviation, date_start: c.date,
      date_end: new Date(new Date(c.date).getTime() + 2 * 36e5).toISOString(), meeting_key: 'e' + ev.id,
      gp_name: ev.name, country_name: '', location: ev.shortName || ev.name, circuit_short_name: ''
    }));
  }
  async function f1Resultado(data) {
    const ev = await f1Evento();
    const alvo = new Date(data).getTime();
    const s = ev && ev.competitions.find((c) => Math.abs(new Date(c.date) - alvo) < 36e5);
    if (!s || !(s.competitors || []).length) return [];
    return s.competitors.slice().sort((a, b) => (a.order || 99) - (b.order || 99)).map((c, i) => {
      const n = c.athlete || {};
      const p = String(n.displayName || '').split(' ');
      return { position: i + 1, driver_number: i, driver: { full_name: n.displayName, first_name: p[0], last_name: p.slice(1).join(' ') } };
    });
  }
  async function f1Classificacao() {
    const d = await json(`${EW}/v2/sports/racing/f1/standings`);
    const [dr, co] = d.children;
    const v = (e, n) => { const x = (e.stats || []).find((y) => y.name === n); return x ? x.displayValue : ''; };
    return {
      at: Date.now(), round: '', _fonte: 'ESPN',
      drivers: dr.standings.entries.map((e) => {
        const p = String(e.athlete.displayName).split(' ');
        return { position: v(e, 'rank'), points: v(e, 'championshipPts'), Driver: { givenName: p[0], familyName: p.slice(1).join(' ') }, Constructors: [] };
      }),
      cons: co.standings.entries.map((e) => ({ position: v(e, 'rank'), points: v(e, 'points'), Constructor: { constructorId: '', name: e.team.displayName } }))
    };
  }

  return { todos, reconciliar, detalhe, tabela, f1Sessoes, f1Resultado, f1Classificacao, porId, mesmoJogo };
})();
