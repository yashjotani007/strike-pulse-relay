(function(){
  const VERSION='20260825-vwap-test-01';
  const BASE='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  console.log('🔥 STRIKE PULSE DEBUG START');
  console.log('🔎 Loader executing:', location.href);
  console.log('🔎 Document ready:', document.readyState);

  function report(){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    const ours=links.filter(l=>/strike-pulse/i.test(l.href));
    console.log('📦 Strike Pulse stylesheet links found:', ours.length);
    ours.forEach((l,i)=>console.log('📄 CSS LINK '+(i+1)+':',l.href,l.sheet?'sheet available':'sheet unavailable'));

    const cards=[...document.querySelectorAll('.sp-market-card')];
    console.log('📦 MARKET CARDS FOUND:',cards.length);
    if(cards.length){
      const s=getComputedStyle(cards[0]);
      console.log('🎨 CARD COMPUTED STYLE:',{background:s.backgroundColor,borderRadius:s.borderRadius,minHeight:s.minHeight,padding:s.padding,display:s.display});
      console.log('🎨 CSS IS APPLYING:',!!s.backgroundImage || s.backgroundColor!=='rgba(0, 0, 0, 0)' || s.borderRadius!=='0px');
    }else console.warn('⚠️ .sp-market-card NOT FOUND');

    const vwap=document.querySelector('.sp-vwap-section');
    console.log('📊 VWAP SECTION FOUND:',!!vwap);
    if(vwap){
      const s=getComputedStyle(vwap);
      console.log('🎨 VWAP COMPUTED STYLE:',{
        background:s.backgroundImage,
        borderRadius:s.borderRadius,
        padding:s.padding,
        display:s.display,
        color:s.color
      });
      console.log('🎨 VWAP CSS IS APPLYING:',s.borderRadius!=='0px' && s.padding!=='0px');
    }else{
      console.warn('⚠️ .sp-vwap-section NOT FOUND - HTML is not present in DOM');
    }
  }

  function addCss(file){
    const href=BASE+file+'?v='+VERSION+'&t='+Date.now();
    const el=document.createElement('link');
    el.rel='stylesheet';
    el.href=href;
    el.dataset.strikePulseCss='1';
    el.onload=()=>{console.log('✅ CSS FILE LOADED:',file);report();};
    el.onerror=()=>{console.error('❌ CSS FILE FAILED TO LOAD:',file,href);report();};
    document.head.appendChild(el);
    console.log('📡 CSS FILE REQUESTED:',href);
  }

  function start(){
    console.log('✅ WORDPRESS LOADER RUNNING');
    addCss('strike-pulse.css');
    addCss('strike-pulse-fix.css');
    setTimeout(report,1000);
    setTimeout(report,3000);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();
