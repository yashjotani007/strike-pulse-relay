// Market loader v20260925-r5
(() => {
  'use strict';

  // Separate guard so an older WordPress-cached loader cannot block this version.
  if (window.__SP_MARKET_LOADER_20260925_R5__) return;
  window.__SP_MARKET_LOADER_20260925_R5__ = true;

  const API = 'https://strike-pulse-relay.onrender.com/api/market-intelligence';
  window.__SP_MI_RENDER_CONTROLLER__ = true;
  document.documentElement.dataset.spMiReady = '1';

  const $ = id => document.getElementById(id);
  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? '—' : value;
  };
  const num = v => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const price = v => {
    const x = num(v);
    return x == null ? '—' : x.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
  };
  const change = v => {
    const x = num(v);
    return x == null ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
  };

  function clock() {
    const now = new Date();
    set('spmi-clock', now.toLocaleTimeString('en-IN', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}));
    set('spmi-date', now.toLocaleDateString('en-IN', {timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric'}));
  }


  function drawSnapshotChart(id, rows) {
    const canvas = $(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, Math.round(rect.width || canvas.clientWidth || 600));
    const h = Math.max(180, Math.round(rect.height || canvas.clientHeight || 240));
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    if (!rows.length) { ctx.font='14px Arial'; ctx.fillStyle='#7A8799'; ctx.fillText('Live breadth data unavailable',16,28); return; }
    const vals = rows.map(r=>num(r[1])).filter(v=>v!=null);
    if (!vals.length) { ctx.font='14px Arial'; ctx.fillStyle='#7A8799'; ctx.fillText('Live chart data unavailable',16,28); return; }
    const maxAbs = Math.max(1, ...vals.map(v=>Math.abs(v)));
    const pad = {l:72,r:18,t:18,b:34};
    const innerW = w-pad.l-pad.r, innerH=h-pad.t-pad.b, zeroY=pad.t+innerH/2;
    ctx.strokeStyle='#E3EAF3'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad.l,zeroY); ctx.lineTo(w-pad.r,zeroY); ctx.stroke();
    const gap=8, barW=Math.max(18,(innerW-gap*(rows.length-1))/rows.length);
    rows.forEach((r,idx)=>{
      const v=num(r[1]); if(v==null)return;
      const x=pad.l+idx*(barW+gap); const barH=Math.max(2,Math.abs(v)/maxAbs*(innerH/2-8)); const y=v>=0?zeroY-barH:zeroY;
      ctx.fillStyle=v>=0?'#20B86B':'#E05252'; ctx.fillRect(x,y,barW,barH);
      ctx.fillStyle='#17243A'; ctx.font='11px Arial'; ctx.textAlign='center'; ctx.fillText(r[0],x+barW/2,h-10);
      ctx.fillText((v>=0?'+':'')+v.toFixed(2)+'%',x+barW/2,v>=0?Math.max(12,y-5):Math.min(h-20,y+barH+14));
    });
    ctx.textAlign='left';
  }

  function drawIntradayChart(history) {
    const c=$('sp-market-performance-chart'); if(!c)return;
    const ctx=c.getContext('2d');if(!ctx)return;
    const rect=c.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    const w=Math.max(280,Math.round(rect.width||600)),h=Math.max(220,Math.round(rect.height||330));
    c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const colors={nifty:'#2878F0',banknifty:'#20B86B',finnifty:'#E9A23B',sensex:'#9A78DB'};
    const entries=Object.entries(colors).map(([key,color])=>({key,color,points:(history?.series?.[key]||[]).filter(p=>num(p.timestamp)!=null&&num(p.change)!=null)})).filter(e=>e.points.length);
    if(!entries.length){ctx.fillStyle='#64748B';ctx.font='13px Arial';ctx.fillText('Real intraday history unavailable',16,30);return;}
    const all=entries.flatMap(e=>e.points),lo=Math.min(...all.map(p=>p.timestamp)),hi=Math.max(...all.map(p=>p.timestamp)),limit=Math.max(.15,...all.map(p=>Math.abs(p.change)));
    const left=50,right=18,top=22,bottom=38,iw=w-left-right,ih=h-top-bottom;
    const x=t=>left+(t-lo)/Math.max(1,hi-lo)*iw,y=v=>top+(limit-v)/(2*limit)*ih;
    ctx.font='11px Arial';ctx.fillStyle='#64748B';ctx.strokeStyle='#E3EAF3';ctx.lineWidth=1;ctx.textAlign='right';
    [-limit,0,limit].forEach(v=>{ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(w-right,y(v));ctx.stroke();ctx.fillText((v>=0?'+':'')+v.toFixed(2)+'%',left-6,y(v)+4);});
    ctx.textAlign='center';
    for(let n=0;n<=4;n++){const t=lo+(hi-lo)*n/4;ctx.fillText(new Date(t).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}),x(t),h-12);}
    entries.forEach(e=>{ctx.beginPath();ctx.strokeStyle=e.color;ctx.lineWidth=2.4;e.points.forEach((p,n)=>n?ctx.lineTo(x(p.timestamp),y(p.change)):ctx.moveTo(x(p.timestamp),y(p.change)));ctx.stroke();});
  }
  
function render(data) {
    const i = data.indices || {}, regime = data.regime || {}, vix = i.vix || {};
    set('spmi-market-status', String(data.market?.session || 'CLOSED').toUpperCase());
    set('spmi-nifty', price(i.nifty?.price)); set('spmi-nifty-change', change(i.nifty?.change)); set('spmi-nifty-state', i.nifty?.direction || 'NEUTRAL');
    set('spmi-banknifty', price(i.banknifty?.price)); set('spmi-banknifty-change', change(i.banknifty?.change)); set('spmi-banknifty-state', i.banknifty?.direction || 'NEUTRAL');
    set('spmi-finnifty', price(i.finnifty?.price)); set('spmi-finnifty-change', change(i.finnifty?.change)); set('spmi-finnifty-state', i.finnifty?.direction || 'NEUTRAL');
    set('spmi-sensex', price(i.sensex?.price)); set('spmi-sensex-change', change(i.sensex?.change)); set('spmi-sensex-state', i.sensex?.direction || 'NEUTRAL');
    set('spmi-vix', price(vix.price)); set('spmi-vix-large', price(vix.price)); set('spmi-vix-change', change(vix.change));
    set('spmi-vix-condition', num(vix.price) == null ? 'Loading…' : vix.price < 12 ? 'LOW' : vix.price < 20 ? 'NORMAL' : 'HIGH');

    const raw = num(regime.score), score = raw == null ? null : Math.round(Math.max(0, Math.min(100, 50 + raw / 2)));
    set('spmi-regime-score', score); set('spmi-regime-label', regime.label || 'MIXED');

    const b = data.breadth;
    set('spmi-advances', b && num(b.advances) != null ? Number(b.advances).toLocaleString('en-IN') : 'N/A');
    set('spmi-declines', b && num(b.declines) != null ? Number(b.declines).toLocaleString('en-IN') : 'N/A');
    set('spmi-ad-ratio', b && num(b.advances) != null && num(b.declines) != null ? (num(b.declines) > 0 ? (num(b.advances) / num(b.declines)).toFixed(2) : '∞') : 'N/A');

    const drivers = i.drivers || data.drivers || {};
    set('spmi-driver-strongest', drivers.strongest?.name || drivers.strongest || 'N/A');
    set('spmi-driver-weakest', drivers.weakest?.name || drivers.weakest || 'N/A');

    const sectors = i.sectors || data.sectors || {};
    const vals = Object.values(sectors).map(x => num(x?.change)).filter(x => x != null);
    const avg = vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : null;
    set('spmi-pressure', avg == null ? 'N/A' : avg > .25 ? 'BUYING' : avg < -.25 ? 'SELLING' : 'BALANCED');

    const label = String(regime.label || 'MIXED').toUpperCase();
    set('spmi-final-bias', label); set('spmi-final-score', score);
    set('spmi-final-message', 'Market regime is ' + label.toLowerCase() + '; ' + (b ? 'breadth data available' : 'breadth data unavailable') + ', ' + (num(vix.price) == null ? 'VIX unavailable' : 'India VIX ' + price(vix.price)) + '.');
    // Sector cards (HTML has no IDs, so map them by their existing card order).
    const sectorOrder = ['banking','it','auto','pharma','energy','fmcg','metal','realty'];
    const sectorCards = document.querySelectorAll('.sp-market-page .sp-sector-card');
    sectorCards.forEach((card, idx) => {
      const key = sectorOrder[idx];
      const item = sectors[key];
      if (!item) return;
      const valueEl = card.querySelector('strong');
      const stateEl = card.querySelector('small');
      if (valueEl) valueEl.textContent = change(item.change);
      if (stateEl) stateEl.textContent = item.direction || 'Momentum';
    });

    // Current snapshot charts. Historical series are not provided by this API, so do not invent history.
    drawIntradayChart(data.intraday);
    drawSnapshotChart('sp-relative-strength-chart', [
      ['NIFTY', i.nifty?.change], ['BANK NIFTY', i.banknifty?.change], ['FIN NIFTY', i.finnifty?.change], ['SENSEX', i.sensex?.change]
    ]);
    drawSnapshotChart('sp-market-breadth-chart', b ? [
      ['ADVANCES', b.advances], ['DECLINES', b.declines]
    ] : []);

    console.log('[STRIKE PULSE] LIVE MARKET DATA UPDATED', data);
  }

  async function load() {
    try {
      const response = await fetch(API + '?t=' + Date.now(), {cache:'no-store'});
      if (!response.ok) throw new Error('API HTTP ' + response.status);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API success=false');
      render(data);
    } catch (e) {
      console.error('[STRIKE PULSE] MARKET API ERROR:', e);
      set('spmi-market-status', 'DATA ERROR');
      set('spmi-final-message', 'Live data error: ' + e.message);
    }
  }

  function init() {
    // WordPress can execute this loader before the Market HTML exists.
    // Wait until the DOM is parsed, then render immediately and refresh every 15s.
    clock();
    load();
    setInterval(clock, 1000);
    setInterval(load, 15000);
    console.log('[StrikePulse] MARKET LOADER READY v20260924-r4');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
