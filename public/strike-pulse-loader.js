(function(){
'use strict';
const V='20260830-final-theme-01';
const JS='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/js/strike-pulse.js';
const CSS='https://cdn.jsdelivr.net/gh/yashjotani007/codevault@main/strike-pulse/css/strike-pulse-final.css';
function addCSS(){
 if(document.querySelector('link[data-strike-pulse-css]'))return;
 const l=document.createElement('link');l.rel='stylesheet';l.href=CSS+'?v='+V+'&t='+Date.now();l.dataset.strikePulseCss='1';
 l.onload=()=>console.log('%c✅ STRIKE PULSE FINAL CSS CONNECTED','color:#00c853;font-weight:bold');
 l.onerror=()=>console.error('%c❌ STRIKE PULSE FINAL CSS FAILED','color:#ef233c;font-weight:bold',l.href);
 document.head.appendChild(l);
}
function addJS(){
 if(document.querySelector('script[data-strike-pulse-js]'))return;
 const s=document.createElement('script');s.src=JS+'?v='+V+'&t='+Date.now();s.dataset.strikePulseJs='1';
 s.onload=()=>console.log('%c✅ STRIKE PULSE UNIFIED JS CONNECTED','color:#00c853;font-weight:bold');
 s.onerror=()=>console.error('%c❌ STRIKE PULSE UNIFIED JS FAILED','color:#ef233c;font-weight:bold',s.src);
 document.head.appendChild(s);
}
function start(){console.log('%c🚀 STRIKE PULSE FINAL GLOBAL CONNECTION','color:#60a5fa;font-weight:800;font-size:14px');addCSS();addJS();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();