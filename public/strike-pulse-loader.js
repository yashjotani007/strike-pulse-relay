(function(){
  const VERSION='20260826-css-clean-02';
  const CSS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/strike-pulse.css';

  console.log('%c🔥 STRIKE PULSE CSS CLEANUP','font-weight:bold;font-size:16px');
  console.log('🔗 MASTER CSS:',CSS_URL);

  function cleanupOldCss(){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    let removed=0;
    links.forEach(link=>{
      const href=link.href||'';
      if(/strike-pulse/i.test(href)){
        console.log('🗑️ OLD CSS REMOVED:',href);
        link.remove();
        removed++;
      }
    });
    console.log('🧹 Strike Pulse old stylesheet count removed:',removed);
  }

  function report(stage){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    const ours=links.filter(l=>/strike-pulse/i.test(l.href||''));
    const chain=document.querySelector('.sp-option-chain-page');
    const cards=document.querySelectorAll('.sp-market-card');
    const vwap=document.querySelector('.sp-vwap-section');
    console.log('━━━━━━━━ STRIKE PULSE DEBUG ━━━━━━━━');
    console.log('📍 Stage:',stage);
    console.log('📦 Strike Pulse stylesheet links:',ours.length);
    ours.forEach((l,i)=>console.log('   CSS '+(i+1)+':',l.href));
    console.log('🏠 MARKET CARDS FOUND:',cards.length);
    console.log('📊 OPTION CHAIN FOUND:',!!chain);
    console.log('📈 VWAP SECTION FOUND:',!!vwap);
    if(chain){
      const s=getComputedStyle(chain);
      console.log('🎨 OPTION CHAIN STYLE:',{background:s.backgroundColor,color:s.color,maxWidth:s.maxWidth,borderRadius:s.borderRadius});
    }
    if(cards[0]){
      const s=getComputedStyle(cards[0]);
      console.log('🎨 MARKET CARD STYLE:',{background:s.backgroundColor,color:s.color,border:s.border,borderRadius:s.borderRadius});
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  function loadMasterCss(){
    const href=CSS_URL+'?v='+VERSION+'&t='+Date.now();
    const existing=document.querySelector('link[data-strike-pulse-master="1"]');
    if(existing) existing.remove();

    console.log('⏳ Loading MASTER CSS:',href);
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.strikePulseMaster='1';
    link.onload=function(){
      console.log('%c✅ MASTER CSS ACTIVE','color:#00c853;font-weight:bold');
      console.log('📦 CSS FILE LOADED: strike-pulse.css');
      report('MASTER CSS LOADED');
    };
    link.onerror=function(){
      console.error('%c❌ MASTER CSS FAILED','color:#ef233c;font-weight:bold',href);
      report('MASTER CSS FAILED');
    };
    document.head.appendChild(link);
  }

  function findVwap(){
    return document.querySelector('.sp-vwap-value,[data-vwap-value],[data-vwap],#sp-vwap,#spVwap,#sp-vwap-price,#spVwapPrice');
  }

  function findSpot(){
    return document.querySelector('#sp-chain-spot,[data-vwap-spot],.sp-vwap-spot,#spSpot,.sp-spot-value');
  }

  function readNum(el){
    if(!el) return null;
    const raw=(el.value??el.textContent??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return raw?Number(raw[0]):null;
  }

  function ensureVwapTable(){
    const section=document.querySelector('.sp-vwap-section');
    if(!section||section.querySelector('.sp-vwap-table-card')) return;
    const card=document.createElement('div');
    card.className='sp-vwap-table-card';
    card.innerHTML='<div class="sp-vwap-table-title">VWAP INTRADAY SNAPSHOT</div><div class="sp-vwap-table-wrap"><table class="sp-vwap-table"><thead><tr><th>TIME</th><th>SPOT</th><th>VWAP</th><th>DIFFERENCE</th><th>BIAS</th></tr></thead><tbody></tbody></table></div>';
    section.appendChild(card);
    console.log('✅ VWAP TABLE INJECTED');
  }

  function updateVwapTable(){
    ensureVwapTable();
    const tb=document.querySelector('.sp-vwap-table tbody');
    if(!tb) return;
    const vwap=readNum(findVwap());
    const spot=readNum(findSpot())??readNum(document.querySelector('#spSpot'));
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
    console.log('🔥 STRIKE PULSE LOADER STARTED');
    console.log('✅ WORDPRESS LOADER RUNNING');
    report('BEFORE CLEANUP');
    cleanupOldCss();
    loadMasterCss();
    setTimeout(function(){report('2 SECONDS AFTER CSS');ensureVwapTable();updateVwapTable()},2000);
    setTimeout(function(){report('5 SECONDS AFTER CSS');ensureVwapTable();updateVwapTable()},5000);
    setInterval(updateVwapTable,30000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();