(function(){
  const API='https://strike-pulse-relay.onrender.com/api/prices';
  const markets={nifty:['nifty','nifty50'],banknifty:['banknifty','bankNifty'],finnifty:['finnifty','finNifty'],sensex:['sensex','SENSEX','bseSensex','bse_sensex'],vix:['vix','indiaVix','india_vix','INDIA_VIX']};
  const fmt=v=>Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const clean=s=>(s||'').replace(/\s+/g,' ').trim().toUpperCase();
  function updateCard(key,price,change){
    if(price==null||price===''){console.error('❌ '+key.toUpperCase()+' PRICE MISSING');return 0}
    const value=fmt(price);let found=0;
    // First use explicit selectors.
    const sels=['[data-market="'+key+'"] .sp-price','[data-market="'+key+'"] .sp-market-price','[data-price="'+key+'"]','#sp-'+key+'-price','#sp'+key.charAt(0).toUpperCase()+key.slice(1)+'Price'];
    sels.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.textContent=value;el.style.visibility='visible';el.style.opacity='1';found++}));
    // Home cards: identify by their visible label, then update only the value element.
    document.querySelectorAll('.sp-market-card').forEach(card=>{
      const t=clean(card.innerText);
      const match=(key==='nifty'&&(t.includes('NIFTY 50')||t.includes('NIFTY')))||
        (key==='banknifty'&&t.includes('BANK NIFTY'))||(key==='banknifty'&&t.includes('BANKNIFTY'))||
        (key==='finnifty'&&t.includes('FIN NIFTY'))||(key==='finnifty'&&t.includes('FINNIFTY'))||
        (key==='sensex'&&t.includes('SENSEX'))||(key==='vix'&&(t.includes('INDIA VIX')||t.includes('VIX')));
      if(!match)return;
      const candidates=[...card.querySelectorAll('.sp-price,.sp-market-price,.sp-value,.market-price,.price,.value,strong,h2,h3,.elementor-heading-title')];
      let target=candidates.find(e=>/^(--|—|LOADING|N\/A|0(?:\.0+)?)$/i.test(clean(e.textContent)));
      if(!target)target=candidates.find(e=>!clean(e.textContent).includes(key.toUpperCase())&&e.children.length===0&&e.textContent.trim().length<30);
      if(target){target.textContent=value;target.style.visibility='visible';target.style.opacity='1';found++}
      if(change!=null){const ch=Number(change);const ce=card.querySelector('.sp-market-change,.sp-change,[data-change]');if(ce&&!Number.isNaN(ch)){ce.textContent=(ch>0?'▲ +':ch<0?'▼ ':'● ')+ch.toFixed(2)+'%';ce.classList.toggle('positive',ch>0);ce.classList.toggle('negative',ch<0)}}
    });
    console.log((found?'✅ ':'⚠️ ')+key.toUpperCase()+' PRICE:',value,'HOME MATCHES:',found);
    return found;
  }
  async function load(){
    console.log('🔄 STRIKE PULSE HOME PRICE CHECK');
    try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});console.log('🌐 PRICE API:',r.status);if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const d=j?.data&&typeof j.data==='object'?j.data:j;console.log('📦 API:',d);let total=0;for(const k of Object.keys(markets)){const p=markets[k].map(x=>d?.[x]).find(v=>v!=null&&v!=='');const c=markets[k].map(x=>d?.[x+'Change']).find(v=>v!=null&&v!=='');total+=updateCard(k,p,c)}console.log('📊 HOME CARDS UPDATED:',total)}catch(e){console.error('❌ HOME PRICE ERROR:',e)}}
  function start(){console.log('🚀 STRIKE PULSE HOME PRICE JS STARTED');load();setInterval(load,5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();