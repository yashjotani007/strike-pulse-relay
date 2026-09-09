/* Strike Pulse selection compatibility fix */
(function(){
'use strict';
if(window.__StrikePulseSelectionFixLoaded)return;
window.__StrikePulseSelectionFixLoaded=true;
var aliases={
  'NIFTYBANK':'BANKNIFTY',
  'NIFTY BANK':'BANKNIFTY',
  'NIFTYFIN':'FINNIFTY',
  'NIFTY FIN':'FINNIFTY',
  'NIFTY FINANCIAL SERVICES':'FINNIFTY',
  'NIFTYMIDCAP':'MIDCPNIFTY',
  'NIFTY MIDCAP':'MIDCPNIFTY',
  'NIFTYSENSEX':'SENSEX'
};
function normalize(v){var s=String(v||'').trim().toUpperCase();return aliases[s]||s}
function patch(el){if(!el)return;var v=el.getAttribute('data-symbol');if(v){var n=normalize(v);if(n!==v)el.setAttribute('data-symbol',n)}}
function scan(root){if(!root||!root.querySelectorAll)return;patch(root);root.querySelectorAll('[data-symbol]').forEach(patch)}
scan(document);
new MutationObserver(function(mutations){mutations.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)scan(n)})})}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('[data-symbol]'):null;if(!el)return;var v=el.getAttribute('data-symbol'),n=normalize(v);if(n!==v){el.setAttribute('data-symbol',n);console.log('[StrikePulse] SYMBOL NORMALIZED:',v,'->',n)}} ,true);
window.__STRIKE_PULSE_NORMALIZE_SYMBOL__=normalize;
})();
