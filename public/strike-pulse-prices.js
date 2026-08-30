(function(){
'use strict';
const API='https://strike-pulse-relay.onrender.com/api/prices';
const VERSION='HOME-WORKING-PRICE-STATUS-20260831-06';
const markets={nifty:['nifty','nifty50'],banknifty:['banknifty','bankNifty'],finnifty:['finnifty','finNifty'],sensex:['sensex','SENSEX','bseSensex','bse_sensex'],vix:['vix','indiaVix','india_vix','INDIA_VIX']};
const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'--'};
function ist(){return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date()).reduce((o,p)=>(o[p.type]=p.value,o),{});}
function marketOpen(){const p=ist(),t=+p.hour*3600 + +p.minute*60 + +p.second;return ['Mon','Tue','Wed','Thu','Fri'].includes(p.weekday)&&t>=33300&&t<55800;}
function setStatus(){const p=ist(),open=marketOpen(),reason=!['Mon','Tue','Wed','Thu','Fri'].includes(p.weekday)?'WEEKEND':open?'MARKET_OPEN':(+p.hour*3600 + +p.minute*60 + +p.second<33300?'BEFORE_OPEN':'AFTER_CLOSE');document.querySelectorAll('.sp-market-status').forEach(e=>{e.textContent=open?'LIVE':'CLOSED';e.classList.toggle('sp-live',open);e.classList.toggle('sp-closed',!open);});window.__SP_STATUS__={open,weekday:p.weekday,time:`${p.hour}:${p.minute}:${p.second}`,reason};return open;}
function update(key,price,change){if(price==null||price==='')return;document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-price').forEach(e=>e.textContent=fmt(price));document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-change').forEach(e=>{if(change==null||change==='')return;const n=Number(change);e.textContent=(n>0?'▲ +':n<0?'▼ ':'')+(Number.isFinite(n)?n.toFixed(2):'--')+'%';});document.querySelectorAll('.sp-market-card[data-market-card="'+key+'"] .sp-updated').forEach(e=>e.textContent='Updated '+ist().hour+':'+ist().minute+':'+ist().second+' am');}
async function load(){if(!setStatus())return;try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();const d=j?.data||j;Object.keys(markets).forEach(k=>{const price=markets[k].map(x=>d?.[x]).find(v=>v!==undefined&&v!==null&&v!=='');const change=markets[k].map(x=>d?.[x+'Change']).find(v=>v!==undefined&&v!==null&&v!=='');update(k,price,change);});window.__STRIKE_PULSE_STATUS_DIAGNOSTIC__={version:VERSION,api:'OK',open:true,time:window.__SP_STATUS__.time};}catch(e){console.error('STRIKE PULSE API ERROR:',e);}}
function start(){setStatus();load();setInterval(setStatus,500);setInterval(load,1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
