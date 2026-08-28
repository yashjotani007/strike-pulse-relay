(function(){
'use strict';
const API='https://strike-pulse-relay.onrender.com/api/prices';
const VERSION='HOME-DEBUG-20260828-01';
console.log('%c🚀 STRIKE PULSE HOME PRICE JS LOADED — '+VERSION,'color:#00e676;font-weight:bold');
console.log('🌐 PRICE API:',API);
const markets={nifty:['nifty','nifty50'],banknifty:['banknifty','bankNifty'],finnifty:['finnifty','finNifty'],sensex:['sensex','SENSEX','bseSensex','bse_sensex'],vix:['vix','indiaVix','india_vix','INDIA_VIX']};
const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'--'};
const clean=s=>(s||'').replace(/\s+/g,' ').trim().toUpperCase();
function diagnostics(){
 console.log('%c🔎 HOME JS DIAGNOSTICS','color:#42a5f5;font-weight:bold');
 console.log('📍 URL:',location.href);
 console.log('📦 .sp-market-card:',document.querySelectorAll('.sp-market-card').length);
 document.querySelectorAll('.sp-market-card').forEach((c,i)=>console.log('🃏 CARD '+(i+1)+':',clean(c.innerText).slice(0,250)));
 console.log('🎯 IDs:',{nifty:document.querySelector('#sp-nifty-price'),banknifty:document.querySelector('#sp-banknifty-price'),finnifty:document.querySelector('#sp-finnifty-price'),sensex:document.querySelector('#sp-sensex-price'),vix:document.querySelector('#sp-vix-price')});
}
function updateCard(key,price,change){
 console.log('➡️ '+key.toUpperCase()+' INPUT:',{price,change});
 if(price==null||price===''){console.error('❌ '+key.toUpperCase()+' PRICE MISSING FROM API');return 0}
 const value=fmt(price);let found=0;
 const sels=['[data-market="'+key+'"] .sp-price','[data-market="'+key+'"] .sp-market-price','[data-price="'+key+'"]','#sp-'+key+'-price','#sp'+key.charAt(0).toUpperCase()+key.slice(1)+'Price'];
 sels.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.textContent=value;el.style.visibility='visible';el.style.opacity='1';found++}));
 document.querySelectorAll('.sp-market-card').forEach(card=>{
  const t=clean(card.innerText);
  const match=(key==='nifty'&&(t.includes('NIFTY 50')||t==='NIFTY'))||(key==='banknifty'&&(t.includes('BANK NIFTY')||t.includes('BANKNIFTY')))||(key==='finnifty'&&(t.includes('FIN NIFTY')||t.includes('FINNIFTY')))||(key==='sensex'&&t.includes('SENSEX'))||(key==='vix'&&(t.includes('INDIA VIX')||t.includes('VIX')));
  if(!match)return;
  console.log('🎯 '+key.toUpperCase()+' CARD FOUND:',card);
  const candidates=[...card.querySelectorAll('.sp-price,.sp-market-price,.sp-value,.market-price,.price,.value,strong,h2,h3,.elementor-heading-title')];
  console.log('🔍 '+key.toUpperCase()+' VALUE CANDIDATES:',candidates);
  let target=candidates.find(e=>/^(--|—|LOADING|N\/A|0(?:\.0+)?)$/i.test(clean(e.textContent)));
  if(!target)target=candidates.find(e=>e.children.length===0&&e.textContent.trim().length<30);
  if(target){console.log('✅ '+key.toUpperCase()+' TARGET:',target,'=>',value);target.textContent=value;target.style.visibility='visible';target.style.opacity='1';found++}else console.error('❌ '+key.toUpperCase()+' TARGET ELEMENT NOT FOUND');
  if(change!=null){const ch=Number(change);const ce=card.querySelector('.sp-market-change,.sp-change,[data-change]');if(ce&&!Number.isNaN(ch)){ce.textContent=(ch>0?'▲ +':ch<0?'▼ ':'● ')+ch.toFixed(2)+'%';}}
 });
 console.log((found?'✅ ':'❌ ')+key.toUpperCase()+' RESULT:',value,'MATCHES:',found);
 return found;
}
async function load(){
 console.log('%c🔄 PRICE UPDATE START','color:#ffca28;font-weight:bold',new Date().toLocaleTimeString());
 try{
  const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});
  console.log('🌐 API STATUS:',r.status,r.ok?'✅ OK':'❌ FAILED');
  if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json();console.log('📦 FULL API RESPONSE:',j);
  const d=j?.data&&typeof j.data==='object'?j.data:j;console.log('🔑 API KEYS:',Object.keys(d));
  let total=0;
  for(const k of Object.keys(markets)){const p=markets[k].map(x=>d?.[x]).find(v=>v!=null&&v!=='');const c=markets[k].map(x=>d?.[x+'Change']).find(v=>v!=null&&v!=='');total+=updateCard(k,p,c)}
  console.log('%c📊 TOTAL HOME PRICE TARGETS UPDATED: '+total,'color:#00e676;font-weight:bold');
 }catch(e){console.error('%c❌ HOME PRICE JS ERROR','color:#ef233c;font-weight:bold',e);console.error('Stack:',e?.stack)}
}
function start(){diagnostics();load();setInterval(load,5000);console.log('⏱️ AUTO REFRESH ENABLED: every 5 seconds')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();