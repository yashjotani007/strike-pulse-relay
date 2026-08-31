(function(){'use strict';
const API='https://strike-pulse-relay.onrender.com/api';
const $=id=>document.getElementById(id);
const n=v=>{v=Number(v);return Number.isFinite(v)?v:null};
const fmt=v=>v==null?'—':v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
function set(id,v){const e=$(id);if(e)e.textContent=v}
async function load(){
 try{
  const r=await fetch(API+'/prices?t='+Date.now(),{cache:'no-store'}); const d=await r.json();
  const spot=n(d.NIFTY??d.nifty??d.nifty50??d.spot??d.price);
  let vwap=n(d.vwap??d.VWAP??d.NIFTY_VWAP??d.niftyVwap);
  const q=d.data||d.result||d;
  if(vwap==null)vwap=n(q.vwap??q.VWAP??q.NIFTY_VWAP??q.niftyVwap);
  set('spVwapSpot',fmt(spot)); set('spVwapValue',fmt(vwap));
  if(spot!=null&&vwap!=null){const diff=spot-vwap;set('spVwapDifference',(diff>=0?'+':'')+diff.toFixed(2));set('spVwapPosition',diff>=0?'ABOVE VWAP':'BELOW VWAP')}
  else{set('spVwapDifference','—');set('spVwapPosition','WAITING')}
  set('spVwapStatus',vwap!=null?'VWAP data updating':'VWAP value unavailable from API');
  set('spVwapUpdated','Updated '+new Date().toLocaleTimeString('en-IN'));
  const msg=$('spVwapChartMessage');if(msg)msg.style.display='none';
 }catch(e){console.error('[STRIKE PULSE VWAP]',e);set('spVwapStatus','VWAP connection error')}
}
function init(){load();setInterval(load,10000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
