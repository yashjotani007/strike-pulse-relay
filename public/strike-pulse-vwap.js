(function(){'use strict';
const API='https://strike-pulse-relay.onrender.com/api';
function el(id){return document.getElementById(id)}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function set(id,v){const e=el(id);if(e)e.textContent=v}
async function loadVWAP(){
 try{
  const r=await fetch(API+'/prices?t='+Date.now(),{cache:'no-store'}); const d=await r.json();
  const spot=num(d.NIFTY??d.nifty??d.nifty50??d.spot??d.price);
  if(spot!==null){set('sp-vwap-price',spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}));set('sp-vwap-spot',spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))}
  const v=num(d.vwap??d.NIFTY_VWAP??d.niftyVwap);
  if(v!==null){set('sp-vwap-value',v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}));set('sp-vwap-diff',(spot!==null?(spot-v).toFixed(2):'--'));set('sp-vwap-status',spot!==null?(spot>=v?'ABOVE VWAP':'BELOW VWAP'):'--');}
 }catch(e){console.error('STRIKE PULSE VWAP:',e)}
}
function init(){loadVWAP();setInterval(loadVWAP,10000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
