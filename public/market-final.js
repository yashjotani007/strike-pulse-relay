// Strike Pulse final all-in-one market dashboard
(() => {
  'use strict';

  // Separate guard so an older WordPress-cached loader cannot block this version.
  if (window.__SP_MARKET_LOADER_20260926_R8__) return;
  window.__SP_MARKET_LOADER_20260926_R8__ = true;

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
    const ctx=c.getContext('2d'); if(!ctx)return;
    const rect=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(280,Math.round(rect.width||600)),h=Math.max(220,Math.round(rect.height||300));
    c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#0d1d32';ctx.fillRect(0,0,w,h);
    const colors={nifty:'#65a9ff',banknifty:'#39e5a2',finnifty:'#ffc36b',sensex:'#c2a3ff'};
    const entries=Object.entries(colors).map(([key,color])=>({key,color,points:(history?.series?.[key]||[]).filter(p=>num(p.timestamp)!=null&&num(p.change)!=null).sort((a,b)=>a.timestamp-b.timestamp)})).filter(e=>e.points.length);
    ctx.font='12px Arial,sans-serif';
    if(!entries.length){ctx.fillStyle='#d6e6fa';ctx.fillText('Historical data unavailable from provider',16,35);return;}
    const all=entries.flatMap(e=>e.points),lo=Math.min(...all.map(p=>p.timestamp)),hi=Math.max(...all.map(p=>p.timestamp)),limit=Math.max(.15,...all.map(p=>Math.abs(p.change)));
    const left=58,right=19,top=24,bottom=43,iw=Math.max(100,w-left-right),ih=h-top-bottom;
    const x=t=>left+(t-lo)/Math.max(1,hi-lo)*iw,y=v=>top+(limit-v)/(2*limit)*ih;
    ctx.font='11px Arial,sans-serif';ctx.textAlign='right';ctx.lineWidth=1;
    [-limit,-limit/2,0,limit/2,limit].forEach(v=>{ctx.strokeStyle=v===0?'#607a9b':'#29405b';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(w-right,y(v));ctx.stroke();ctx.fillStyle='#c7d8ed';ctx.fillText((v>=0?'+':'')+v.toFixed(2)+'%',left-8,y(v)+4);});
    ctx.textAlign='center';ctx.fillStyle='#c7d8ed';
    for(let n=0;n<=4;n++){const t=lo+(hi-lo)*n/4;ctx.fillText(new Date(t).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}),x(t),h-14);}
    entries.forEach(e=>{ctx.beginPath();ctx.strokeStyle=e.color;ctx.lineWidth=2.6;ctx.lineJoin='round';e.points.forEach((p,n)=>n?ctx.lineTo(x(p.timestamp),y(p.change)):ctx.moveTo(x(p.timestamp),y(p.change)));ctx.stroke();const last=e.points[e.points.length-1];ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(x(last.timestamp),y(last.change),3.2,0,Math.PI*2);ctx.fill();});
    ctx.textAlign='left';
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
    console.log('[StrikePulse] FINAL MARKET DASHBOARD READY');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();


// Advanced charts — bundled locally in this same JS file.
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{
// Strike Pulse Market Terminal v3 — advanced real-data charts only
(()=>{'use strict';if(window.__SP_TERMINAL_V3__)return;window.__SP_TERMINAL_V3__=true;
const API='https://strike-pulse-relay.onrender.com/api/market-intelligence',root=document.querySelector('.sp3');if(!root)return;
const $=id=>document.getElementById(id),n=v=>v==null||v===''?null:Number.isFinite(+v)?+v:null;
const state={symbol:'nifty',data:null,zoom:1,lib:null,chart:null,volume:null,priceSeries:null,overlays:[],rsi:null,macd:null};
const names={nifty:'NIFTY 50',banknifty:'BANK NIFTY',finnifty:'FIN NIFTY',sensex:'SENSEX'};
function sma(a,len){return a.map((_,i)=>i<len-1?null:a.slice(i-len+1,i+1).reduce((x,y)=>x+y,0)/len)}
function ema(a,len){let v=null,k=2/(len+1);return a.map(x=>{if(x==null)return null;v=v==null?x:x*k+v*(1-k);return v})}
function rsi(a,len=14){const out=Array(a.length).fill(null);if(a.length<=len)return out;let g=0,l=0;for(let i=1;i<=len;i++){const d=a[i]-a[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}g/=len;l/=len;out[len]=l===0?g===0?50:100:100-100/(1+g/l);for(let i=len+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*(len-1)+Math.max(0,d))/len;l=(l*(len-1)+Math.max(0,-d))/len;out[i]=l===0?g===0?50:100:100-100/(1+g/l)}return out}
function macd(a){const f=ema(a,12),s=ema(a,26),line=f.map((v,i)=>i<25?null:v-s[i]),signal=ema(line,9);return{line,signal,hist:line.map((v,i)=>v==null||signal[i]==null?null:v-signal[i])}}
function vwap(a){let pv=0,v=0;return a.map(p=>{if(p.volume==null||p.volume<=0)return null;pv+=((p.high+p.low+p.close)/3)*p.volume;v+=p.volume;return pv/v})}
function valid(){return(state.data?.intraday?.series?.[state.symbol]||[]).filter(p=>n(p.timestamp)!=null&&[p.open,p.high,p.low,p.close].every(v=>n(v)!=null)&&p.high>=p.low).sort((a,b)=>a.timestamp-b.timestamp)}
function message(id,text){const el=$(id);if(el)el.textContent=text}
function canvasChart(id,series,opts={}){const box=$(id);if(!box)return;box.replaceChildren();const c=document.createElement('canvas');box.appendChild(c);const w=Math.max(260,box.clientWidth||450),h=Math.max(160,box.clientHeight||205),d=window.devicePixelRatio||1;c.width=w*d;c.height=h*d;c.style.width='100%';c.style.height='100%';const ctx=c.getContext('2d');ctx.scale(d,d);ctx.fillStyle=opts.bg||'#f6f9fe';ctx.fillRect(0,0,w,h);const vals=series.flatMap(s=>s.data.filter(x=>n(x)!=null));if(!vals.length){ctx.fillStyle='#71849a';ctx.font='12px sans-serif';ctx.fillText('Not enough historical data',16,30);return}let lo=opts.min??Math.min(...vals),hi=opts.max??Math.max(...vals);if(hi===lo){lo-=1;hi+=1}const L=39,R=10,T=12,B=22,iw=w-L-R,ih=h-T-B;const y=v=>T+(hi-v)/(hi-lo)*ih;ctx.strokeStyle=opts.grid||'#dce6f2';ctx.lineWidth=1;ctx.fillStyle=opts.text||'#73869d';ctx.font='10px sans-serif';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillText(v.toFixed(opts.decimals??1),2,yy+3)}series.forEach(s=>{ctx.beginPath();ctx.strokeStyle=s.color;ctx.lineWidth=1.8;let started=false;s.data.forEach((v,i)=>{if(n(v)==null){started=false;return}const x=L+i/Math.max(1,s.data.length-1)*iw;if(!started){ctx.moveTo(x,y(v));started=true}else ctx.lineTo(x,y(v))});ctx.stroke()});}
function clearChart(){state.overlays=[];state.priceSeries=null;if(state.chart){state.chart.remove();state.chart=null}if(state.volume){state.volume.remove();state.volume=null}message('sp3-price-chart','');message('sp3-volume-chart','')}
function drawPrice(){const points=valid(),box=$('sp3-price-chart'),vb=$('sp3-volume-chart');if(!box||!vb)return;clearChart();if(!points.length){box.innerHTML='<div class="sp3-chart-placeholder">Real OHLC candles unavailable from the provider. No synthetic candles displayed.</div>';message('sp3-chart-session','Historical OHLC unavailable');return}
message('sp3-chart-session',new Date(points[0].timestamp).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'})+' · '+points.length+' candles');
const closes=points.map(p=>p.close),ind={ema9:ema(closes,9),ema21:ema(closes,21),ema50:ema(closes,50),vwap:vwap(points)};
drawIndicators(points,closes);if(!state.lib){box.innerHTML='<div class="sp3-chart-placeholder">Loading interactive chart library…</div>';return}
const L=state.lib;state.chart=L.createChart(box,{width:box.clientWidth,height:box.clientHeight,layout:{background:{color:'#0d1d32'},textColor:'#9fb3cb'},grid:{vertLines:{color:'#1d3049'},horzLines:{color:'#1d3049'}},rightPriceScale:{borderColor:'#344b68'},timeScale:{borderColor:'#344b68',timeVisible:true,secondsVisible:false},crosshair:{mode:0},localization:{locale:'en-IN'}});
state.priceSeries=state.chart.addSeries(L.CandlestickSeries,{upColor:'#19c784',downColor:'#ed6377',borderVisible:false,wickUpColor:'#19c784',wickDownColor:'#ed6377'});
const candle=points.map(p=>({time:Math.floor(p.timestamp/1000),open:p.open,high:p.high,low:p.low,close:p.close}));state.priceSeries.setData(candle);
[['ema9','#53a4ff'],['ema21','#f0b457'],['ema50','#b48af3'],['vwap','#43d3ca']].forEach(([key,color])=>{if(!points.length)return;const line=state.chart.addSeries(L.LineSeries,{color,lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});line.setData(ind[key].map((v,i)=>v==null?null:{time:candle[i].time,value:v}).filter(Boolean));state.overlays.push({key,line})});
state.overlays.forEach(({key,line})=>line.applyOptions({visible:!!$('sp3-'+key)?.checked}));
const vols=points.map((p,i)=>p.volume==null?null:{time:candle[i].time,value:p.volume,color:p.close>=p.open?'#19c78488':'#ed637788'}).filter(Boolean);
if(vols.length){state.volume=L.createChart(vb,{width:vb.clientWidth,height:vb.clientHeight,layout:{background:{color:'#f8fbff'},textColor:'#7b8ea5'},grid:{vertLines:{visible:false},horzLines:{color:'#eaf0f7'}},timeScale:{visible:false},rightPriceScale:{borderVisible:false}});const hist=state.volume.addSeries(L.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:''});hist.setData(vols);state.volume.timeScale().setVisibleLogicalRange({from:0,to:Math.max(15,vols.length)});message('sp3-volume-note','Actual reported volume')}else{vb.innerHTML='<div class="sp3-chart-placeholder" style="color:#71849a">Index volume not provided</div>';message('sp3-volume-note','Unavailable for this index')}
state.chart.timeScale().fitContent();if(state.zoom>1){const count=Math.max(12,Math.round(points.length/state.zoom));state.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,points.length-count),to:points.length})}
}
function drawIndicators(points,closes){const r=rsi(closes),m=macd(closes);message('sp3-rsi-value',r.at(-1)==null?'N/A':r.at(-1).toFixed(1));message('sp3-macd-value',m.hist.at(-1)==null?'N/A':m.hist.at(-1).toFixed(2));canvasChart('sp3-rsi-chart',[{data:r,color:'#377af0'}],{min:0,max:100});canvasChart('sp3-macd-chart',[{data:m.line,color:'#2878f0'},{data:m.signal,color:'#efad46'},{data:m.hist,color:'#23b782'}],{decimals:2})}
function renderExtras(d){state.data=d;message('sp3-data-status',d.success?'Market feed connected':'Market feed unavailable');message('sp3-last-updated',d.generatedAt?'Updated '+new Date(d.generatedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'}):'Update unavailable');const i=d.indices||{},q=i[state.symbol]||{};message('sp3-symbol-title',names[state.symbol]);message('sp3-chart-price',n(q.price)==null?'—':q.price.toLocaleString('en-IN',{maximumFractionDigits:2}));message('sp3-chart-change',n(q.change)==null?'—':(q.change>=0?'+':'')+q.change.toFixed(2)+'%');Object.entries(i.sectors||{}).forEach(([key,item])=>{const card=root.querySelector('[data-sp3-sector="'+key+'"]');if(!card||n(item.change)==null)return;const v=item.change;card.classList.remove('sp3-positive','sp3-negative','sp3-flat');card.classList.add(v>.05?'sp3-positive':v<-.05?'sp3-negative':'sp3-flat');card.style.setProperty('--sector-bg',v>.05?'rgba(18,166,106,'+Math.min(.35,.1+Math.abs(v)*.08)+')':v<-.05?'rgba(227,76,97,'+Math.min(.35,.1+Math.abs(v)*.08)+')':'#e9f2ff')});const score=n(d.regime?.score);if(score!=null)$('sp3-score-ring').style.background='conic-gradient(#2878f0 '+Math.max(0,Math.min(100,50+score/2))+'%,#e6eef8 0)';root.querySelectorAll('.sp3-delta').forEach(el=>{const x=parseFloat(el.textContent);el.classList.toggle('sp3-up',Number.isFinite(x)&&x>0);el.classList.toggle('sp3-down',Number.isFinite(x)&&x<0)});drawPrice()}
async function load(){try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('API HTTP '+r.status);const d=await r.json();if(!d.success)throw Error(d.error||'Feed unavailable');renderExtras(d)}catch(e){message('sp3-data-status','Feed unavailable: '+e.message)}}
root.querySelectorAll('[data-sp3-symbol]').forEach(btn=>btn.addEventListener('click',()=>{state.symbol=btn.dataset.sp3Symbol;root.querySelectorAll('[data-sp3-symbol]').forEach(b=>b.classList.toggle('is-active',b===btn));state.zoom=1;if(state.data)renderExtras(state.data)}));
['ema9','ema21','ema50','vwap'].forEach(key=>$('sp3-'+key)?.addEventListener('change',()=>state.overlays.find(x=>x.key===key)?.line.applyOptions({visible:$('sp3-'+key).checked})));
$('sp3-reset-chart')?.addEventListener('click',()=>{state.zoom=1;state.chart?.timeScale().fitContent()});
let resizing;window.addEventListener('resize',()=>{clearTimeout(resizing);resizing=setTimeout(()=>{if(state.data)drawPrice()},250)});
(async()=>{try{state.lib=await import('https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm');if(state.data)drawPrice()}catch(e){message('sp3-price-chart','Interactive chart library unavailable: '+e.message)}})();
load();setInterval(load,60000);
})();
},{once:true});}else{
// Strike Pulse Market Terminal v3 — advanced real-data charts only
(()=>{'use strict';if(window.__SP_TERMINAL_V3__)return;window.__SP_TERMINAL_V3__=true;
const API='https://strike-pulse-relay.onrender.com/api/market-intelligence',root=document.querySelector('.sp3');if(!root)return;
const $=id=>document.getElementById(id),n=v=>v==null||v===''?null:Number.isFinite(+v)?+v:null;
const state={symbol:'nifty',data:null,zoom:1,lib:null,chart:null,volume:null,priceSeries:null,overlays:[],rsi:null,macd:null};
const names={nifty:'NIFTY 50',banknifty:'BANK NIFTY',finnifty:'FIN NIFTY',sensex:'SENSEX'};
function sma(a,len){return a.map((_,i)=>i<len-1?null:a.slice(i-len+1,i+1).reduce((x,y)=>x+y,0)/len)}
function ema(a,len){let v=null,k=2/(len+1);return a.map(x=>{if(x==null)return null;v=v==null?x:x*k+v*(1-k);return v})}
function rsi(a,len=14){const out=Array(a.length).fill(null);if(a.length<=len)return out;let g=0,l=0;for(let i=1;i<=len;i++){const d=a[i]-a[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}g/=len;l/=len;out[len]=l===0?g===0?50:100:100-100/(1+g/l);for(let i=len+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*(len-1)+Math.max(0,d))/len;l=(l*(len-1)+Math.max(0,-d))/len;out[i]=l===0?g===0?50:100:100-100/(1+g/l)}return out}
function macd(a){const f=ema(a,12),s=ema(a,26),line=f.map((v,i)=>i<25?null:v-s[i]),signal=ema(line,9);return{line,signal,hist:line.map((v,i)=>v==null||signal[i]==null?null:v-signal[i])}}
function vwap(a){let pv=0,v=0;return a.map(p=>{if(p.volume==null||p.volume<=0)return null;pv+=((p.high+p.low+p.close)/3)*p.volume;v+=p.volume;return pv/v})}
function valid(){return(state.data?.intraday?.series?.[state.symbol]||[]).filter(p=>n(p.timestamp)!=null&&[p.open,p.high,p.low,p.close].every(v=>n(v)!=null)&&p.high>=p.low).sort((a,b)=>a.timestamp-b.timestamp)}
function message(id,text){const el=$(id);if(el)el.textContent=text}
function canvasChart(id,series,opts={}){const box=$(id);if(!box)return;box.replaceChildren();const c=document.createElement('canvas');box.appendChild(c);const w=Math.max(260,box.clientWidth||450),h=Math.max(160,box.clientHeight||205),d=window.devicePixelRatio||1;c.width=w*d;c.height=h*d;c.style.width='100%';c.style.height='100%';const ctx=c.getContext('2d');ctx.scale(d,d);ctx.fillStyle=opts.bg||'#f6f9fe';ctx.fillRect(0,0,w,h);const vals=series.flatMap(s=>s.data.filter(x=>n(x)!=null));if(!vals.length){ctx.fillStyle='#71849a';ctx.font='12px sans-serif';ctx.fillText('Not enough historical data',16,30);return}let lo=opts.min??Math.min(...vals),hi=opts.max??Math.max(...vals);if(hi===lo){lo-=1;hi+=1}const L=39,R=10,T=12,B=22,iw=w-L-R,ih=h-T-B;const y=v=>T+(hi-v)/(hi-lo)*ih;ctx.strokeStyle=opts.grid||'#dce6f2';ctx.lineWidth=1;ctx.fillStyle=opts.text||'#73869d';ctx.font='10px sans-serif';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillText(v.toFixed(opts.decimals??1),2,yy+3)}series.forEach(s=>{ctx.beginPath();ctx.strokeStyle=s.color;ctx.lineWidth=1.8;let started=false;s.data.forEach((v,i)=>{if(n(v)==null){started=false;return}const x=L+i/Math.max(1,s.data.length-1)*iw;if(!started){ctx.moveTo(x,y(v));started=true}else ctx.lineTo(x,y(v))});ctx.stroke()});}
function clearChart(){state.overlays=[];state.priceSeries=null;if(state.chart){state.chart.remove();state.chart=null}if(state.volume){state.volume.remove();state.volume=null}message('sp3-price-chart','');message('sp3-volume-chart','')}
function drawPrice(){const points=valid(),box=$('sp3-price-chart'),vb=$('sp3-volume-chart');if(!box||!vb)return;clearChart();if(!points.length){box.innerHTML='<div class="sp3-chart-placeholder">Real OHLC candles unavailable from the provider. No synthetic candles displayed.</div>';message('sp3-chart-session','Historical OHLC unavailable');return}
message('sp3-chart-session',new Date(points[0].timestamp).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'})+' · '+points.length+' candles');
const closes=points.map(p=>p.close),ind={ema9:ema(closes,9),ema21:ema(closes,21),ema50:ema(closes,50),vwap:vwap(points)};
drawIndicators(points,closes);if(!state.lib){box.innerHTML='<div class="sp3-chart-placeholder">Loading interactive chart library…</div>';return}
const L=state.lib;state.chart=L.createChart(box,{width:box.clientWidth,height:box.clientHeight,layout:{background:{color:'#0d1d32'},textColor:'#9fb3cb'},grid:{vertLines:{color:'#1d3049'},horzLines:{color:'#1d3049'}},rightPriceScale:{borderColor:'#344b68'},timeScale:{borderColor:'#344b68',timeVisible:true,secondsVisible:false},crosshair:{mode:0},localization:{locale:'en-IN'}});
state.priceSeries=state.chart.addSeries(L.CandlestickSeries,{upColor:'#19c784',downColor:'#ed6377',borderVisible:false,wickUpColor:'#19c784',wickDownColor:'#ed6377'});
const candle=points.map(p=>({time:Math.floor(p.timestamp/1000),open:p.open,high:p.high,low:p.low,close:p.close}));state.priceSeries.setData(candle);
[['ema9','#53a4ff'],['ema21','#f0b457'],['ema50','#b48af3'],['vwap','#43d3ca']].forEach(([key,color])=>{if(!points.length)return;const line=state.chart.addSeries(L.LineSeries,{color,lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});line.setData(ind[key].map((v,i)=>v==null?null:{time:candle[i].time,value:v}).filter(Boolean));state.overlays.push({key,line})});
state.overlays.forEach(({key,line})=>line.applyOptions({visible:!!$('sp3-'+key)?.checked}));
const vols=points.map((p,i)=>p.volume==null?null:{time:candle[i].time,value:p.volume,color:p.close>=p.open?'#19c78488':'#ed637788'}).filter(Boolean);
if(vols.length){state.volume=L.createChart(vb,{width:vb.clientWidth,height:vb.clientHeight,layout:{background:{color:'#f8fbff'},textColor:'#7b8ea5'},grid:{vertLines:{visible:false},horzLines:{color:'#eaf0f7'}},timeScale:{visible:false},rightPriceScale:{borderVisible:false}});const hist=state.volume.addSeries(L.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:''});hist.setData(vols);state.volume.timeScale().setVisibleLogicalRange({from:0,to:Math.max(15,vols.length)});message('sp3-volume-note','Actual reported volume')}else{vb.innerHTML='<div class="sp3-chart-placeholder" style="color:#71849a">Index volume not provided</div>';message('sp3-volume-note','Unavailable for this index')}
state.chart.timeScale().fitContent();if(state.zoom>1){const count=Math.max(12,Math.round(points.length/state.zoom));state.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,points.length-count),to:points.length})}
}
function drawIndicators(points,closes){const r=rsi(closes),m=macd(closes);message('sp3-rsi-value',r.at(-1)==null?'N/A':r.at(-1).toFixed(1));message('sp3-macd-value',m.hist.at(-1)==null?'N/A':m.hist.at(-1).toFixed(2));canvasChart('sp3-rsi-chart',[{data:r,color:'#377af0'}],{min:0,max:100});canvasChart('sp3-macd-chart',[{data:m.line,color:'#2878f0'},{data:m.signal,color:'#efad46'},{data:m.hist,color:'#23b782'}],{decimals:2})}
function renderExtras(d){state.data=d;message('sp3-data-status',d.success?'Market feed connected':'Market feed unavailable');message('sp3-last-updated',d.generatedAt?'Updated '+new Date(d.generatedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'}):'Update unavailable');const i=d.indices||{},q=i[state.symbol]||{};message('sp3-symbol-title',names[state.symbol]);message('sp3-chart-price',n(q.price)==null?'—':q.price.toLocaleString('en-IN',{maximumFractionDigits:2}));message('sp3-chart-change',n(q.change)==null?'—':(q.change>=0?'+':'')+q.change.toFixed(2)+'%');Object.entries(i.sectors||{}).forEach(([key,item])=>{const card=root.querySelector('[data-sp3-sector="'+key+'"]');if(!card||n(item.change)==null)return;const v=item.change;card.classList.remove('sp3-positive','sp3-negative','sp3-flat');card.classList.add(v>.05?'sp3-positive':v<-.05?'sp3-negative':'sp3-flat');card.style.setProperty('--sector-bg',v>.05?'rgba(18,166,106,'+Math.min(.35,.1+Math.abs(v)*.08)+')':v<-.05?'rgba(227,76,97,'+Math.min(.35,.1+Math.abs(v)*.08)+')':'#e9f2ff')});const score=n(d.regime?.score);if(score!=null)$('sp3-score-ring').style.background='conic-gradient(#2878f0 '+Math.max(0,Math.min(100,50+score/2))+'%,#e6eef8 0)';root.querySelectorAll('.sp3-delta').forEach(el=>{const x=parseFloat(el.textContent);el.classList.toggle('sp3-up',Number.isFinite(x)&&x>0);el.classList.toggle('sp3-down',Number.isFinite(x)&&x<0)});drawPrice()}
async function load(){try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('API HTTP '+r.status);const d=await r.json();if(!d.success)throw Error(d.error||'Feed unavailable');renderExtras(d)}catch(e){message('sp3-data-status','Feed unavailable: '+e.message)}}
root.querySelectorAll('[data-sp3-symbol]').forEach(btn=>btn.addEventListener('click',()=>{state.symbol=btn.dataset.sp3Symbol;root.querySelectorAll('[data-sp3-symbol]').forEach(b=>b.classList.toggle('is-active',b===btn));state.zoom=1;if(state.data)renderExtras(state.data)}));
['ema9','ema21','ema50','vwap'].forEach(key=>$('sp3-'+key)?.addEventListener('change',()=>state.overlays.find(x=>x.key===key)?.line.applyOptions({visible:$('sp3-'+key).checked})));
$('sp3-reset-chart')?.addEventListener('click',()=>{state.zoom=1;state.chart?.timeScale().fitContent()});
let resizing;window.addEventListener('resize',()=>{clearTimeout(resizing);resizing=setTimeout(()=>{if(state.data)drawPrice()},250)});
(async()=>{try{state.lib=await import('https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm');if(state.data)drawPrice()}catch(e){message('sp3-price-chart','Interactive chart library unavailable: '+e.message)}})();
load();setInterval(load,60000);
})();
}
