(function(){
  const VERSION='20260826-kadence-ui-01';
  const CSS_BASE='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/';
  const RELAY_BASE='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  console.log('🔥 STRIKE PULSE KADENCE LOADER');

  function report(){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    const ours=links.filter(l=>/strike-pulse/i.test(l.href));
    console.log('📦 Strike Pulse stylesheet links:',ours.length);
    console.log('📦 MARKET CARDS FOUND:',document.querySelectorAll('.sp-market-card').length);
    console.log('📊 VWAP SECTION FOUND:',!!document.querySelector('.sp-vwap-section'));
    console.log('📋 OPTION TABLE FOUND:',!!document.querySelector('.sp-option-chain-table'));
  }

  function addCss(file){
    const href=CSS_BASE+file+'?v='+VERSION+'&t='+Date.now();
    [...document.querySelectorAll('link[data-strike-pulse-css]')]
      .filter(x=>x.dataset.strikePulseFile===file)
      .forEach(x=>x.remove());
    const el=document.createElement('link');
    el.rel='stylesheet';
    el.href=href;
    el.dataset.strikePulseCss='1';
    el.dataset.strikePulseFile=file;
    el.onload=()=>{console.log('✅ STRIKE PULSE CSS LOADED:',href);report()};
    el.onerror=()=>console.error('❌ STRIKE PULSE CSS FAILED:',href);
    document.head.appendChild(el);
  }

  function findVwap(){
    return document.querySelector('.sp-vwap-value,[data-vwap-value],[data-vwap],#sp-vwap,#spVwap,#sp-vwap-price,#spVwapPrice');
  }
  function findSpot(){
    return document.querySelector('#sp-chain-spot,[data-vwap-spot],.sp-vwap-spot,#spSpot,.sp-spot-value');
  }
  function readNum(el){
    if(!el)return null;
    const raw=(el.value??el.textContent??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return raw?Number(raw[0]):null;
  }
  function ensureVwapTable(){
    const section=document.querySelector('.sp-vwap-section');
    if(!section||section.querySelector('.sp-vwap-table-card'))return;
    const card=document.createElement('div');
    card.className='sp-vwap-table-card';
    card.innerHTML='<div class="sp-vwap-table-title">VWAP INTRADAY SNAPSHOT</div><div class="sp-vwap-table-wrap"><table class="sp-vwap-table"><thead><tr><th>TIME</th><th>SPOT</th><th>VWAP</th><th>DIFFERENCE</th><th>BIAS</th></tr></thead><tbody></tbody></table></div>';
    section.appendChild(card);
  }
  function updateVwapTable(){
    ensureVwapTable();
    const tb=document.querySelector('.sp-vwap-table tbody');
    if(!tb)return;
    const vwap=readNum(findVwap());
    const spot=readNum(findSpot()) ?? readNum(document.querySelector('#spSpot'));
    if(vwap==null&&spot==null)return;
    const diff=(spot!=null&&vwap!=null)?spot-vwap:null;
    const bias=diff==null?'--':diff>0?'ABOVE VWAP':diff<0?'BELOW VWAP':'AT VWAP';
    const cls=diff==null?'vwap-neutral':diff>0?'vwap-positive':'vwap-negative';
    const time=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    let row=tb.querySelector('tr[data-current="1"]');
    if(!row){row=document.createElement('tr');row.dataset.current='1';tb.prepend(row)}
    row.innerHTML='<td>'+time+'</td><td>'+(spot==null?'--':spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td>'+(vwap==null?'--':vwap.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td class="'+cls+'">'+(diff==null?'--':(diff>=0?'+':'')+diff.toFixed(2))+'</td><td class="'+cls+'">'+bias+'</td>';
  }
  function start(){
    console.log('✅ WORDPRESS LOADER RUNNING');
    addCss('strike-pulse.css');
    /* Keep the relay CSS only for components that are not in the main UI stylesheet. */
    setTimeout(()=>{ensureVwapTable();updateVwapTable();report()},1200);
    setTimeout(()=>{ensureVwapTable();updateVwapTable();report()},3000);
    setInterval(updateVwapTable,30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
