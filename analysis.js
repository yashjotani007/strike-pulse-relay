(function(){
'use strict';

if(window.__StrikePulseAnalysisLoaded)return;
window.__StrikePulseAnalysisLoaded=true;

const API='https://strike-pulse-relay.onrender.com/api';
const $=id=>document.getElementById(id);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=v=>{const n=num(v);return n==null?'--':n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})};
const pct=v=>{const n=num(v);return n==null?'--':(n>=0?'+':'')+n.toFixed(2)+'%'};
const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
const cls=(e,n)=>{if(!e)return;e.classList.remove('sp-positive','sp-negative','sp-neutral');if(n>0)e.classList.add('sp-positive');else if(n<0)e.classList.add('sp-negative');else e.classList.add('sp-neutral')};

function momentum(change){const n=num(change);if(n==null)return'--';if(n>=.5)return'STRONG BULLISH';if(n>=.1)return'BULLISH';if(n<=-.5)return'STRONG BEARISH';if(n<=-.1)return'BEARISH';return'NEUTRAL'}
function pressure(score){const n=num(score);return n==null?50:Math.max(0,Math.min(100,(n+100)/2))}
function breadthState(b){if(!b)return'--';const a=num(b.advances)||0,d=num(b.declines)||0;return a>d?'POSITIVE':d>a?'NEGATIVE':'BALANCED'}
function volatility(v){const n=num(v&&v.change);if(n==null)return'--';return n>3?'ELEVATED':n<-3?'EASING':'MODERATE'}
function note(change){const n=num(change);if(n==null)return'Monitoring';if(n>.5)return'Strong positive momentum';if(n>.1)return'Positive pressure';if(n<-.5)return'Strong negative momentum';if(n<-.1)return'Negative pressure';return'Near-flat movement'}

function updateIndex(key,priceId,changeId){return function(d){const q=d.indices&&d.indices[key]||{};set(priceId,fmt(q.price));const c=$(changeId);if(c){c.textContent=pct(q.change);cls(c,num(q.change))}return q}}

function render(d){
 const i=d.indices||{}, r=d.regime||{}, b=d.breadth||{};
 const score=pressure(r.score);
 const session=d.market&&d.market.session||'CLOSED';
 set('analysis-status',session);
 set('analysis-updated',d.generatedAt?new Date(d.generatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--');
 set('analysis-regime',r.label||'UNKNOWN');
 set('analysis-score',Math.round(score));
 set('analysis-regime-text',r.label==='BULLISH'?'Market pressure is broadly positive across the tracked indices.':r.label==='BEARISH'?'Market pressure is broadly negative across the tracked indices.':r.label==='MIXED'?'Major indices are giving mixed signals; monitor confirmation.':'Market intelligence is still being processed.');
 set('analysis-pressure-label',Math.round(score)+'%');
 const fill=$('analysis-pressure-fill'),dot=$('analysis-pressure-dot');if(fill)fill.style.width=score+'%';if(dot)dot.style.left=score+'%';

 const m=i.nifty&&i.nifty.change, bm=i.banknifty&&i.banknifty.change, fm=i.finnifty&&i.finnifty.change, sm=i.sensex&&i.sensex.change;
 set('analysis-momentum',r.averageChange==null?'--':momentum(r.averageChange));
 set('momentum-pressure',r.averageChange==null?'--':Math.round(pressure(r.averageChange*45))+'%');
 set('breadth-pressure',b.total?Math.round(((b.advances||0)/b.total)*100)+'%':'--');
 set('volatility-pressure',i.vix&&i.vix.change!=null?Math.min(100,Math.max(0,Math.round(50+(num(i.vix.change)*5))))+'%':'--');
 set('analysis-breadth',breadthState(b));
 set('analysis-volatility',volatility(i.vix));
 const mf=$('momentum-fill'),bf=$('breadth-fill'),vf=$('volatility-fill');if(mf)mf.style.width=(r.averageChange==null?50:pressure(r.averageChange*45))+'%';if(bf)bf.style.width=(b.total?((b.advances||0)/b.total*100):50)+'%';if(vf)vf.style.width=(i.vix&&i.vix.change!=null?Math.min(100,Math.max(0,50+num(i.vix.change)*5)):50)+'%';

 [['nifty','analysis-nifty','analysis-nifty-change','table-nifty','table-nifty-change','table-nifty-momentum','table-nifty-note'],['banknifty','analysis-banknifty','analysis-banknifty-change','table-banknifty','table-banknifty-change','table-banknifty-momentum','table-banknifty-note'],['finnifty','analysis-finnifty','analysis-finnifty-change','table-finnifty','table-finnifty-change','table-finnifty-momentum','table-finnifty-note'],['sensex','analysis-sensex','analysis-sensex-change','table-sensex','table-sensex-change','table-sensex-momentum','table-sensex-note']].forEach(x=>{const q=i[x[0]]||{};set(x[1],fmt(q.price));set(x[2],pct(q.change));set(x[3],fmt(q.price));set(x[4],pct(q.change));set(x[5],momentum(q.change));set(x[6],note(q.change));cls($(x[2]),num(q.change));cls($(x[4]),num(q.change));cls($(x[5]),num(q.change));});

 set('analysis-vix',fmt(i.vix&&i.vix.price));set('analysis-vix-change',pct(i.vix&&i.vix.change));set('analysis-vix-state',volatility(i.vix));set('vix-gauge-text',i.vix&&i.vix.price!=null?Number(i.vix.price).toFixed(2):'VIX');cls($('analysis-vix-change'),num(i.vix&&i.vix.change));

 set('breadth-state',breadthState(b));set('advances-value',b.advances==null?'--':b.advances);set('declines-value',b.declines==null?'--':b.declines);set('unchanged-value',b.unchanged==null?'--':b.unchanged);
 const total=(b.advances||0)+(b.declines||0)+(b.unchanged||0);[['advances-bar',b.advances],['declines-bar',b.declines],['unchanged-bar',b.unchanged]].forEach(x=>{const e=$(x[0]);if(e)e.style.height=(total?Math.max(8,(x[1]||0)/total*100):8)+'%'});

 const signals=Array.isArray(d.signals)?d.signals:[];const box=$('analysis-signals');if(box){box.innerHTML=signals.length?signals.map(s=>'<div class="sp-signal-item"><span class="sp-signal-indicator"></span><span>'+String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</span></div>').join(''):'<div class="sp-signal-item"><span class="sp-signal-indicator"></span><span>No new market signal is available.</span></div>'}
 set('analysis-summary',signals.length?signals.join('. ')+'.':'Current market intelligence is available; monitor the latest index, breadth and volatility readings.');

 // Option-chain metrics are populated separately when the existing API responds.
 loadOptionChain();
}

async function loadOptionChain(){
 try{
  const r=await fetch(API+'/option-chain?symbol=NIFTY&t='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(!d||!d.success)throw Error('Unavailable');
  set('analysis-call-oi',num(d.callOI)!=null?Number(d.callOI).toLocaleString('en-IN'):'--');
  set('analysis-put-oi',num(d.putOI)!=null?Number(d.putOI).toLocaleString('en-IN'):'--');
  set('analysis-pcr',num(d.pcr)!=null?Number(d.pcr).toFixed(2):'--');
  set('analysis-max-pain',num(d.maxPain)!=null?Number(d.maxPain).toLocaleString('en-IN'):'--');
 }catch(e){
  // Keep placeholders rather than inventing option-chain values.
  console.warn('[StrikePulse Analysis] Option-chain metrics unavailable:',e.message);
 }
}

async function load(){
 try{
  const r=await fetch(API+'/market-intelligence?t='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(!d.success)throw Error(d.error||'Market Intelligence unavailable');
  render(d);
 }catch(e){console.error('[StrikePulse Analysis] data error:',e)}
}

function start(){if(!document.querySelector('.sp-analysis-page'))return;load();setInterval(load,15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();