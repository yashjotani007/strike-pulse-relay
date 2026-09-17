'use strict';

// Single-file Market Intelligence loader.
// It injects its CSS + frontend JS from /market-intelligence-loader.js only.
// Existing APIs and option-chain routes are not modified.
const express = require('express');

const LOADER = `(function(){'use strict';if(window.__SP_MARKET_INTELLIGENCE_LOADER__)return;window.__SP_MARKET_INTELLIGENCE_LOADER__=true;const css=${JSON.stringify(`.sp-mi-loading,.sp-mi-card,.sp-mi-head,.sp-mi-regime,.sp-mi-grid,.sp-mi-breadth,.sp-mi-signals,.sp-mi-foot{box-sizing:border-box}.sp-mi-loading{width:100%;max-width:1540px;margin:24px auto;padding:22px;border-radius:20px;background:#0b1328;color:#fff;font-family:inherit}.sp-mi-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.sp-mi-title{font-size:25px;font-weight:850;letter-spacing:.2px}.sp-mi-sub{margin-top:5px;color:#8fa2bd;font-size:13px}.sp-mi-status{padding:7px 11px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:1px;background:rgba(255,255,255,.08);color:#b8c5d8}.sp-mi-status.live{color:#4ade80;background:rgba(25,135,84,.12)}.sp-mi-status.closed{color:#ff7185;background:rgba(220,53,69,.10)}.sp-mi-regime{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:18px 20px;margin-bottom:18px;border:1px solid rgba(13,110,253,.3);border-radius:18px;background:linear-gradient(145deg,#101d38,#0a1730);color:#fff}.sp-mi-regime-label{font-size:11px;color:#8fa2bd;text-transform:uppercase;letter-spacing:1.2px}.sp-mi-regime-value{margin-top:4px;font-size:24px;font-weight:900}.sp-mi-score{font-size:13px;color:#b8c5d8}.sp-mi-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.sp-mi-card{position:relative;overflow:hidden;min-height:190px;padding:22px;border-radius:18px;background:linear-gradient(145deg,#0b1328,#101d38);border:1px solid rgba(13,110,253,.3);color:#fff;box-shadow:0 14px 35px rgba(2,8,23,.24)}.sp-mi-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:#0d6efd}.sp-mi-card.positive:after{background:#20c997}.sp-mi-card.negative:after{background:#dc3545}.sp-mi-name{font-size:15px;font-weight:850;letter-spacing:.7px}.sp-mi-price{margin-top:24px;font-size:30px;line-height:1;font-weight:900;white-space:nowrap}.sp-mi-change{display:inline-block;margin-top:10px;padding:5px 9px;border-radius:7px;font-size:13px;font-weight:850;background:rgba(255,255,255,.07)}.sp-mi-card.positive .sp-mi-change{color:#4ade80}.sp-mi-card.negative .sp-mi-change{color:#ff7185}.sp-mi-card.neutral .sp-mi-change{color:#cbd5e1}.sp-mi-momentum{margin-top:12px;color:#8fa2bd;font-size:10px;font-weight:800;letter-spacing:.8px}.sp-mi-breadth{margin-top:16px;padding:13px 16px;border-radius:12px;background:#0b1328;color:#b8c5d8;font-size:13px}.sp-mi-signals{margin-top:14px;padding:16px;border-radius:14px;background:#0b1328;border:1px solid rgba(255,255,255,.07)}.sp-mi-signals-title{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.sp-mi-signal{padding:5px 0;color:#dbe7f5;font-size:13px}.sp-mi-foot{margin-top:12px;color:#71839d;font-size:10px}@media(max-width:1100px){.sp-mi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.sp-mi-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sp-mi-card{min-height:165px;padding:17px}.sp-mi-price{font-size:25px}.sp-mi-title{font-size:21px}}@media(max-width:450px){.sp-mi-grid{grid-template-columns:1fr}.sp-mi-card{min-height:145px}.sp-mi-head{flex-direction:column}.sp-mi-regime{align-items:flex-start;flex-direction:column}}`)};const js=${JSON.stringify(`/* Strike Pulse — single-file Market Intelligence frontend. */
(function(){
'use strict';
if(window.__SP_MARKET_INTELLIGENCE__)return;
window.__SP_MARKET_INTELLIGENCE__=true;
const API=(window.STRIKE_PULSE_API||'https://strike-pulse-relay.onrender.com').replace(/\\/$/,'');
const symbols=[['nifty','NIFTY'],['banknifty','BANK NIFTY'],['finnifty','FIN NIFTY'],['sensex','SENSEX'],['vix','INDIA VIX']];
function esc(v){return String(v==null?'':v).replace(/[&<>\\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;'}[s]));}
function fmt(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}):'—';}
function cls(direction){return /BULLISH/.test(direction)?'positive':/BEARISH/.test(direction)?'negative':'neutral';}
function pct(v){if(!Number.isFinite(Number(v)))return '—';const n=Number(v);return(n>=0?'+':'')+n.toFixed(2)+'%';}
function label(v){return String(v||'UNKNOWN').replaceAll('_',' ');}
function ensure(){let el=document.getElementById('sp-market-intelligence');if(el)return el;el=document.createElement('section');el.id='sp-market-intelligence';el.className='sp-mi-loading';el.innerHTML='<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status">LOADING</div></div><div>Loading market intelligence…</div>';const target=document.querySelector('main')||document.querySelector('.site-main')||document.body;target.prepend(el);return el;}
function render(data){const el=ensure(),regime=data.regime||{},indices=data.indices||{},breadth=data.breadth||{};let cards='';symbols.forEach(([key,name])=>{const x=indices[key]||{},direction=x.direction||'UNKNOWN';cards+=`<div class="sp-mi-card ${cls(direction)}"><div class="sp-mi-name">${name}</div><div class="sp-mi-price">${fmt(x.price)}</div><div class="sp-mi-change">${pct(x.change)}</div><div class="sp-mi-momentum">${esc(label(direction))}</div></div>`});const signals=Array.isArray(data.signals)?data.signals:[],session=data.market?.session||'UNKNOWN',breadthText=breadth&&Number.isFinite(Number(breadth.advances))?`Adv ${breadth.advances} · Dec ${breadth.declines} · Unch ${breadth.unchanged}`:'';el.className='';el.innerHTML=`<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status ${session==='LIVE'?'live':'closed'}">${esc(session)}</div></div><div class="sp-mi-regime"><div><div class="sp-mi-regime-label">Overall Market Regime</div><div class="sp-mi-regime-value">${esc(regime.label||'UNKNOWN')}</div></div><div class="sp-mi-score">Score ${fmt(regime.score)}</div></div><div class="sp-mi-grid">${cards}</div><div class="sp-mi-breadth">${breadthText||'NIFTY 50 breadth unavailable'}</div><div class="sp-mi-signals"><div class="sp-mi-signals-title">Live Signals</div>${signals.length?signals.map(s=>`<div class="sp-mi-signal">${esc(s)}</div>`).join(''):'<div class="sp-mi-signal">No additional signals available.</div>'}</div><div class="sp-mi-foot">Source: ${esc(data.source||'Strike Pulse')} · Updated ${data.generatedAt?new Date(data.generatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}</div>`;}
async function load(){try{const r=await fetch(API+'/api/market-intelligence',{cache:'no-store'}),data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||('HTTP '+r.status));render(data);return data;}catch(e){const el=ensure();el.className='';el.innerHTML='<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status closed">OFFLINE</div></div><div>Market Intelligence is temporarily unavailable.</div>';console.error('[Strike Pulse Market Intelligence]',e);}}
function start(){load();setInterval(load,15000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();`)};const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);(0,eval)(js)})();`;

// Express creates the app in server-original.js. Register our middleware on
// the first app.use() call, before the existing middleware/catch-all routes.
const ORIGINAL_USE = express.application.use;
let installed = false;
express.application.use = function(...args){
  if(!installed){
    installed = true;
    ORIGINAL_USE.call(this,(req,res,next)=>{
      if(req.method==='GET' && req.path==='/market-intelligence-loader.js'){
        res.type('application/javascript').set('Cache-Control','no-store').send(LOADER);
        return;
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this,...args);
};

console.log('[MARKET INTELLIGENCE] single-file loader loaded — /market-intelligence-loader.js');
