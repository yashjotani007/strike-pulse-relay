(function(){
  const VERSION='20260828-html-aligned-01';
  const CSS_URL='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/strike-pulse.css';
  const PRICE_JS='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/strike-pulse-prices.js';
  const OPTION_JS='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/js/strike-pulse.js';
  function add(src,name){if(document.querySelector('script[data-sp="'+name+'"]'))return;const s=document.createElement('script');s.src=src+'?v='+VERSION+'&t='+Date.now();s.dataset.sp=name;s.async=false;document.head.appendChild(s)}
  function start(){
    if(!document.querySelector('link[data-sp-css]')){const l=document.createElement('link');l.rel='stylesheet';l.dataset.spCss='1';l.href=CSS_URL+'?v='+VERSION+'&t='+Date.now();document.head.appendChild(l)}
    add(PRICE_JS,'price');
    add(OPTION_JS,'option');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
