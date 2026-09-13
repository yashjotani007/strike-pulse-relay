/* Strike Pulse — isolated Market Intelligence frontend. */
(function(){
  'use strict';
  if(window.__SP_MARKET_INTELLIGENCE__) return;
  window.__SP_MARKET_INTELLIGENCE__=true;

  const API=(window.STRIKE_PULSE_API||'https://strike-pulse-relay.onrender.com').replace(/\/$/,'');
  const symbols=[['NIFTY','NIFTY'],['BANKNIFTY','BANK NIFTY'],['FINNIFTY','FIN NIFTY'],['SENSEX','SENSEX'],['VIX','INDIA VIX']];

  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
  function fmt(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}):'—';}
  function cls(momentum){return /BULLISH/.test(momentum)?'positive':/BEARISH/.test(momentum)?'negative':'neutral';}
  function pct(v){if(!Number.isFinite(Number(v))) return '—'; const n=Number(v); return (n>=0?'+':'')+n.toFixed(2)+'%';}

  function ensure(){
    let el=document.getElementById('sp-market-intelligence');
    if(el) return el;
    el=document.createElement('section');
    el.id='sp-market-intelligence';
    el.className='sp-mi-loading';
    el.innerHTML='<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status">LOADING</div></div><div>Loading market intelligence…</div>';
    const target=document.querySelector('main')||document.querySelector('.site-main')||document.body;
    target.prepend(el);
    return el;
  }

  function render(data){
    const el=ensure();
    const regime=data.regime||{};
    const indices=data.indices||{};
    const breadth=data.breadth||{};
    const names={NIFTY:'NIFTY',BANKNIFTY:'BANK NIFTY',FINNIFTY:'FIN NIFTY',SENSEX:'SENSEX',VIX:'INDIA VIX'};
    let cards='';
    symbols.forEach(([key])=>{
      const x=indices[key]||{}; const m=x.momentum||'UNKNOWN';
      const change=x.changePercent;
      cards+=`<div class="sp-mi-card ${cls(m)}"><div class="sp-mi-name">${names[key]}</div><div class="sp-mi-price">${fmt(x.value)}</div><div class="sp-mi-change">${pct(change)}</div><div class="sp-mi-momentum">${esc(m.replaceAll('_',' '))}</div></div>`;
    });
    const signals=Array.isArray(data.signals)?data.signals:[];
    el.className='';
    el.innerHTML=`<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status ${data.marketStatus==='LIVE'?'live':'closed'}">${esc(data.marketStatus||'UNKNOWN')}</div></div>
      <div class="sp-mi-regime"><div><div class="sp-mi-regime-label">Overall Market Regime</div><div class="sp-mi-regime-value">${esc(regime.label||'UNKNOWN')}</div></div><div class="sp-mi-score">Score ${fmt(regime.score)}</div></div>
      <div class="sp-mi-grid">${cards}</div>
      <div class="sp-mi-signals"><div class="sp-mi-signals-title">Live Signals</div>${signals.length?signals.map(s=>`<div class="sp-mi-signal">${esc(s)}</div>`).join(''):'<div class="sp-mi-signal">No additional signals available.</div>'}</div>
      <div class="sp-mi-foot">Source: ${esc(data.source||'Strike Pulse')} · Updated ${data.updated?new Date(data.updated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}</div>`;
  }

  async function load(){
    try{
      const r=await fetch(API+'/api/market-intelligence',{cache:'no-store'});
      const data=await r.json();
      if(!r.ok||!data.success) throw new Error(data.error||('HTTP '+r.status));
      render(data);
      return data;
    }catch(e){
      const el=ensure();
      el.className='';
      el.innerHTML='<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status closed">OFFLINE</div></div><div class="sp-mi-error">Market Intelligence is temporarily unavailable. Please refresh once the data source is reachable.</div>';
      console.error('[Strike Pulse Market Intelligence]',e);
    }
  }

  function start(){load();setInterval(load,15000);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
