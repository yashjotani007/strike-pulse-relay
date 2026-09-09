/* Strike Pulse root loader v6 — premium first-visit Home welcome */
(function(){
'use strict';
if(window.__StrikePulseRootLoaderLoaded)return;
window.__StrikePulseRootLoaderLoaded=true;
var welcome='https://yashjotani007.github.io/strike-pulse-relay/home-welcome.js';
var base='https://raw.githubusercontent.com/yashjotani007/strike-pulse-relay/backup-before-expiry-selector/strike-pulse.js';
var expiry='https://yashjotani007.github.io/strike-pulse-relay/expiry-selector.js';
function load(src,next){var s=document.createElement('script');s.src=src;s.async=false;s.onload=next||null;s.onerror=function(){console.error('[StrikePulse] Failed to load '+src)};(document.head||document.documentElement).appendChild(s)}
load(welcome,function(){load(base,function(){load(expiry)})});
})();
