(function(){
'use strict';
const API='https://strike-pulse-relay.onrender.com/api/prices';
const VERSION='HOME-FINAL-PRICE-STATUS-20260831-09';
const markets={nifty:['nifty','nifty50'],banknifty:['banknifty','bankNifty'],finnifty:['finnifty','finNifty'],vix:['vix','indiaVix','india_vix','INDIA_VIX'],sensex:['sensex','SENSEX','bseSensex','bse_sensex']};
const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'--'};
function parts(){return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date()).reduce((o,p)=>(o[p.type]=p.value,o),{});}
function marketOpen(){const p=parts(),s=+p.hour*3600+ +p.minute*60+ +p.second;return ['Mon','Tue','Wed','Thu','Fri'].includes(p.weekday)&&s>=33300&&s<55800;}
function status(){const p=parts(),live=marketOpen();document.querySelectorAll('.sp-market-status').forEach(e=>{e.classList.remove('sp-live','sp-closed');e.classList.add(live?'sp-live':'sp-closed');e.textContent=live?'LIVE':'CLOSED';});window.__SP_STATUS__={open:live,time:p.hour+':'+p.minute+':'+p.second,weekday:p.weekday};return window.__SP_STATUS__;}
function price(key,value,change){if(value==null||value==='')return;document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-price').forEach(e=>e.textContent=fmt(value));document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-change').forEach(e=>{if(change==null||change==='')return;const n=Number(change);e.textContent=(n>0?'▲ +':n<0?'▼ ':'● ')+n.toFixed(2)+'%';e.classList.remove('sp-up','sp-down','sp-neutral');e.classList.add(n>0?'sp-up':n<0?'sp-down':'sp-neutral');});document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-updated').forEach(e=>{const p=parts();e.textContent='Updated '+p.hour+':'+p.minute+':'+p.second+' IST';});}
async function load(){const s=status();if(!s.open)return;try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();const d=j&&j.data&&typeof j.data==='object'?j.data:j;Object.keys(markets).forEach(k=>{const v=markets[k].map(a=>d?.[a]).find(a=>a!=null&&a!=='');const c=markets[k].map(a=>d?.[a+'Change']).find(a=>a!=null&&a!=='');price(k,v,c);});window.__STRIKE_PULSE_STATUS_DIAGNOSTIC__={version:VERSION,api:API,status:s,pricesLoaded:true};console.log('[STRIKE PULSE] LIVE',window.__STRIKE_PULSE_STATUS_DIAGNOSTIC__);}catch(e){console.error('[STRIKE PULSE] ERROR',e);}}
function start(){status();load();setInterval(status,1000);setInterval(load,1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
