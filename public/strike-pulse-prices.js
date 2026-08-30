(function(){
'use strict';
const API='https://strike-pulse-relay.onrender.com/api/prices';
const markets={nifty:['nifty','nifty50'],banknifty:['banknifty','bankNifty'],finnifty:['finnifty','finNifty'],sensex:['sensex','SENSEX','bseSensex','bse_sensex'],vix:['vix','indiaVix','india_vix','INDIA_VIX']};
const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'--'};
function ist(){const p=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date()),x={};p.forEach(a=>{if(a.type!=='literal')x[a.type]=a.value});return x}
function clock(){const x=ist();return x.hour+':'+x.minute+':'+x.second}
function openNow(){const x=ist(),t=+x.hour*3600 + +x.minute*60 + +x.second;return ['Mon','Tue','Wed','Thu','Fri'].includes(x.weekday)&&t>=33300&&t<55800}
function status(){const live=openNow();document.querySelectorAll('.sp-market-status').forEach(e=>{e.classList.remove('sp-live','sp-closed');e.classList.add(live?'sp-live':'sp-closed');e.textContent=live?'LIVE':'CLOSED';});}
function card(k,p,c){if(p==null||p==='')return;const v=fmt(p);document.querySelectorAll('.sp-market-card').forEach(card=>{const n=(card.querySelector('.sp-market-name')?.textContent||'').toUpperCase();const ok=(k==='nifty'&&n.includes('NIFTY 50'))||(k==='banknifty'&&n.includes('BANK NIFTY'))||(k==='finnifty'&&n.includes('FIN NIFTY'))||(k==='sensex'&&n.includes('SENSEX'))||(k==='vix'&&n.includes('INDIA VIX'));if(!ok)return;const pe=card.querySelector('.sp-price');if(pe)pe.textContent=v;const ce=card.querySelector('.sp-change');if(ce&&c!=null){const z=+c;ce.textContent=(z>0?'▲ +':z<0?'▼ ':'● ')+z.toFixed(2)+'%';ce.classList.remove('sp-up','sp-down','sp-neutral');ce.classList.add(z>0?'sp-up':z<0?'sp-down':'sp-neutral')}const ue=card.querySelector('.sp-updated');if(ue)ue.textContent='Updated '+clock()+' IST';});}
async function load(){try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});const j=await r.json();const d=j?.data&&typeof j.data==='object'?j.data:j;Object.keys(markets).forEach(k=>{const p=markets[k].map(a=>d?.[a]).find(v=>v!=null&&v!=='');const c=markets[k].map(a=>d?.[a+'Change']).find(v=>v!=null&&v!=='');card(k,p,c)});status()}catch(e){console.error('[STRIKE PULSE] PRICE ERROR',e);status()}}
function start(){status();load();setInterval(load,5000);setInterval(status,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();