(function () {
  'use strict';
  if (window.__SP_GITHUB_MARKET_LOADER__) return;
  window.__SP_GITHUB_MARKET_LOADER__ = true;
  console.log('[StrikePulse] GitHub CDN loader executing');

  // GitHub remains the source of truth. This loader contains the two JS controllers
  // directly so WordPress only has to execute one external script.
  document.addEventListener('DOMContentLoaded',()=>{
  console.log('[StrikePulse] PUBLIC JS LOADED');
  const BASE='https://strike-pulse-relay.onrender.com/api';
  const PRICE=BASE+'/prices';
  let priceBusy=false;
  const hasPriceCards=()=>!!document.querySelector('.sp-market-card');

  async function forceSensexAttach(){
    try{
      if(!hasPriceCards())return null;
      let card=document.querySelector('.sp-market-sensex');
      if(!card){
        card=document.createElement('div');
        card.className='sp-market-card sp-market-sensex';
        card.innerHTML='<div class="sp-market-name">SENSEX</div><div class="sp-price" data-market="sensex">Loading…</div><div class="sp-change" data-change="sensex">—</div><div class="sp-updated" data-updated="sensex">Updated --</div><div class="sp-market-status sp-closed">CLOSED</div>';
        console.error('[StrikePulse] SENSEX CARD WAS MISSING — CREATED NOW');
      }
      const p=document.querySelector('.sp-price[data-market="nifty"]');
      const grid=p?.closest('.wp-block-columns');
      if(grid&&card.parentElement!==grid)grid.appendChild(card);
      card.classList.add('sp-market-card','sp-market-sensex');
      return card;
    }catch(e){console.error('[StrikePulse] SENSEX FORCE ATTACH FAILED',e);return null;}
  }

  async function prices(){
    forceSensexAttach();
    if(!hasPriceCards()||priceBusy)return;
    priceBusy=true;
    try{
      await forceSensexAttach();
      const r=await fetch(PRICE+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json(); const d=j.data||j;
      ['nifty','banknifty','finnifty','vix','sensex'].forEach(k=>{
        const card=document.querySelector('.sp-market-card[data-market-card="'+k+'"]')||document.querySelector('.sp-market-card.sp-market-'+k);
        if(!card)return;
        const value=d[k],change=d[k+'Change'];
        const p=card.querySelector('.sp-price,[data-market="'+k+'"]'),c=card.querySelector('.sp-change,[data-change="'+k+'"]');
        const u=card.querySelector('.sp-updated,[data-updated="'+k+'"]'),s=card.querySelector('.sp-market-status');
        if(p&&value!==null&&value!==undefined&&value!=='')p.textContent=Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
        if(c&&change!==null&&change!==undefined&&change!==''){const x=Number(change);c.textContent=(x>=0?'+':'')+x.toFixed(2)+'%';c.classList.toggle('up',x>=0);c.classList.toggle('down',x<0);}
        if(u&&d.updated)u.textContent='Updated '+new Date(d.updated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        if(s){s.textContent='LIVE';s.classList.remove('sp-closed');s.classList.add('sp-live');}
      });
    }catch(e){console.error('[StrikePulse] prices error:',e);}finally{priceBusy=false;}
  }
  if(hasPriceCards()){prices();setInterval(prices,5000);}
});

  (() => {
  'use strict';

  if (window.__SP_MI_RENDER_CONTROLLER__) return;
  window.__SP_MI_RENDER_CONTROLLER__ = true;

  const API = 'https://strike-pulse-relay.onrender.com/api/market-intelligence';
  const REFRESH_MS = 15000;
  let busy = false;
  let lastData = null;

  document.documentElement.dataset.spMiReady = '1';

  const $ = id => document.getElementById(id);
  const n = v => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const fmt = (v, d = 2) => {
    const x = n(v);
    return x == null ? '—' : x.toLocaleString('en-IN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  };
  const pct = v => {
    const x = n(v);
    return x == null ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
  };
  const direction = v => {
    const x = n(v);
    return x == null ? 'NEUTRAL' : x > 0.05 ? 'UP' : x < -0.05 ? 'DOWN' : 'FLAT';
  };
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '—';
  };
  const setWidth = (id, value) => {
    const el = $(id);
    if (el) el.style.width = Math.max(0, Math.min(100, Number(value) || 0)) + '%';
  };

  function updateClock() {
    const now = new Date();
    setText('spmi-clock', now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }));
    setText('spmi-date', now.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' • IST');
  }

  function updateSessionStatus(market) {
    const session = String(market?.session || 'CLOSED').toUpperCase();
    setText('spmi-market-status', session === 'LIVE' ? 'LIVE' : session);
  }

  function updateIndex(id, data) {
    const change = n(data?.change);
    setText(id, fmt(data?.price));
    setText(id + '-change', pct(change));
    setText(id + '-state', change == null ? 'Waiting for data' :
      change > 0.05 ? 'Bullish' :
      change < -0.05 ? 'Bearish' : 'Neutral');
  }

  function updateRegime(regime) {
    const raw = n(regime?.score);
    const score = raw == null ? 50 : Math.max(0, Math.min(100, 50 + raw / 2));
    const label = String(regime?.label || 'MIXED').toUpperCase();

    setText('spmi-regime-score', Math.round(score));
    setText('spmi-regime-label', label);

    const meter = document.querySelector('.sp-regime-meter i');
    if (meter) meter.style.width = score + '%';
  }

  function updateBreadth(b) {
    const a = n(b?.advances);
    const d = n(b?.declines);
    const u = n(b?.unchanged);
    const valid = a != null && d != null && u != null;
    const total = valid ? a + d + u : 0;

    setText('spmi-advances', valid ? a.toLocaleString('en-IN') : '—');
    setText('spmi-declines', valid ? d.toLocaleString('en-IN') : '—');
    setText('spmi-ad-ratio', valid && d > 0 ? (a / d).toFixed(2) : valid && a > 0 ? '∞' : '—');

    const canvas = $('sp-market-breadth-chart');
    if (canvas) drawBreadth(canvas, valid ? a : 0, valid ? d : 0, valid ? u : 0);

    return { a, d, u, total, valid };
  }

  function updateVix(vix) {
    const value = n(vix?.price);
    const change = n(vix?.change);
    const condition = value == null ? 'Loading...' :
      value < 12 ? 'LOW' :
      value < 20 ? 'NORMAL' : 'HIGH';

    setText('spmi-vix', fmt(value));
    setText('spmi-vix-large', fmt(value));
    setText('spmi-vix-change', pct(change));
    setText('spmi-vix-condition', condition);

    const scale = document.querySelector('.sp-vix-scale i');
    if (scale && value != null) {
      scale.style.width = Math.max(4, Math.min(100, value / 30 * 100)) + '%';
    }

    return { value, change, condition };
  }

  function updateSectors(data) {
    const sectors = data?.indices?.sectors || data?.sectors || {};
    const names = {
      banking: 'Banking',
      it: 'IT',
      auto: 'Auto',
      pharma: 'Pharma',
      energy: 'Energy',
      fmcg: 'FMCG',
      metal: 'Metal',
      realty: 'Realty',
      finance: 'Finance',
      media: 'Media'
    };

    document.querySelectorAll('.sp-sector-card').forEach(card => {
      const label = card.querySelector('span');
      const strong = card.querySelector('strong');
      if (!label || !strong) return;

      const wanted = label.textContent.trim().toLowerCase();
      const key = Object.keys(names).find(k => names[k].toLowerCase() === wanted);
      const item = key ? sectors[key] : null;

      strong.textContent = item && n(item.change) != null ? pct(item.change) : '—';

      card.dataset.change = item && n(item.change) != null ? n(item.change) : '';
    });

    return Object.entries(sectors)
      .filter(([, v]) => v && n(v.change) != null)
      .sort((a, b) => n(b[1].change) - n(a[1].change));
  }

  function updateDrivers(data, sectorEntries) {
    const drivers = data?.indices?.drivers || data?.drivers || {};
    const strongest =
      drivers.strongest ||
      (sectorEntries[0] ? (sectorEntries[0][1].name || sectorEntries[0][0]) : null);
    const weakest =
      drivers.weakest ||
      (sectorEntries.length ? (sectorEntries[sectorEntries.length - 1][1].name || sectorEntries[sectorEntries.length - 1][0]) : null);

    setText('spmi-driver-strongest',
      typeof strongest === 'string' ? strongest : strongest?.name || 'Unavailable');
    setText('spmi-driver-weakest',
      typeof weakest === 'string' ? weakest : weakest?.name || 'Unavailable');

    const pressure = sectorEntries.length
      ? sectorEntries.reduce((sum, [, v]) => sum + n(v.change), 0) / sectorEntries.length
      : null;

    setText('spmi-pressure',
      pressure == null ? 'Unavailable' :
      pressure > 0.25 ? 'BUYING' :
      pressure < -0.25 ? 'SELLING' : 'BALANCED');
  }

  function updateSummary(regime, breadth, vix) {
    const label = String(regime?.label || 'MIXED').toUpperCase();
    const raw = n(regime?.score);
    const score = raw == null ? 50 : Math.round(Math.max(0, Math.min(100, 50 + raw / 2)));

    setText('spmi-final-bias', label);
    setText('spmi-final-score', score);

    const breadthText =
      !breadth.valid ? 'breadth data unavailable' :
      breadth.a > breadth.d ? 'advances are leading declines' :
      breadth.d > breadth.a ? 'declines are leading advances' :
      'advances and declines are balanced';

    const volText = vix.condition === 'Loading...'
      ? 'volatility data unavailable'
      : 'India VIX is ' + vix.condition.toLowerCase();

    setText('spmi-final-message',
      'Market regime is ' + label.toLowerCase() + '; ' +
      breadthText + ', while ' + volText + '.');
  }

  function drawBreadth(canvas, advances, declines, unchanged) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 220;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const total = advances + declines + unchanged;
    if (!total) return;

    const values = [advances, declines, unchanged];
    const max = Math.max(...values, 1);
    const barW = Math.max(20, (w - 80) / 3);

    values.forEach((v, i) => {
      const x = 30 + i * (barW + 20);
      const bh = (v / max) * (h - 55);
      ctx.fillStyle = i === 0 ? '#20B86B' : i === 1 ? '#E05252' : '#AAB6C5';
      ctx.fillRect(x, h - 30 - bh, barW, bh);
    });
  }

  function drawPerformance(canvas, indices) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const entries = [
      ['NIFTY', n(indices?.nifty?.change)],
      ['BANK NIFTY', n(indices?.banknifty?.change)],
      ['FIN NIFTY', n(indices?.finnifty?.change)]
    ].filter(x => x[1] != null);

    if (!entries.length) return;

    const min = Math.min(...entries.map(x => x[1]), 0);
    const max = Math.max(...entries.map(x => x[1]), 0);
    const range = Math.max(max - min, 0.1);

    entries.forEach((entry, i) => {
      const x = 45 + i * ((w - 90) / Math.max(entries.length - 1, 1));
      const y = h / 2 - (entry[1] / range) * (h * 0.32);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#2878F0';
      ctx.fill();
      ctx.font = '12px Arial';
      ctx.fillStyle = '#17243A';
      ctx.fillText(entry[0], x - 28, h - 20);
      ctx.fillText(pct(entry[1]), x - 22, y - 12);
    });
  }

  function drawRelativeStrength(canvas, indices) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth || 700;
    const h = canvas.clientHeight || 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rows = [
      ['NIFTY 50', n(indices?.nifty?.change)],
      ['BANK NIFTY', n(indices?.banknifty?.change)],
      ['FIN NIFTY', n(indices?.finnifty?.change)],
      ['SENSEX', n(indices?.sensex?.change)]
    ].filter(x => x[1] != null);

    if (!rows.length) return;

    const maxAbs = Math.max(...rows.map(x => Math.abs(x[1])), 0.1);
    const center = w * 0.42;
    const rowH = Math.min(45, (h - 30) / rows.length);

    rows.forEach((row, i) => {
      const y = 25 + i * rowH;
      const len = Math.abs(row[1]) / maxAbs * (w * 0.42);
      ctx.fillStyle = row[1] >= 0 ? '#20B86B' : '#E05252';
      ctx.fillRect(row[1] >= 0 ? center : center - len, y, len, 22);
      ctx.fillStyle = '#17243A';
      ctx.font = '12px Arial';
      ctx.fillText(row[0], 10, y + 16);
      ctx.fillText(pct(row[1]), center + 8, y + 16);
    });
  }

  function drawAllCharts(indices, breadth) {
    drawPerformance($('sp-market-performance-chart'), indices);
    drawBreadth($('sp-market-breadth-chart'),
      breadth.valid ? breadth.a : 0,
      breadth.valid ? breadth.d : 0,
      breadth.valid ? breadth.u : 0);
    drawRelativeStrength($('sp-relative-strength-chart'), indices);
  }

  async function load() {
    if (busy || document.hidden) return;
    busy = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(API + '?t=' + Date.now(), {
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Market Intelligence API error');
      }

      const indices = data.indices || data.data?.indices || {};
      const regime = data.regime || {};
      const breadth = updateBreadth(data.breadth || {});
      const vix = updateVix(indices.vix || {});

      updateSessionStatus(data.market);
      updateRegime(regime);
      updateIndex('spmi-nifty', indices.nifty || {});
      updateIndex('spmi-banknifty', indices.banknifty || {});
      updateIndex('spmi-finnifty', indices.finnifty || {});
      updateIndex('spmi-sensex', indices.sensex || {});

      const sectors = updateSectors(data);
      updateDrivers(data, sectors);
      updateSummary(regime, breadth, vix);
      drawAllCharts(indices, breadth);

      lastData = data;
      console.log('[STRIKE PULSE] FULL MARKET HTML DATA UPDATED', data);
    } catch (err) {
      console.error('[STRIKE PULSE] Market API error:', err);
      setText('spmi-market-status', 'DATA UNAVAILABLE');
    } finally {
      busy = false;
    }
  }

  function timeline() {
    const now = new Date(new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata'
    }));
    const minutes = now.getHours() * 60 + now.getMinutes();

    const points = [555, 660, 780, 870, 930];
    document.querySelectorAll('.sp-time-item').forEach((item, i) => {
      item.classList.toggle('active', minutes >= points[i]);
    });
  }

  function init() {
    updateClock();
    timeline();
    load();

    setInterval(updateClock, 1000);
    setInterval(timeline, 30000);
    setInterval(load, REFRESH_MS);

    window.addEventListener('resize', () => {
      if (lastData) {
        const indices = lastData.indices || lastData.data?.indices || {};
        const breadth = updateBreadth(lastData.breadth || {});
        drawAllCharts(indices, breadth);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
})();