/* Strike Pulse root loader — intentionally self-contained for GitHub Pages */
(function(){
  'use strict';
  if (window.__StrikePulseRootLoaded) return;
  window.__StrikePulseRootLoaded = true;
  console.log('[StrikePulse] ROOT JS LOADED');

  var API='https://strike-pulse-relay.onrender.com/api/prices';
  var started=false;

  function text(el,value){ if(el) el.textContent=value; }
  function fmtPrice(v){
    if(v===null || v===undefined || v==='') return '—';
    var n=Number(v); return Number.isFinite(n) ? n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) : String(v);
  }
  function fmtChange(v){
    if(v===null || v===undefined || v==='') return '—';
    var n=Number(v); if(!Number.isFinite(n)) return String(v);
    return (n>0?'+':'')+n.toFixed(2)+'%';
  }

  async function updatePrices(){
    try{
      console.log('[StrikePulse] requesting prices');
      var r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      var j=await r.json();
      console.log('[StrikePulse] prices response received');
      var d=j && (j.data || j.markets || j);
      var markets=j && j.markets;
      if(!d) throw new Error('empty response');

      var values={
        nifty: markets&&markets.nifty ? markets.nifty : {price:d.nifty,change:d.niftyChange},
        banknifty: markets&&markets.banknifty ? markets.banknifty : {price:d.banknifty,change:d.bankniftyChange},
        finnifty: markets&&markets.finnifty ? markets.finnifty : {price:d.finnifty,change:d.finniftyChange},
        vix: markets&&markets.vix ? markets.vix : {price:d.vix,change:d.vixChange},
        sensex: markets&&markets.sensex ? markets.sensex : {price:d.sensex,change:d.sensexChange}
      };

      document.querySelectorAll('.sp-market-card[data-market-card]').forEach(function(card){
        var key=(card.getAttribute('data-market-card')||'').toLowerCase();
        var item=values[key]; if(!item) return;
        text(card.querySelector('.sp-price'),fmtPrice(item.price));
        var change=card.querySelector('.sp-change');
        text(change,fmtChange(item.change));
        if(change){
          change.classList.remove('sp-positive','sp-negative','sp-flat');
          var c=Number(item.change);
          change.classList.add(Number.isFinite(c)?(c>0?'sp-positive':c<0?'sp-negative':'sp-flat'):'sp-flat');
        }
        text(card.querySelector('.sp-updated'),d.updated ? ('Updated '+new Date(d.updated).toLocaleTimeString()) : 'Live');
        text(card.querySelector('.sp-market-status'),'LIVE');
      });
      console.log('[StrikePulse] ROOT LIVE PRICES UPDATED');
    }catch(e){
      console.error('[StrikePulse] ROOT PRICE ERROR:',e);
      document.querySelectorAll('.sp-market-status').forEach(function(el){ text(el,'API ERROR'); });
    }
  }

  function start(){
    if(started) return; started=true;
    updatePrices();
    setInterval(updatePrices,5000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

/* Option-chain functionality */
(function(){
  'use strict';
  if(window.__StrikePulseOptionChainLoaded) return;
  window.__StrikePulseOptionChainLoaded=true;
  var BASE='https://strike-pulse-relay.onrender.com/api';
  var body=document.getElementById('spOptionChainBody');
  if(!body) return;

  function fmt(v){ return v===null||v===undefined||v===''?'—':Number.isFinite(Number(v))?Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}):String(v); }
  async function load(sym){
    try{
      var r=await fetch(BASE+'/option-chain?symbol='+encodeURIComponent(sym)+'&t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      var j=await r.json();
      var rows=j.rows||j.data||[];
      if(!Array.isArray(rows)) rows=[];
      body.innerHTML=rows.map(function(x){
        return '<tr><td>'+fmt(x.callOI)+'</td><td>'+fmt(x.callOIChange)+'</td><td>'+fmt(x.callLTP)+'</td><td>'+fmt(x.callIV)+'</td><td>'+fmt(x.callVolume)+'</td><td><b>'+fmt(x.strike)+'</b></td><td>'+fmt(x.putLTP)+'</td><td>'+fmt(x.putIV)+'</td><td>'+fmt(x.putVolume)+'</td><td>'+fmt(x.putOIChange)+'</td><td>'+fmt(x.putOI)+'</td></tr>';
      }).join('');
    }catch(e){ console.error('[StrikePulse] OPTION CHAIN ERROR:',e); }
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-symbol],.sp-quick-symbol');
    if(!b) return;
    var sym=b.getAttribute('data-symbol')||b.dataset.symbol||b.textContent.trim();
    if(sym) load(sym);
  });
  document.addEventListener('DOMContentLoaded',function(){
    var first=document.querySelector('[data-symbol="NIFTY"],.sp-quick-symbol');
    if(first) load(first.getAttribute('data-symbol')||first.textContent.trim());
    else load('NIFTY');
  },{once:true});
})();
