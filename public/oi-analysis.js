(function () {
  'use strict';

  if (window.__StrikePulseOIAnalysisLoaded) return;
  window.__StrikePulseOIAnalysisLoaded = true;

  const BASE = 'https://strike-pulse-relay.onrender.com/api';
  const INTERVAL = 15000;
  let symbol = 'NIFTY';
  let busy = false;
  let lastData = null;

  const page = () => document.querySelector('.sp-oi-intel');
  const num = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const first = (o, keys) => {
    for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
    return null;
  };
  const fmt = (v, d = 0) => {
    const n = num(v);
    return n === null ? '--' : n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const pct = v => {
    const n = num(v);
    return n === null ? '--' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const setText = (el, value) => { if (el) el.textContent = value; };
  const setMany = (selector, values) => document.querySelectorAll(selector).forEach((e, i) => { if (values[i] !== undefined) e.textContent = values[i]; });

  function unwrap(body) {
    return body && body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body;
  }

  function normalizeRows(body) {
    const root = unwrap(body) || {};
    const candidates = [
      root.rows, root.options, root.optionChain, root.records, root.chain,
      root.data, root.filtered && root.filtered.data,
      body && body.rows, body && body.options, body && body.optionChain,
      body && body.records && body.records.data
    ];
    const arr = candidates.find(Array.isArray) || [];

    return arr.map(item => {
      const ce = item && (item.CE || item.ce || item.call || item.calls || {});
      const pe = item && (item.PE || item.pe || item.put || item.puts || {});
      return {
        strike: num(first(item, ['strikePrice','strike','strike_price','StrikePrice'])),
        ce: {
          oi: num(first(ce, ['openInterest','oi','OI','open_interest'])),
          oiChange: num(first(ce, ['changeinOpenInterest','oiChange','changeOI','OIChange','change_in_oi'])),
          ltp: num(first(ce, ['lastPrice','ltp','LTP','lastTradedPrice','price'])),
          change: num(first(ce, ['change','pChange','percentChange'])),
          volume: num(first(ce, ['totalTradedVolume','volume','Volume','totalVolume'])),
          iv: num(first(ce, ['impliedVolatility','iv','IV']))
        },
        pe: {
          oi: num(first(pe, ['openInterest','oi','OI','open_interest'])),
          oiChange: num(first(pe, ['changeinOpenInterest','oiChange','changeOI','OIChange','change_in_oi'])),
          ltp: num(first(pe, ['lastPrice','ltp','LTP','lastTradedPrice','price'])),
          change: num(first(pe, ['change','pChange','percentChange'])),
          volume: num(first(pe, ['totalTradedVolume','volume','Volume','totalVolume'])),
          iv: num(first(pe, ['impliedVolatility','iv','IV']))
        }
      };
    }).filter(r => r.strike !== null).sort((a,b) => a.strike - b.strike);
  }

  function getSpot(body) {
    const d = unwrap(body) || {};
    return num(first(d, ['spot','spotPrice','underlyingValue','underlying','indexPrice','underlying_value'])) || num(body?.records?.underlyingValue);
  }

  function nearestATM(rows, spot) {
    if (!rows.length || spot === null) return null;
    return rows.reduce((best, r) => Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best, rows[0]);
  }

  function top(rows, side, field, n = 3) {
    return rows.filter(r => num(r[side]?.[field]) !== null).sort((a,b) => (b[side][field] || 0) - (a[side][field] || 0)).slice(0,n);
  }

  function classify(priceChange, oiChange) {
    const p = num(priceChange), o = num(oiChange);
    if (p === null || o === null || (Math.abs(p) < 0.0001 && Math.abs(o) < 0.0001)) return { key:'neutral', label:'NEUTRAL', text:'No clear positioning shift' };
    if (o > 0 && p > 0) return { key:'long', label:'LONG BUILDUP', text:'Price and OI rising together' };
    if (o > 0 && p < 0) return { key:'short', label:'SHORT BUILDUP', text:'OI rising while price softens' };
    if (o < 0 && p > 0) return { key:'cover', label:'SHORT COVERING', text:'OI falling while price rises' };
    if (o < 0 && p < 0) return { key:'unwind', label:'LONG UNWINDING', text:'Price and OI falling together' };
    return { key:'neutral', label:'NEUTRAL', text:'Mixed positioning' };
  }

  function sideBehaviour(rows, side) {
    const active = rows.filter(r => r[side] && r[side].oi !== null && r[side].oiChange !== null && r[side].ltp !== null);
    if (!active.length) return { state:'NO DATA', detail:'Live OI behaviour unavailable', score:0 };
    let writing = 0, unwinding = 0, buildup = 0, covering = 0;
    active.forEach(r => {
      const c = classify(r[side].change, r[side].oiChange);
      if (r[side].oiChange > 0 && r[side].ltp !== null) {
        if (r[side].change !== null && r[side].change < 0) writing++;
        if (r[side].change !== null && r[side].change > 0) buildup++;
      }
      if (r[side].oiChange < 0) {
        if (r[side].change !== null && r[side].change > 0) covering++;
        if (r[side].change !== null && r[side].change < 0) unwinding++;
      }
      if (c.key === 'short') writing += 0.5;
    });
    const score = writing - unwinding + (side === 'pe' ? covering * .2 : buildup * .2);
    if (writing > unwinding && writing >= buildup) return { state:'WRITING', detail:`${writing} strikes show rising OI with softer option price`, score };
    if (unwinding > writing) return { state:'UNWINDING', detail:`${unwinding} strikes show falling OI with weaker option price`, score };
    if (covering > writing) return { state:'COVERING', detail:`${covering} strikes show falling OI with firmer option price`, score };
    return { state:'BUILDUP', detail:`${buildup} strikes show rising OI with firmer option price`, score };
  }

  function updateHeader(data, spot, atm) {
    const root = page();
    if (!root) return;
    const label = symbol === 'BANKNIFTY' ? 'BANK NIFTY' : symbol === 'FINNIFTY' ? 'FIN NIFTY' : symbol === 'MIDCPNIFTY' ? 'MIDCAP' : symbol;
    root.querySelectorAll('.sp-oi-kicker').forEach(e => e.textContent = `${label} • OI POSITIONING`);
    root.querySelectorAll('.sp-oi-live-pill').forEach(e => e.textContent = 'LIVE OI');
    root.querySelectorAll('.sp-pulse-core').forEach(e => {
      const state = dataState(data);
      const strong = e.querySelector('strong');
      const small = e.querySelector('span');
      setText(strong, state.label);
      setText(small, state.detail);
    });
    root.querySelectorAll('.sp-pulse-orbit.orbit-ce').forEach(e => e.textContent = `CE ${fmt(data.callOI)}`);
    root.querySelectorAll('.sp-pulse-orbit.orbit-pe').forEach(e => e.textContent = `PE ${fmt(data.putOI)}`);
    const copy = root.querySelector('.sp-pulse-copy');
    if (copy) {
      const h = copy.querySelector('h2');
      const p = copy.querySelector('p');
      setText(h, stateTitle(data, spot, atm));
      setText(p, stateDescription(data, spot, atm));
    }
  }

  function dataState(data) {
    const p = num(data.pcr);
    const ce = data.callBehaviour?.state, pe = data.putBehaviour?.state;
    if (ce === 'WRITING' && pe === 'WRITING') return { label:'TWO-SIDED WRITING', detail:'Both option sides show fresh writing activity' };
    if (ce === 'WRITING') return { label:'CALL-SIDE PRESSURE', detail:'Call-side OI is building with writing characteristics' };
    if (pe === 'WRITING') return { label:'PUT-SIDE SUPPORT', detail:'Put-side OI is building with writing characteristics' };
    if (p !== null && p > 1.15) return { label:'PUT-HEAVY STRUCTURE', detail:'Put OI is larger relative to Call OI' };
    if (p !== null && p < 0.85) return { label:'CALL-HEAVY STRUCTURE', detail:'Call OI is larger relative to Put OI' };
    return { label:'BALANCED STRUCTURE', detail:'Call and Put positioning is relatively balanced' };
  }

  function stateTitle(data, spot, atm) {
    const s = dataState(data).label;
    return `${symbol === 'BANKNIFTY' ? 'BANK NIFTY' : symbol === 'FINNIFTY' ? 'FIN NIFTY' : symbol} • ${s}`;
  }

  function stateDescription(data, spot, atm) {
    const parts = [];
    if (spot !== null) parts.push(`Spot ${fmt(spot,2)}`);
    if (atm) parts.push(`ATM ${fmt(atm.strike)}`);
    if (num(data.pcr) !== null) parts.push(`PCR ${num(data.pcr).toFixed(2)}`);
    return parts.join(' • ');
  }

  function renderBehaviour(rows) {
    const root = page();
    if (!root) return;
    const cb = sideBehaviour(rows, 'ce');
    const pb = sideBehaviour(rows, 'pe');
    const cards = root.querySelectorAll('.sp-oi-behaviour-card');
    [cb,pb].forEach((b,i) => {
      const card = cards[i];
      if (!card) return;
      card.classList.remove('is-writing','is-unwinding','is-covering','is-buildup');
      card.classList.add('is-' + b.state.toLowerCase());
      setText(card.querySelector('.sp-behaviour-result'), b.state);
      setMany(card.querySelectorAll('.sp-behaviour-row strong'), [b.detail, `${Math.max(0, Math.round(Math.abs(b.score) * 10))} activity`]);
      const track = card.querySelector('.sp-behaviour-track span');
      if (track) track.style.width = Math.min(100, Math.max(12, 50 + b.score * 8)) + '%';
    });
  }

  function renderMatrix(rows, spot) {
    const root = page();
    const cells = root?.querySelectorAll('.sp-matrix-cell');
    if (!cells?.length) return;
    const atm = nearestATM(rows, spot);
    const near = atm ? rows.filter(r => Math.abs(r.strike - atm.strike) <= Math.max(100, Math.abs(rows[1]?.strike - rows[0]?.strike || 50) * 3)) : rows.slice(0,7);
    const counts = { long:0, short:0, cover:0, unwind:0, neutral:0 };
    near.forEach(r => { const c = classify(r.ce.change, r.ce.oiChange); counts[c.key]++; const p = classify(r.pe.change, r.pe.oiChange); counts[p.key]++; });
    const vals = [
      ['LONG BUILDUP', counts.long], ['SHORT COVERING', counts.cover],
      ['SHORT BUILDUP', counts.short], ['LONG UNWINDING', counts.unwind]
    ];
    vals.forEach((v,i) => {
      const cell = cells[i]; if (!cell) return;
      setText(cell.querySelector('strong'), v[0]);
      setText(cell.querySelector('span'), `${v[1]} signals near ATM`);
      cell.dataset.state = v[0].toLowerCase().replace(/ /g,'-');
    });
    const note = root.querySelector('.sp-matrix-note');
    if (note) note.textContent = `Near-ATM scan: ${near.length} strikes • Spot ${fmt(spot,2)} • ATM ${atm ? fmt(atm.strike) : '--'}`;
  }

  function renderWalls(rows, spot) {
    const root = page(); if (!root) return;
    const call = top(rows, 'ce', 'oi', 2), put = top(rows, 'pe', 'oi', 2);
    const levels = root.querySelectorAll('.sp-wall-level');
    const values = [
      call[0] ? `CALL WALL • ${fmt(call[0].strike)} • ${fmt(call[0].ce.oi)}` : 'CALL WALL • --',
      put[0] ? `PUT WALL • ${fmt(put[0].strike)} • ${fmt(put[0].pe.oi)}` : 'PUT WALL • --'
    ];
    levels.forEach((e,i) => setText(e, values[i] || ''));
    const atm = nearestATM(rows, spot);
    root.querySelectorAll('.sp-wall-label').forEach(e => e.textContent = `ATM ${atm ? fmt(atm.strike) : '--'}`);
    const line = root.querySelector('.sp-wall-line');
    if (line && call[0] && put[0]) {
      const lo = Math.min(call[0].strike, put[0].strike), hi = Math.max(call[0].strike, put[0].strike);
      const pos = hi === lo ? 50 : ((spot - lo) / (hi - lo)) * 100;
      line.style.setProperty('--sp-wall-pos', Math.max(5, Math.min(95, pos)) + '%');
    }
  }

  function renderShift(rows, spot) {
    const root = page(); if (!root) return;
    const atm = nearestATM(rows, spot);
    const near = atm ? rows.filter(r => Math.abs(r.strike - atm.strike) <= Math.max(150, Math.abs(rows[1]?.strike - rows[0]?.strike || 50) * 4)) : rows;
    let ce = 0, pe = 0;
    near.forEach(r => { ce += r.ce.oiChange || 0; pe += r.pe.oiChange || 0; });
    const total = Math.abs(ce) + Math.abs(pe) || 1;
    const callShare = Math.round(Math.abs(ce) / total * 100), putShare = 100 - callShare;
    const meter = root.querySelector('.sp-shift-meter');
    if (meter) meter.style.setProperty('--sp-shift', callShare + '%');
    setMany(root.querySelectorAll('.sp-shift-copy strong'), [callShare + '% CE', putShare + '% PE']);
    setText(root.querySelector('.sp-shift-copy p'), `${fmt(ce)} Call OI change vs ${fmt(pe)} Put OI change across the near-ATM zone.`);
  }

  function renderActivity(rows, spot) {
    const root = page(); if (!root) return;
    const atm = nearestATM(rows, spot);
    const near = atm ? rows.filter(r => Math.abs(r.strike - atm.strike) <= Math.max(200, Math.abs(rows[1]?.strike - rows[0]?.strike || 50) * 5)) : rows;
    const events = [];
    near.forEach(r => {
      ['ce','pe'].forEach(side => {
        const x = r[side];
        if (x.oiChange === null || x.oiChange === 0) return;
        const c = classify(x.change, x.oiChange);
        events.push({ side:side.toUpperCase(), strike:r.strike, change:x.oiChange, type:c.label, abs:Math.abs(x.oiChange) });
      });
    });
    events.sort((a,b) => b.abs - a.abs);
    const items = root.querySelectorAll('.sp-activity-item');
    items.forEach((e,i) => {
      const a = events[i];
      if (!a) { setText(e, 'No fresh activity detected'); return; }
      e.innerHTML = `<strong>${esc(a.side)} ${esc(fmt(a.strike))}</strong><span>${esc(a.type)}</span><em>${esc(a.change > 0 ? '+' : '')}${esc(fmt(a.change))} OI</em>`;
    });
  }

  function renderPressure(rows, spot) {
    const root = page(); if (!root) return;
    const atm = nearestATM(rows, spot);
    const near = atm ? rows.filter(r => Math.abs(r.strike - atm.strike) <= Math.max(250, Math.abs(rows[1]?.strike - rows[0]?.strike || 50) * 6)) : rows;
    const ranked = near.map(r => ({
      strike:r.strike,
      ce:Math.abs(r.ce.oiChange || 0),
      pe:Math.abs(r.pe.oiChange || 0),
      net:(r.pe.oiChange || 0) - (r.ce.oiChange || 0)
    })).sort((a,b) => Math.abs(b.net) - Math.abs(a.net)).slice(0,5);
    const rowsEl = root.querySelectorAll('.sp-pressure-row');
    rowsEl.forEach((e,i) => {
      const r = ranked[i];
      if (!r) return;
      setMany(e.querySelectorAll('strong'), [fmt(r.strike), r.net >= 0 ? 'PUT OI PRESSURE' : 'CALL OI PRESSURE']);
      const bar = e.querySelector('.sp-pressure-chart span');
      if (bar) bar.style.width = Math.min(100, Math.max(8, Math.abs(r.net) / Math.max(1, Math.max(...ranked.map(x => Math.abs(x.net)))) * 100)) + '%';
    });
  }

  function renderAnomalies(rows) {
    const root = page(); if (!root) return;
    const events = [];
    rows.forEach(r => ['ce','pe'].forEach(side => {
      const x = r[side];
      if (x.volume !== null && x.oiChange !== null) {
        const ratio = Math.abs(x.oiChange) / Math.max(1, x.oi || 1);
        const intensity = x.volume / Math.max(1, Math.abs(x.oiChange));
        if (ratio > 0.08 || intensity > 5) events.push({strike:r.strike,side:side.toUpperCase(),ratio,intensity,oi:x.oiChange,volume:x.volume});
      }
    }));
    events.sort((a,b) => (b.ratio + b.intensity/10) - (a.ratio + a.intensity/10));
    root.querySelectorAll('.sp-anomaly-card').forEach((e,i) => {
      const a = events[i];
      if (!a) return;
      setText(e.querySelector('strong'), `${a.side} ${fmt(a.strike)} • ACTIVITY SPIKE`);
      setText(e.querySelector('p'), `OI change ${a.oi > 0 ? '+' : ''}${fmt(a.oi)} with volume ${fmt(a.volume)}.`);
    });
  }

  function renderExpiry(data) {
    const root = page(); if (!root) return;
    const exp = data.expiry || (Array.isArray(data.expiries) ? data.expiries[0] : null) || 'LIVE';
    root.querySelectorAll('.sp-expiry-line').forEach(e => e.textContent = `Expiry • ${exp}`);
    root.querySelectorAll('.sp-expiry-points').forEach(e => e.textContent = `PCR ${num(data.pcr) !== null ? num(data.pcr).toFixed(2) : '--'} • Max Pain ${fmt(data.maxPain)}`);
  }

  function renderStory(data, rows, spot) {
    const root = page(); if (!root) return;
    const atm = nearestATM(rows, spot);
    const call = top(rows,'ce','oi',1)[0], put = top(rows,'pe','oi',1)[0];
    const cb = data.callBehaviour?.state || 'NO DATA', pb = data.putBehaviour?.state || 'NO DATA';
    const story = [
      `${symbol} is showing ${cb.toLowerCase()} on the Call side and ${pb.toLowerCase()} on the Put side.`,
      call ? `Largest Call OI is concentrated near ${fmt(call.strike)}.` : '',
      put ? `Largest Put OI is concentrated near ${fmt(put.strike)}.` : '',
      atm ? `The near-ATM positioning scan is centered on ${fmt(atm.strike)}.` : ''
    ].filter(Boolean).join(' ');
    const el = root.querySelector('.sp-story p') || root.querySelector('.sp-story');
    if (el) el.textContent = story;
  }

  function render(data, rows, spot) {
    const atm = nearestATM(rows, spot);
    data.callBehaviour = sideBehaviour(rows,'ce');
    data.putBehaviour = sideBehaviour(rows,'pe');
    updateHeader(data, spot, atm);
    renderBehaviour(rows);
    renderMatrix(rows, spot);
    renderWalls(rows, spot);
    renderShift(rows, spot);
    renderActivity(rows, spot);
    renderPressure(rows, spot);
    renderAnomalies(rows);
    renderExpiry(data);
    renderStory(data, rows, spot);

    const root = page();
    if (!root) return;
    root.querySelectorAll('.sp-oi-intel-footer').forEach(e => {
      const updated = data.updated ? new Date(data.updated) : new Date();
      e.textContent = `Live OI analysis • ${updated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} IST`;
    });
    console.log('[StrikePulse OI] updated', symbol, { rows:rows.length, spot, atm:atm?.strike });
  }

  async function load() {
    const root = page();
    if (!root || busy) return;
    busy = true;
    try {
      const url = `${BASE}/option-chain?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`;
      const r = await fetch(url, { cache:'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.json();
      if (!body || body.success === false) throw new Error(body?.error || 'Option-chain unavailable');
      const rows = normalizeRows(body);
      if (!rows.length) throw new Error('No option rows');
      const d = unwrap(body) || body;
      const spot = getSpot(body);
      const data = {
        ...body,
        ...d,
        spot,
        callOI:num(first(d,['callOI','totalCallOI','totalCEOI','totalCallOpenInterest'])),
        putOI:num(first(d,['putOI','totalPutOI','totalPEOI','totalPutOpenInterest'])),
        pcr:num(first(d,['pcr','PCR','putCallRatio'])),
        maxPain:num(first(d,['maxPain','maxpain','MaxPain','max_pain'])),
        expiry:first(d,['expiry','selectedExpiry','nextExpiry','next_expiry']),
        expiries:d.expiries
      };
      if (data.callOI === null) data.callOI = rows.reduce((s,r) => s + (r.ce.oi || 0), 0);
      if (data.putOI === null) data.putOI = rows.reduce((s,r) => s + (r.pe.oi || 0), 0);
      if (data.pcr === null && data.callOI) data.pcr = data.putOI / data.callOI;
      if (data.maxPain === null) data.maxPain = null;
      lastData = data;
      render(data, rows, spot);
    } catch (e) {
      console.error('[StrikePulse OI] data error:', e.message);
    } finally {
      busy = false;
    }
  }

  function bindSymbols() {
    const root = page(); if (!root) return;
    root.querySelectorAll('.sp-oi-market-switch button,[data-oi-symbol]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.symbol || btn.dataset.oiSymbol || btn.textContent.trim().toUpperCase().replace(/\s+/g,'');
        const map = { 'NIFTY':'NIFTY', 'BANKNIFTY':'BANKNIFTY', 'FINNIFTY':'FINNIFTY', 'MIDCAP':'MIDCPNIFTY', 'SENSEX':'SENSEX', 'BANKNIFTYINDEX':'BANKNIFTY' };
        symbol = map[s] || s;
        root.querySelectorAll('.sp-oi-market-switch button').forEach(x => x.classList.toggle('active', x === btn));
        load();
      });
    });
  }

  function start() {
    if (!page()) return;
    bindSymbols();
    load();
    setInterval(load, INTERVAL);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
