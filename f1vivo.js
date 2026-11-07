'use strict';
/* F1 ao vivo pela cronometragem oficial (livetiming.formula1.com, SignalR Core por WebSocket).
   Descoberto em 07/11/2026: aceita conexao anonima direto no WebSocket (sem negotiate, que nao tem CORS),
   inclusive de outro site. Chega cada volta e cada setor em menos de 1 s; a ESPN vinha em lotes atrasados.
   Se cair, o app volta para a ESPN sozinho (ver loadF1Result / f1Weekend em app.js). */
window.F1Vivo = (function () {
  const URL_WS = 'wss://livetiming.formula1.com/signalrcore';
  const RS = '\x1e';
  const TOPICOS = ['TimingData', 'DriverList', 'SessionInfo', 'SessionStatus', 'TimingAppData', 'LapCount', 'TrackStatus', 'ExtrapolatedClock', 'Heartbeat'];
  let ws = null, st = {}, at = 0, quer = 0, ping = null, falhas = 0, espera = null, ouvintes = [];

  function juntar(alvo, novo) {
    if (novo == null || typeof novo !== 'object') return novo;
    if (alvo == null || typeof alvo !== 'object') alvo = Array.isArray(novo) ? [] : {};
    Object.keys(novo).forEach((k) => {
      if (k === '_kf') return;
      const v = novo[k];
      alvo[k] = v && typeof v === 'object' ? juntar(alvo[k], v) : v;
    });
    return alvo;
  }
  function avisar() { ouvintes.forEach((f) => { try { f(); } catch (_) {} }); }

  function conectar() {
    if (ws || !quer) return;
    let primeira = true;
    try { ws = new WebSocket(URL_WS); } catch (_) { ws = null; reabrir(); return; }
    const eu = ws;
    eu.onopen = () => eu.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
    eu.onmessage = (m) => {
      String(m.data).split(RS).forEach((p) => {
        if (!p) return;
        let o; try { o = JSON.parse(p); } catch (_) { return; }
        if (primeira) {
          primeira = false;
          eu.send(JSON.stringify({ type: 1, invocationId: '0', target: 'Subscribe', arguments: [TOPICOS] }) + RS);
          // Sem ping do cliente o servidor derruba a conexao em ~30 s.
          clearInterval(ping); ping = setInterval(() => { try { eu.send('{"type":6}' + RS); } catch (_) {} }, 10000);
          return;
        }
        if (o.type === 3 && o.result) { st = {}; Object.keys(o.result).forEach((k) => { st[k] = juntar(null, o.result[k]); }); at = Date.now(); falhas = 0; avisar(); }
        else if (o.type === 1 && o.target === 'feed' && o.arguments) { const [t, d] = o.arguments; st[t] = juntar(st[t], d); at = Date.now(); avisar(); }
        else if (o.type === 7) eu.close();
      });
    };
    eu.onerror = () => {};
    eu.onclose = () => { if (ws === eu) { ws = null; clearInterval(ping); reabrir(); } };
  }
  function reabrir() {
    if (!quer || espera) return;
    falhas++;
    espera = setTimeout(() => { espera = null; conectar(); }, Math.min(30000, 2000 * falhas));
  }
  // Liga enquanto alguem pedir (tela da F1 aberta); desliga 60 s depois do ultimo pedido.
  function manter() { quer = Date.now(); conectar(); }
  setInterval(() => { if (quer && (Date.now() - quer > 60000 || document.hidden)) parar(); }, 5000);
  function parar() { quer = 0; clearTimeout(espera); espera = null; clearInterval(ping); if (ws) { const w = ws; ws = null; try { w.close(); } catch (_) {} } }

  // Sessao do retrato em UTC (StartDate vem na hora local da pista).
  function inicioUtc() {
    const s = st.SessionInfo;
    if (!s || !s.StartDate) return NaN;
    const m = /^(-)?(\d+):(\d+)/.exec(s.GmtOffset || '0:0');
    const off = m ? (m[1] ? -1 : 1) * (Number(m[2]) * 36e5 + Number(m[3]) * 6e4) : 0;
    return new Date(s.StartDate + 'Z').getTime() - off;
  }
  function daSessao(data) { return Math.abs(inicioUtc() - new Date(data).getTime()) < 36e5; }
  function titulo(s) { s = String(s || '').toLowerCase(); return s.replace(/(^|[\s-])\S/g, (x) => x.toUpperCase()); }
  function volta(g) { const m = /^(\d+)\s*L/i.exec(g || ''); return m ? `+${m[1]} volta${m[1] === '1' ? '' : 's'}` : ''; }

  // Mesmo formato de Fontes.f1Tempos: pos, nome, equipe, cor, tempo, dif, voltas, q, melhor, paradas, fora.
  function lista(data) {
    const td = st.TimingData && st.TimingData.Lines;
    if (!td || !daSessao(data) || Date.now() - at > 90000) return null;
    const dl = st.DriverList || {}, app = (st.TimingAppData && st.TimingAppData.Lines) || {};
    const tipo = String((st.SessionInfo && st.SessionInfo.Type) || '');
    const corrida = /race/i.test(tipo);
    const parteAtual = Number(st.TimingData.SessionPart) || 1;
    const linhas = Object.keys(td).map((n) => {
      const l = td[n] || {}, d = dl[n] || {};
      const bl = l.BestLapTimes ? [0, 1, 2].map((i) => (l.BestLapTimes[i] && l.BestLapTimes[i].Value) || '') : [];
      const parte = bl.filter(Boolean).length;
      // Diferenca da parte atual do quali (Q1/Q2/Q3); vazia, vale a ultima parte com valor.
      const sq = l.Stats ? [0, 1, 2].map((i) => l.Stats[i]).filter(Boolean) : [];
      const statsQ = l.Stats ? ((l.Stats[parteAtual - 1] && l.Stats[parteAtual - 1].TimeDiffToFastest) ? l.Stats[parteAtual - 1] : sq.filter((x) => x.TimeDiffToFastest).slice(-1)[0]) : null;
      let dif = corrida ? (l.GapToLeader || '') : (l.TimeDiffToFastest || (statsQ && statsQ.TimeDiffToFastest) || '');
      if (corrida && !/^\+/.test(dif)) dif = volta(dif);
      const stints = app[n] && app[n].Stints ? Object.values(app[n].Stints) : [];
      const pneu = stints.length ? stints[stints.length - 1].Compound : '';
      return {
        pos: Number(l.Position) || Number(l.Line) || 99, nome: d.FirstName ? `${d.FirstName} ${titulo(d.LastName)}` : titulo(d.FullName || `Carro ${n}`),
        equipe: d.TeamName || '', cor: /^[0-9a-f]{6}$/i.test(d.TeamColour || '') ? '#' + d.TeamColour : '',
        tempo: (l.BestLapTime && l.BestLapTime.Value) || '', dif, voltas: Number(l.NumberOfLaps) || 0,
        q: bl.length ? bl.concat(['', '', '']).slice(0, 3) : ['', '', ''], melhor: '',
        paradas: corrida && l.NumberOfPitStops != null ? Number(l.NumberOfPitStops) : null,
        fora: l.Retired ? 'Abandonou' : (corrida && l.Stopped) ? 'Parado' : '',
        box: !!(l.InPit && !l.Retired), pneu: String(pneu || ''), parte
      };
    }).filter((r) => r.nome);
    linhas.sort((a, b) => a.pos - b.pos);
    // Na corrida o tempo do lider e a melhor volta dele, que nao e o que a tabela mostra.
    if (corrida && linhas[0]) linhas[0].tempo = '';
    return linhas.length ? linhas : null;
  }
  // Situacao da sessao para a linha acima da tabela: relogio, volta, bandeira.
  function situacao(data) {
    if (!daSessao(data)) return null;
    const c = st.ExtrapolatedClock, lc = st.LapCount, ts = st.TrackStatus, ss = st.SessionStatus;
    let resta = null;
    if (c && c.Remaining) {
      const [h, m, s] = c.Remaining.split(':').map(Number);
      resta = (h * 3600 + m * 60 + s) * 1000 - (c.Extrapolating ? Date.now() - new Date(c.Utc).getTime() : 0);
      resta = Math.max(0, resta);
    }
    const bandeira = { 1: '', 2: 'Bandeira amarela', 4: 'Safety car', 5: 'Bandeira vermelha', 6: 'Safety car virtual', 7: 'Fim do safety car virtual' }[ts && ts.Status] || '';
    return { resta, anda: !!(c && c.Extrapolating), volta: lc && lc.CurrentLap ? `Volta ${lc.CurrentLap}${lc.TotalLaps ? ' de ' + lc.TotalLaps : ''}` : '', bandeira, acabou: !!(ss && /Finished|Finalised|Ends/i.test(ss.Status || '')) };
  }
  // Retrato unico (sessao recem-terminada): abre, pega o estado e fecha. A conexao aberta e reaproveitada.
  function retrato(ms) {
    if (at && Date.now() - at < 30000) return Promise.resolve(true);
    return new Promise((res) => {
      const ja = !!quer;
      const meu = quer = quer || Date.now();
      // So desliga se ninguem (manter ou outro retrato) pediu a conexao depois.
      const fim = (ok) => { ouvintes = ouvintes.filter((f) => f !== ouve); clearTimeout(t); if (!ja && quer === meu) parar(); res(ok); };
      const ouve = () => { if (st.TimingData) fim(true); };
      const t = setTimeout(() => fim(false), ms || 6000);
      ouvintes.push(ouve);
      conectar();
    });
  }
  function aoMudar(f) { ouvintes.push(f); }
  return { manter, parar, lista, situacao, retrato, aoMudar, ligado: () => !!ws, idade: () => (at ? Date.now() - at : Infinity) };
})();
