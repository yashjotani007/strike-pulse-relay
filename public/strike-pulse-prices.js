(function(){
'use strict';

/* Strike Pulse Market Cards - single loader for price + LIVE/CLOSED */
if(window.__STRIKE_PULSE_MARKET_CARDS_RUNNING__) return;
window.__STRIKE_PULSE_MARKET_CARDS_RUNNING__=true;

const API='https://strike-pulse-relay.onrender.com/api/prices';
const VERSION='MARKET-CARDS-SINGLE-20260901-01';
const REFRESH_MS=15000;

const markets={
  nifty:['nifty','nifty50'],
  banknifty:['banknifty','bankNifty'],
  finnifty:['finnifty','finNifty'],
  vix:['vix','indiaVix','india_vix','INDIA_VIX'],
  sensex:['sensex','SENSEX','bseSensex','bse_sensex']
};

const fmt=v=>{
  const n=Number(v);
  return Number.isFinite(n)
    ?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})
    :'--';
};

function istParts(){
  return new Intl.DateTimeFormat('en-IN',{
    timeZone:'Asia/Kolkata',
    weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).formatToParts(new Date()).reduce((o,p)=>(o[p.type]=p.value,o),{});
}

function isMarketOpen(){
  const p=istParts();
  const seconds=(+p.hour*3600)+(+p.minute*60)+(+p.second);
  return ['Mon','Tue','Wed','Thu','Fri'].includes(p.weekday)&&seconds>=33300&&seconds<55800;
}

function updateStatus(){
  const live=isMarketOpen();
  document.querySelectorAll('.sp-market-status').forEach(el=>{
    el.classList.remove('sp-live','sp-closed','sp-checking');
    el.classList.add(live?'sp-live':'sp-closed');
    el.textContent=live?'LIVE':'CLOSED';
    el.setAttribute('data-status',live?'live':'closed');
  });
  return live;
}

function updateMarket(key,value,change,updated){
  const card=document.querySelector('.sp-market-card[data-market-card="'+key+'"]');
  if(!card)return;

  if(value!==null&&value!==undefined&&value!==''){
    card.querySelectorAll('.sp-price').forEach(el=>el.textContent=fmt(value));
  }

  card.querySelectorAll('.sp-change').forEach(el=>{
    if(change===null||change===undefined||change===''){
      el.textContent='--';
      el.classList.remove('sp-up','sp-down','sp-neutral');
      return;
    }
    const n=Number(change);
    if(!Number.isFinite(n)){el.textContent='--';return;}
    el.textContent=(n>0?'▲ +':n<0?'▼ ':'● ')+Math.abs(n).toFixed(2)+'%';
    el.classList.remove('sp-up','sp-down','sp-neutral');
    el.classList.add(n>0?'sp-up':n<0?'sp-down':'sp-neutral');
  });

  const p=istParts();
  const stamp=updated
    ?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(updated))
    :p.hour+':'+p.minute+':'+p.second;

  card.querySelectorAll('.sp-updated').forEach(el=>{
    el.textContent='Updated '+stamp+' IST';
  });
}

function setErrorState(){
  document.querySelectorAll('.sp-market-card').forEach(card=>{
    const price=card.querySelector('.sp-price');
    if(price&&(price.textContent==='Loading…'||price.textContent==='Loading...'))price.textContent='--';
  });
}

async function loadPrices(){
  try{
    const response=await fetch(API+'?t='+Date.now(),{
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!response.ok)throw new Error('HTTP '+response.status);

    const json=await response.json();
    const data=json&&json.data&&typeof json.data==='object'?json.data:json;
    const updated=data?.updated||json?.updated;

    Object.keys(markets).forEach(key=>{
      const value=markets[key].map(alias=>data?.[alias]).find(v=>v!==null&&v!==undefined&&v!=='');
      const change=markets[key].map(alias=>data?.[alias+'Change']).find(v=>v!==null&&v!==undefined&&v!=='');
      updateMarket(key,value,change,updated);
    });

    window.__STRIKE_PULSE_STATUS_DIAGNOSTIC__={
      version:VERSION,
      api:API,
      pricesLoaded:true,
      marketOpen:isMarketOpen(),
      updated:new Date().toISOString()
    };
  }catch(error){
    console.error('[STRIKE PULSE MARKET CARDS]',error);
    setErrorState();
  }
}

function start(){
  updateStatus();
  loadPrices(); /* Prices load even when market is CLOSED */
  setInterval(updateStatus,1000);
  setInterval(loadPrices,REFRESH_MS);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}
})();