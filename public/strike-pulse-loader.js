(function(){
  const VERSION='20260826-debug-01';
  const CSS_BASE='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/';
  console.log('%c🔥 STRIKE PULSE DEBUG LOADER','font-weight:bold;font-size:16px');
  console.log('🔗 CSS BASE:',CSS_BASE);

  function report(stage){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    const ours=links.filter(l=>/strike-pulse/i.test(l.href));
    const chain=document.querySelector('.sp-option-chain-page');
    const table=document.querySelector('.sp-option-chain-table');
    const cards=document.querySelectorAll('.sp-market-card');
    console.log('━━━━━━━━ STRIKE PULSE DEBUG ━━━━━━━━');
    console.log('📍 Stage:',stage);
    console.log('📦 CSS links:',ours.length);
    ours.forEach((l,i)=>console.log('   CSS '+(i+1)+':',l.href));
    console.log('🏠 Market cards:',cards.length);
    console.log('📊 Option Chain:',!!chain);
    console.log('📋 Option table:',!!table);
    console.log('📈 VWAP section:',!!document.querySelector('.sp-vwap-section'));
    if(chain){
      const s=getComputedStyle(chain);
      console.log('🎨 Option Chain computed:',{background:s.backgroundColor,color:s.color,width:s.width});
    }
    if(cards[0]){
      const s=getComputedStyle(cards[0]);
      console.log('🎨 First card computed:',{background:s.backgroundColor,border:s.border,color:s.color});
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  function addCss(file){
    const href=CSS_BASE+file+'?v='+VERSION+'&t='+Date.now();
    console.log('⏳ Loading CSS:',href);
    const el=document.createElement('link');
    el.rel='stylesheet';
    el.href=href;
    el.dataset.strikePulseCss='1';
    el.dataset.strikePulseFile=file;
    el.onload=function(){
      console.log('%c✅ STRIKE PULSE CSS LOADED','color:#00c853;font-weight:bold',href);
      report('CSS LOADED');
    };
    el.onerror=function(){
      console.error('%c❌ STRIKE PULSE CSS FAILED','color:#ef233c;font-weight:bold',href);
      report('CSS FAILED');
    };
    document.head.appendChild(el);
  }

  function findVwap(){return document.querySelector('.sp-vwap-value,[data-vwap-value],[data-vwap],#sp-vwap,#spVwap,#sp-vwap-price,#spVwapPrice')}
  function findSpot(){return document.querySelector('#sp-chain-spot,[data-vwap-spot],.sp-vwap-spot,#spSpot,.sp-spot-value')}
  function readNum(el){if(!el)return null;const raw=(el.value??el.textContent??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return raw?Number(raw[0]):null}
  function ensureVwapTable(){const section=document.querySelector('.sp-vwap-section');if(!section||section.querySelector('.sp-vwap-table-card'))return;const card=document.createElement('div');card.className='sp-vwap-table-card';card.innerHTML='<div class="sp-vwap-table-title">VWAP INTRADAY SNAPSHOT</div><div class="sp-vwap-table-wrap"><table class="sp-vwap-table"><thead><tr><th>TIME</th><th>SPOT</th><th>VWAP</th><th>DIFFERENCE</th><th>BIAS</th></tr></thead><tbody></tbody></table></div>';section.appendChild(card);console.log('✅ VWAP TABLE INJECTED')}
  function updateVwapTable(){ensureVwapTable();const tb=document.querySelector('.sp-vwap-table tbody');if(!tb)return;const vwap=readNum(findVwap());const spot=readNum(findSpot())??readNum(document.querySelector('#spSpot'));if(vwap==null&&spot==null)return;const diff=spot!=null&&vwap!=null?spot-vwap:null;const bias=diff==null?'--':diff>0?'ABOVE VWAP':diff<0?'BELOW VWAP':'AT VWAP';const cls=diff==null?'vwap-neutral':diff>0?'vwap-positive':'vwap-negative';const time=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());let row=tb.querySelector('tr[data-current="1"]');if(!row){row=document.createElement('tr');row.dataset.current='1';tb.prepend(row)}row.innerHTML='<td>'+time+'</td><td>'+(spot==null?'--':spot.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td>'+(vwap==null?'--':vwap.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td class="'+cls+'">'+(diff==null?'--':(diff>=0?'+':'')+diff.toFixed(2))+'</td><td class="'+cls+'">'+bias+'</td>'}
  function start(){
    console.log('✅ WORDPRESS LOADER RUNNING');
    report('BEFORE CSS');
    addCss('strike-pulse.css');
    setTimeout(()=>{report('2 SECONDS AFTER LOAD');ensureVwapTable();updateVwapTable()},2000);
    setTimeout(()=>{report('5 SECONDS AFTER LOAD');ensureVwapTable();updateVwapTable()},5000);
    setInterval(updateVwapTable,30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();