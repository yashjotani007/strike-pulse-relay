(function(){
  const VERSION='20260828-live-02';
  const CSS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/strike-pulse.css';
  const PRICE_JS='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/strike-pulse-prices.js';
  const OPTION_JS='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/js/strike-pulse.js';

  console.log('%c🔥 STRIKE PULSE LOADER ACTIVE','font-weight:bold;font-size:16px');

  function loadCss(){
    const old=document.querySelector('link[data-strike-pulse-master="1"]');
    if(old)old.remove();
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.dataset.strikePulseMaster='1';
    link.href=CSS_URL+'?v='+VERSION+'&t='+Date.now();
    link.onload=()=>console.log('%c✅ STRIKE PULSE CSS ACTIVE','color:#00c853;font-weight:bold');
    link.onerror=()=>console.error('❌ STRIKE PULSE CSS FAILED',link.href);
    document.head.appendChild(link);
  }

  function loadScript(url,name){
    if(document.querySelector('script[data-strike-pulse-name="'+name+'"]'))return;
    const s=document.createElement('script');
    s.src=url+'?v='+VERSION+'&t='+Date.now();
    s.dataset.strikePulseName=name;
    s.async=false;
    s.onload=()=>console.log('%c✅ '+name+' ACTIVE','color:#00c853;font-weight:bold');
    s.onerror=()=>console.error('%c❌ '+name+' FAILED','color:#ef233c;font-weight:bold',s.src);
    document.head.appendChild(s);
  }

  function ensureVwapTable(){
    const section=document.querySelector('.sp-vwap-section');
    if(!section||section.querySelector('.sp-vwap-table-card'))return;
    const card=document.createElement('div');
    card.className='sp-vwap-table-card';
    card.innerHTML='<div class="sp-vwap-table-title">VWAP INTRADAY SNAPSHOT</div><div class="sp-vwap-table-wrap"><table class="sp-vwap-table"><thead><tr><th>TIME</th><th>SPOT</th><th>VWAP</th><th>DIFFERENCE</th><th>BIAS</th></tr></thead><tbody></tbody></table></div>';
    section.appendChild(card);
  }

  function readNum(el){
    if(!el)return null;
    const raw=(el.value??el.textContent??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return raw?Number(raw[0]):null;
  }

  function updateVwapTable(){
    ensureVwapTable();
    const tb=document.querySelector('.sp-vwap-table tbody');
    if(!tb)return;
    const vwap=readNum(document.querySelector('.sp-vwap-value'));
    const spot=readNum(document.querySelector('#spSpot,#sp-chain-spot,.sp-vwap-spot'));
    if(vwap==null&&spot==null)return;
    const diff=spot!=null&&vwap!=null?spot-vwap:null;
    const bias=diff==null?'--':diff>0?'ABOVE VWAP':diff<0?'BELOW VWAP':'AT VWAP';
    const cls=diff==null?'vwap-neutral':diff>0?'vwap-positive':'vwap-negative';
    const time=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    let row=tb.querySelector('tr[data-current="1"]');
    if(!row){row=document.createElement('tr');row.dataset.current='1';tb.prepend(row)}
    row.innerHTML='<td>'+time+'</td><td>'+(spot==null?'--':spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td>'+(vwap==null?'--':vwap.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td class="'+cls+'">'+(diff==null?'--':(diff>=0?'+':'')+diff.toFixed(2))+'</td><td class="'+cls+'">'+bias+'</td>';
  }

  function start(){
    loadCss();
    /* DIRECT LIVE PRICE JS — runs on Home and every page */
    loadScript(PRICE_JS,'LIVE PRICE JS');
    /* OPTION CHAIN JS — exits automatically on non-option pages */
    loadScript(OPTION_JS,'OPTION CHAIN JS');
    setTimeout(updateVwapTable,2500);
    setTimeout(updateVwapTable,5000);
    setInterval(updateVwapTable,30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
