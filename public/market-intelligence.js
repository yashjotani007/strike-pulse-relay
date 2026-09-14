/* Strike Pulse — isolated Market Intelligence frontend. */
(function(){
  'use strict';
  if(window.__SP_MARKET_INTELLIGENCE__) return;
  window.__SP_MARKET_INTELLIGENCE__=true;

  const API=(window.STRIKE_PULSE_API||'https://strike-pulse-relay.onrender.com').replace(/\/$/,'');
  const symbols=[['nifty','NIFTY'],['banknifty','BANK NIFTY'],['finnifty','FIN NIFTY'],['sensex','SENSEX'],['vix','INDIA VIX']];

  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
  function fmt(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}):'—';}
  function cls(direction){return /BULLISH/.test(direction)?'positive':/BEARISH/.test(direction)?'negative':'neutral';}
  function pct(v){if(!Number.isFinite(Number(v))) return '—'; const n=Number(v); return (n>=0?'+':'')+n.toFixed(2)+'%';}
  function label(v){return String(v||'UNKNOWN').replaceAll('_',' ');}

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
    let cards='';
    symbols.forEach(([key,name])=>{
      const x=indices[key]||{};
      const direction=x.direction||'UNKNOWN';
      cards+=`<div class="sp-mi-card ${cls(direction)}"><div class="sp-mi-name">${name}</div><div class="sp-mi-price">${fmt(x.price)}</div><div class="sp-mi-change">${pct(x.change)}</div><div class="sp-mi-momentum">${esc(label(direction))}</div></div>`;
    });
    const signals=Array.isArray(data.signals)?data.signals:[];
    const session=data.market?.session||'UNKNOWN';
    const breadthText=breadth&&Number.isFinite(Number(breadth.advances))?`Adv ${breadth.advances} · Dec ${breadth.declines} · Unch ${breadth.unchanged}`:'';
    el.className='';
    el.innerHTML=`<div class="sp-mi-head"><div><div class="sp-mi-title">Market Intelligence</div><div class="sp-mi-sub">Cross-index momentum, breadth & volatility regime</div></div><div class="sp-mi-status ${session==='LIVE'?'live':'closed'}">${esc(session)}</div></div>
      <div class="sp-mi-regime"><div><div class="sp-mi-regime-label">Overall Market Regime</div><div class="sp-mi-regime-value">${esc(regime.label||'UNKNOWN')}</div></div><div class="sp-mi-score">Score ${fmt(regime.score)}</div></div>
      <div class="sp-mi-grid">${cards}</div>
      <div class="sp-mi-breadth">${breadthText||'NIFTY 50 breadth unavailable'}</div>
      <div class="sp-mi-signals"><div class="sp-mi-signals-title">Live Signals</div>${signals.length?signals.map(s=>`<div class="sp-mi-signal">${esc(s)}</div>`).join(''):'<div class="sp-mi-signal">No additional signals available.</div>'}</div>
      <div class="sp-mi-foot">Source: ${esc(data.source||'Strike Pulse')} · Updated ${data.generatedAt?new Date(data.generatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}</div>`;
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
