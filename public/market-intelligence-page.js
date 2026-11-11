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

/* ==========================================
   STRIKE PULSE — TRADING INTELLIGENCE VIEW
   Light UI · market-wide institutional data
   ========================================== */
(()=>{'use strict';
if(window.__SP_TRADING_INTELLIGENCE_VIEW__)return;
window.__SP_TRADING_INTELLIGENCE_VIEW__=true;
const API='https://strike-pulse-relay.onrender.com/api/market-intelligence';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const fmt=(v,d=2)=>num(v)==null?'—':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const table=(heads,rows,empty)=>'<div class="sp-ti-table-wrap"><table><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+heads.length+'" class="sp-ti-empty">'+esc(empty||'No verified records available')+'</td></tr>')+'</tbody></table></div>';
const css='#sp-trading-intelligence{margin:24px 0;padding:clamp(14px,2vw,24px);border:1px solid #e2e8f0;border-radius:18px;background:#fff;color:#172b43;box-shadow:0 8px 28px rgba(25,55,85,.06);font:inherit;overflow:hidden}#sp-trading-intelligence *{box-sizing:border-box}#sp-trading-intelligence .sp-ti-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}#sp-trading-intelligence h2{margin:0;font-size:clamp(21px,3vw,28px);line-height:1.2;color:#152b43}#sp-trading-intelligence h3{margin:0 0 12px;font-size:16px;color:#1d344d}#sp-trading-intelligence .sp-ti-sub{margin:6px 0 0;color:#64748b;font-size:12px}#sp-trading-intelligence .sp-ti-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#sp-trading-intelligence button{border:0;border-radius:9px;padding:10px 14px;background:#1769d2;color:#fff;font-weight:700;font-size:12px;cursor:pointer}#sp-trading-intelligence button:disabled{opacity:.6;cursor:wait}#sp-trading-intelligence .sp-ti-status,#sp-trading-intelligence .sp-ti-meta{font-size:11px;color:#64748b}#sp-trading-intelligence .sp-ti-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}#sp-trading-intelligence .sp-ti-kpi{border:1px solid #e5ebf2;border-radius:12px;padding:14px;background:#f8fafc;min-width:0}#sp-trading-intelligence .sp-ti-kpi small{display:block;color:#64748b;font-size:10px;font-weight:800;letter-spacing:.06em}#sp-trading-intelligence .sp-ti-kpi strong{display:block;margin:6px 0 2px;font-size:clamp(20px,3vw,27px);font-variant-numeric:tabular-nums}#sp-trading-intelligence .sp-ti-kpi span{font-size:11px;color:#64748b}#sp-trading-intelligence .sp-ti-positive{color:#16834c!important}#sp-trading-intelligence .sp-ti-negative{color:#c43b42!important}#sp-trading-intelligence .sp-ti-section{margin-top:20px;padding-top:18px;border-top:1px solid #edf1f5}#sp-trading-intelligence .sp-ti-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}#sp-trading-intelligence .sp-ti-table-wrap{width:100%;overflow:auto;border:1px solid #e8edf3;border-radius:10px}#sp-trading-intelligence table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}#sp-trading-intelligence th,#sp-trading-intelligence td{padding:10px 12px;border-bottom:1px solid #edf1f5;text-align:right}#sp-trading-intelligence th:first-child,#sp-trading-intelligence td:first-child{text-align:left}#sp-trading-intelligence th{background:#f5f8fb;color:#526579;font-size:10px;text-transform:uppercase;letter-spacing:.04em}#sp-trading-intelligence tr:last-child td{border-bottom:0}#sp-trading-intelligence .sp-ti-empty{text-align:center!important;color:#8290a1;padding:18px}#sp-trading-intelligence .sp-ti-note{margin-top:9px;padding:10px 12px;border-radius:9px;background:#f8fafc;color:#64748b;font-size:11px;line-height:1.5}#sp-trading-intelligence .sp-ti-warning{background:#fff8e8;color:#8a5a12}#sp-trading-intelligence .sp-ti-search{width:min(100%,280px);padding:9px 11px;border:1px solid #dce4ed;border-radius:9px;background:#fff;color:#172b43;font:inherit;font-size:12px}#sp-trading-intelligence .sp-ti-placeholder-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}#sp-trading-intelligence .sp-ti-placeholder{padding:12px;border:1px solid #e5ebf2;border-radius:10px;background:#fafbfd}#sp-trading-intelligence .sp-ti-placeholder strong{display:block;font-size:12px}#sp-trading-intelligence .sp-ti-placeholder span{display:block;margin-top:5px;color:#7b8797;font-size:11px;line-height:1.45}@media(max-width:600px){#sp-trading-intelligence .sp-ti-grid{gap:8px}#sp-trading-intelligence .sp-ti-kpi{padding:11px}#sp-trading-intelligence th,#sp-trading-intelligence td{padding:8px;font-size:10px}}';
function mount(){
 if(document.getElementById('sp-trading-intelligence'))return document.getElementById('sp-trading-intelligence');
 if(!document.getElementById('sp-ti-style')){const st=document.createElement('style');st.id='sp-ti-style';st.textContent=css;document.head.appendChild(st);}
 const host=document.querySelector('.sp-terminal,[data-sp-market-intelligence],main')||document.body;
 const panel=document.createElement('section');panel.id='sp-trading-intelligence';panel.setAttribute('aria-live','polite');
 panel.innerHTML=[
 '<div class="sp-ti-top"><div><h2>Trading Intelligence</h2><p class="sp-ti-sub">Institutional activity, delivery trends and market structure · Research only</p></div><div class="sp-ti-actions"><span id="sp-ti-updated" class="sp-ti-status">Waiting for source data</span><button id="sp-ti-refresh" type="button">↻ Refresh All</button></div></div>',
 '<div class="sp-ti-grid"><div class="sp-ti-kpi"><small>FII / FPI NET FLOW · ₹ CRORE</small><strong id="sp-ti-fii-net">—</strong><span id="sp-ti-fii-date">Awaiting NSE report</span></div><div class="sp-ti-kpi"><small>DII NET FLOW · ₹ CRORE</small><strong id="sp-ti-dii-net">—</strong><span id="sp-ti-dii-date">Awaiting NSE report</span></div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>01 · Institutional Activity — FII / DII</h3><span id="sp-ti-fii-source" class="sp-ti-meta">NSE India · provisional exchange data</span></div><div id="sp-ti-fii-table"></div><div class="sp-ti-note">Market-wide cash-market figures. Provisional exchange data may be revised. These values are not stock-wise institutional flows.</div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>02 · Stock-wise Institutional Activity</h3><input id="sp-ti-stock-search" class="sp-ti-search" type="search" placeholder="Search stock symbol / company"></div><div id="sp-ti-stock-flow" class="sp-ti-note sp-ti-warning">Complete stock-wise FII/DII gross Buy and Sell data is not currently confirmed in a free public feed. No market-wide figures, holdings changes or deal disclosures will be substituted.</div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>03 · Bulk Deals</h3><span id="sp-ti-bulk-meta" class="sp-ti-meta">NSE disclosures</span></div><div id="sp-ti-bulk"></div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>04 · Block Deals</h3><span id="sp-ti-block-meta" class="sp-ti-meta">NSE disclosures</span></div><div id="sp-ti-block"></div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>05 · Delivery Trends</h3><span id="sp-ti-delivery-meta" class="sp-ti-meta">NSE full bhavcopy</span></div><div id="sp-ti-delivery"></div></div>',
 '<div class="sp-ti-section"><div class="sp-ti-section-head"><h3>06 · Additional Ownership & Disclosure Data</h3></div><div class="sp-ti-placeholder-grid"><div class="sp-ti-placeholder"><strong>Promoter Transactions</strong><span>Official disclosure parser still to be connected.</span></div><div class="sp-ti-placeholder"><strong>Insider Transactions</strong><span>Official disclosure parser still to be connected.</span></div><div class="sp-ti-placeholder"><strong>Mutual Fund Holdings</strong><span>Monthly portfolio parser still to be connected.</span></div></div></div>',
 '<div id="sp-ti-error" class="sp-ti-meta" style="margin-top:12px"></div>'
 ].join('');
 host.appendChild(panel);
 panel.querySelector('#sp-ti-refresh').addEventListener('click',()=>load(true));
 panel.querySelector('#sp-ti-stock-search').addEventListener('input',e=>filterRows(e.target.value));
 return panel;
}
let current=null,loading=false;
function filterRows(value){
 const term=String(value||'').trim().toUpperCase();
 ['sp-ti-bulk','sp-ti-block','sp-ti-delivery'].forEach(id=>{
  const root=document.getElementById(id);if(!root)return;
  root.querySelectorAll('tbody tr').forEach(tr=>{tr.hidden=!!term&&!tr.textContent.toUpperCase().includes(term);});
 });
}
function renderDeals(id,section,metaId){
 const data=section||{},rows=Array.isArray(data.rows)?data.rows:[];
 const mapped=rows.map(x=>[x.date,x.symbol,x.clientName,x.side,fmt(x.quantity,0),fmt(x.averagePrice),num(x.quantity)!=null&&num(x.averagePrice)!=null?fmt(x.quantity*x.averagePrice,2):'—']);
 document.getElementById(id).innerHTML=table(['Date','Symbol','Client','Side','Quantity','Avg Price','Deal Value'],mapped,'No disclosed records in the available report window.');
 document.getElementById(metaId).textContent=data.available?String(data.totalRows??rows.length)+' disclosed records':(data.reason||'Source unavailable');
}
function render(data){
 current=data;
 const p=data.participants||{},rows=Array.isArray(p.rows)?p.rows:[];
 const find=needle=>rows.find(x=>String(x.category||'').toUpperCase().includes(needle));
 const fii=find('FII')||find('FPI'),dii=find('DII');
 const net=x=>num(x?.netValue);
 const setNet=(id,x)=>{const el=document.getElementById(id),v=net(x);el.textContent=fmt(v);el.className=v==null?'':v>0?'sp-ti-positive':v<0?'sp-ti-negative':'';};
 setNet('sp-ti-fii-net',fii);setNet('sp-ti-dii-net',dii);
 document.getElementById('sp-ti-fii-date').textContent='Report date: '+String(p.date||fii?.date||'—');
 document.getElementById('sp-ti-dii-date').textContent='Report date: '+String(p.date||dii?.date||'—');
 document.getElementById('sp-ti-fii-source').textContent=(p.source||'NSE India · fiidiiTradeReact')+(p.provisional?' · Provisional':'');
 document.getElementById('sp-ti-fii-table').innerHTML=table(['Category','Buy (₹ Cr)','Sell (₹ Cr)','Net (₹ Cr)'],rows.map(x=>[x.category,fmt(x.buyValue),fmt(x.sellValue),fmt(x.netValue)]),p.reason||'FII/DII report unavailable.');
 const deals=data.largeDeals||{};
 renderDeals('sp-ti-bulk',deals.bulk,'sp-ti-bulk-meta');
 renderDeals('sp-ti-block',deals.block,'sp-ti-block-meta');
 const delivery=data.delivery||{},top=delivery.topByDeliveryQty||[];
 document.getElementById('sp-ti-delivery-meta').textContent=delivery.available?'Report date: '+String(delivery.date||'—')+' · '+String(delivery.qualifiedRows??0)+' qualifying stocks':(delivery.reason||'NSE delivery report unavailable');
 document.getElementById('sp-ti-delivery').innerHTML=table(['Symbol','Traded Qty','Deliverable Qty','Delivery %'],top.map(x=>[x.symbol,fmt(x.tradedQty,0),fmt(x.deliveryQty,0),fmt(x.deliveryPercent)]),delivery.reason||'No verified delivery rows available.');
 document.getElementById('sp-ti-updated').textContent='Fetched '+new Date(data.generatedAt||Date.now()).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
 document.getElementById('sp-ti-error').textContent='';
 filterRows(document.getElementById('sp-ti-stock-search').value);
}
async function load(force=false){
 if(loading)return;loading=true;
 const btn=document.getElementById('sp-ti-refresh'),status=document.getElementById('sp-ti-updated'),error=document.getElementById('sp-ti-error');
 if(btn){btn.disabled=true;btn.textContent='Fetching…';}
 if(status)status.textContent=force?'Refreshing official sources…':'Loading official sources…';
 if(error)error.textContent='';
 try{
  const url=API+(force?'?refresh=1&t=':'?t=')+Date.now();
  const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
  const data=await res.json();if(!res.ok||!data?.success)throw Error(data?.error||'Market data request failed');
  render(data);
 }catch(e){
  if(status)status.textContent='Refresh failed';
  if(error)error.textContent=(current?'Previous verified data is retained. ':'')+(e.message||'Source unavailable');
 }finally{
  loading=false;if(btn){btn.disabled=false;btn.textContent='↻ Refresh All';}
 }
}
function start(){mount();load(false);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
