'use strict';
const express = require('express');

// Single-file Market Intelligence data loader.
// It ONLY updates the existing .spmi-* Market page HTML. It does not create new cards,
// does not inject a duplicate UI, and does not modify option-chain routes.
const LOADER = String.raw`(function(){
'use strict';
if(window.__SP_MARKET_INTELLIGENCE_LOADER__)return;
window.__SP_MARKET_INTELLIGENCE_LOADER__=true;
var API=(window.STRIKE_PULSE_API||'https://strike-pulse-relay.onrender.com').replace(/\/$/,'');
function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
function num(v){var n=Number(v);return Number.isFinite(n)?n:null}
function fmt(v){var n=num(v);return n==null?'—':n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(v){var n=num(v);return n==null?'—':(n>=0?'+':'')+n.toFixed(2)+'%'}
function set(id,value){var e=document.getElementById(id);if(e)e.textContent=value}
function setChange(id,value){var e=document.getElementById(id);if(!e)return;e.textContent=pct(value);e.classList.remove('spmi-up','spmi-down');var n=num(value);if(n>0)e.classList.add('spmi-up');else if(n<0)e.classList.add('spmi-down')}
function score100(v){var n=num(v);if(n==null)return 50;return Math.max(0,Math.min(100,(n+100)/2))}
function momentumLabel(d){var n=num(d&&d.regime&&d.regime.averageChange);if(n==null)return 'Unavailable';return n>0.05?'Positive':n<-0.05?'Negative':'Neutral'}
function breadthLabel(b){if(!b||num(b.advances)==null)return 'Unavailable';if(num(b.advances)>num(b.declines))return 'Healthy';if(num(b.declines)>num(b.advances))return 'Weak';return 'Balanced'}
function volatilityLabel(v){var n=num(v&&v.change);if(n==null)return 'Unavailable';if(n>3)return 'Elevated';if(n<-3)return 'Easing';return 'Moderate'}
function vixGauge(v){var n=num(v);if(n==null)return 30;return Math.max(0,Math.min(100,((n-5)/25)*100))}
function update(d){
  var page=document.querySelector('.spmi-page');
  if(!page)return false;
  var r=d.regime||{},i=d.indices||{},b=d.breadth||null;
  var score=score100(r.score),bias=String(r.label||'UNKNOWN');
  set('spmi-bias',bias);
  set('spmi-score',Math.round(score));
  set('spmi-final-bias',bias);
  set('spmi-final-score',Math.round(score)+'/100');
  set('spmi-momentum',momentumLabel(d));
  set('spmi-breadth-state',breadthLabel(b));
  set('spmi-vol-state',volatilityLabel(i.vix));
  var pointer=document.getElementById('spmi-meter-pointer'),fill=document.getElementById('spmi-meter-fill');
  if(pointer)pointer.style.left=score+'%';
  if(fill)fill.style.width=score+'%';
  var rows=[['nifty','spmi-nifty'],['banknifty','spmi-banknifty'],['finnifty','spmi-finnifty'],['vix','spmi-vix']];
  rows.forEach(function(x){var q=i[x[0]]||{};set(x[1],fmt(q.price));var el=document.getElementById(x[1]);if(el&&el.parentElement)setChange(el.parentElement.querySelector('em'),q.change)});
  set('spmi-vix-big',fmt(i.vix&&i.vix.price));
  var gauge=document.querySelector('.spmi-vix-track span');if(gauge)gauge.style.width=vixGauge(i.vix&&i.vix.price)+'%';
  var vb=document.querySelector('.spmi-vol-badge');if(vb)vb.textContent=volatilityLabel(i.vix).toUpperCase();
  var session=d.market&&d.market.session||'UNKNOWN';
  var ss=document.getElementById('spmi-session-status');if(ss)ss.textContent=session==='LIVE'?'LIVE SESSION':session==='PRE-OPEN'?'PRE-OPEN':'MARKET CLOSED';
  var chip=page.querySelector('.spmi-snapshot .spmi-chip');if(chip)chip.textContent=session==='LIVE'?'LIVE':session;
  console.log('[Strike Pulse] existing Market Intelligence updated',d);
  return true;
}
async function load(){
  try{
    var r=await fetch(API+'/api/market-intelligence',{cache:'no-store'}),d=await r.json();
    if(!r.ok||!d.success)throw Error(d.error||('HTTP '+r.status));
    if(!update(d))console.warn('[Strike Pulse] .spmi-page not found; no UI created');
  }catch(e){console.error('[Strike Pulse] Market Intelligence error',e)}
}
function start(){load();setInterval(load,15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();`;

const ORIGINAL_USE=express.application.use;
let installed=false;
express.application.use=function(...args){
  if(!installed){
    installed=true;
    ORIGINAL_USE.call(this,function(req,res,next){
      if(req.method==='GET' && req.path==='/market-intelligence-loader.js'){
        return res.status(200).type('application/javascript').set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store').send(LOADER);
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this,...args);
};
console.log('[MARKET INTELLIGENCE] existing-page loader installed');
