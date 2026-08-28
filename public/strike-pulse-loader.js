(function(){
  const VERSION='20260828-public-assets-02';
  const CSS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/strike-pulse.css';
  const PRICE_JS='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/strike-pulse-prices.js';
  const OPTION_JS='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/strike-pulse-option.js';
  function css(){if(document.querySelector('link[data-sp-css="1"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.dataset.spCss='1';l.href=CSS_URL+'?v='+VERSION+'&t='+Date.now();l.onload=()=>console.log('%c✅ STRIKE PULSE CSS ACTIVE','color:#00c853;font-weight:bold');l.onerror=()=>console.error('❌ STRIKE PULSE CSS FAILED',l.href);document.head.appendChild(l)}
  function js(src,name){if(document.querySelector('script[data-sp="'+name+'"]'))return;const s=document.createElement('script');s.src=src+'?v='+VERSION+'&t='+Date.now();s.dataset.sp=name;s.async=false;s.onload=()=>console.log('%c✅ '+name.toUpperCase()+' JS ACTIVE','color:#00c853;font-weight:bold');s.onerror=()=>console.error('❌ '+name.toUpperCase()+' JS FAILED',s.src);document.head.appendChild(s)}
  function start(){console.log('%c🚀 STRIKE PULSE GLOBAL LOADER','font-weight:bold;font-size:15px');css();js(PRICE_JS,'price');js(OPTION_JS,'option')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();