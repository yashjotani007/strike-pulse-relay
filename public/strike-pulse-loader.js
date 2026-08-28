(function(){
  const VERSION='20260828-live-01';
  const CSS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/strike-pulse.css';
  const JS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/js/strike-pulse.js';

  console.log('%c🔥 STRIKE PULSE LOADER','font-weight:bold;font-size:16px');
  console.log('🎨 MASTER CSS:',CSS_URL);
  console.log('⚡ MASTER JS:',JS_URL);

  function cleanupOld(){
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
      const href=link.href||'';
      if(/strike-pulse/i.test(href) && !link.dataset.strikePulseKeep){
        link.remove();
      }
    });
    document.querySelectorAll('script[data-strike-pulse-master="1"]').forEach(s=>s.remove());
  }

  function loadCss(){
    return new Promise((resolve,reject)=>{
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.dataset.strikePulseKeep='1';
      link.href=CSS_URL+'?v='+VERSION+'&t='+Date.now();
      link.onload=()=>{console.log('%c✅ STRIKE PULSE CSS ACTIVE','color:#00c853;font-weight:bold');resolve()};
      link.onerror=()=>{console.error('❌ STRIKE PULSE CSS FAILED',link.href);reject(new Error('CSS failed'))};
      document.head.appendChild(link);
    });
  }

  function loadJs(){
    if(document.querySelector('script[data-strike-pulse-master="1"]')) return;
    const script=document.createElement('script');
    script.src=JS_URL+'?v='+VERSION+'&t='+Date.now();
    script.dataset.strikePulseMaster='1';
    script.defer=true;
    script.onload=()=>console.log('%c✅ STRIKE PULSE PRICE/OPTION JS ACTIVE','color:#00c853;font-weight:bold');
    script.onerror=()=>console.error('%c❌ STRIKE PULSE JS FAILED','color:#ef233c;font-weight:bold',script.src);
    document.head.appendChild(script);
  }

  function ensureVwapTable(){
    const section=document.querySelector('.sp-vwap-section');
    if(!section||section.querySelector('.sp-vwap-table-card')) return;
    const card=document.createElement('div');
    card.className='sp-vwap-table-card';
    card.innerHTML='<div class="sp-vwap-table-title">VWAP INTRADAY SNAPSHOT</div><div class="sp-vwap-table-wrap"><table class="sp-vwap-table"><thead><tr><th>TIME</th><th>SPOT</th><th>VWAP</th><th>DIFFERENCE</th><th>BIAS</th></tr></thead><tbody></tbody></table></div>';
    section.appendChild(card);
  }

  function readNum(el){
    if(!el) return null;
    const raw=(el.value??el.textContent??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return raw?Number(raw[0]):null;
  }

  function updateVwapTable(){
    ensureVwapTable();
    const tb=document.querySelector('.sp-vwap-table tbody');
    if(!tb) return;
    const vwap=readNum(document.querySelector('.sp-vwap-value'));
    const spot=readNum(document.querySelector('#spSpot,#sp-chain-spot,.sp-vwap-spot'));
    if(vwap==null&&spot==null) return;
    const diff=spot!=null&&vwap!=null?spot-vwap:null;
    const bias=diff==null?'--':diff>0?'ABOVE VWAP':diff<0?'BELOW VWAP':'AT VWAP';
    const cls=diff==null?'vwap-neutral':diff>0?'vwap-positive':'vwap-negative';
    const time=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    let row=tb.querySelector('tr[data-current="1"]');
    if(!row){row=document.createElement('tr');row.dataset.current='1';tb.prepend(row)}
    row.innerHTML='<td>'+time+'</td><td>'+(spot==null?'--':spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td>'+(vwap==null?'--':vwap.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td class="'+cls+'">'+(diff==null?'--':(diff>=0?'+':'')+diff.toFixed(2))+'</td><td class="'+cls+'">'+bias+'</td>';
  }

  function start(){
    cleanupOld();
    loadCss().catch(()=>{});
    loadJs();
    setTimeout(updateVwapTable,2500);
    setTimeout(updateVwapTable,5000);
    setInterval(updateVwapTable,30000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
