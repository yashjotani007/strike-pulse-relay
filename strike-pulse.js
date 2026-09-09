/* Strike Pulse root loader v5 — preserves v4 + adds future expiry selector */
(function(){
'use strict';
if(window.__StrikePulseRootLoaderLoaded)return;
window.__StrikePulseRootLoaderLoaded=true;
var base='https://raw.githubusercontent.com/yashjotani007/strike-pulse-relay/backup-before-expiry-selector/strike-pulse.js';
var expiry='https://yashjotani007.github.io/strike-pulse-relay/expiry-selector.js';
function load(src,next){var s=document.createElement('script');s.src=src;s.async=false;s.onload=next||null;s.onerror=function(){console.error('[StrikePulse] Failed to load '+src)};(document.head||document.documentElement).appendChild(s)}
load(base,function(){load(expiry)});
})();
