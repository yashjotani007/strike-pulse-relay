/* Strike Pulse — selected option-chain VWAP addon only */
(function(){
'use strict';
if(window.__StrikePulseVWAPLoaded)return;
window.__StrikePulseVWAPLoaded=true;
var API='https://strike-pulse-relay.onrender.com/api',timer=0,lastSymbol='';
function q(id){return document.getElementById(id)}
function text(e,v){if(e)e.textContent=v}
function symbol(){var e=q('spSelectedSymbol'),s=e&&e.textContent.trim();return s||lastSymbol||'NIFTY'}
function style(){if(q('spVWAPStyle'))return;var s=document.createElement('style');s.id='spVWAPStyle';s.textContent='.sp-vwap-box{display:inline-flex;align-items:center;gap:9px;margin-left:12px;padding:7px 12px;border:1px solid rgba(37,99,235,.16);border-radius:12px;background:rgba(255,255,255,.92);box-shadow:0 5px 18px rgba(15,23,42,.08);vertical-align:middle}.sp-vwap-label{font-size:9px;font-weight:900;letter-spacing:1.5px;color:#64748b}.sp-vwap-value{font-size:14px;font-weight:900;color:#2563eb}.sp-vwap-count{font-size:8px;font-weight:700;color:#94a3b8}@media(max-width:600px){.sp-vwap-box{margin-left:7px;padding:6px 9px}.sp-vwap-value{font-size:12px}.sp-vwap-count{display:none}}';(document.head||document.documentElement).appendChild(s)}
function box(){var host=q('spSelectedSymbol');if(!host)return null;style();var b=q('spVWAPBox');if(!b){b=document.createElement('span');b.id='spVWAPBox';b.className='sp-vwap-box';b.innerHTML='<span class="sp-vwap-label">VWAP</span><span class="sp-vwap-value">—</span><span class="sp-vwap-count"></span>';host.parentNode&&host.parentNode.insertBefore(b,host.nextSibling)}return b}
function set(v,n){var b=box();if(!b)return;text(b.querySelector('.sp-vwap-value'),Number.isFinite(v)?'₹'+v.toFixed(2):'—');text(b.querySelector('.sp-vwap-count'),n?'CHAIN '+n+' CONTRACTS':'')}
function calc(rows){var pv=0,vol=0,count=0;(Array.isArray(rows)?rows:[]).forEach(function(r){var c=[r&&(r.ce||r.call||r.CE),r&&(r.pe||r.put||r.PE)];c.forEach(function(x){if(!x)return;var p=Number(x.ltp!==undefined?x.ltp:(x.lastPrice!==undefined?x.lastPrice:x.last_price));var v=Number(x.volume!==undefined?x.volume:(x.totalTradedVolume!==undefined?x.totalTradedVolume:x.total_traded_volume));if(Number.isFinite(p)&&Number.isFinite(v)&&v>0){pv+=p*v;vol+=v;count++}})});return{v:vol>0?pv/vol:NaN,n:count}}
function xhr(){var s=symbol();if(!s)return;lastSymbol=s;var x=new XMLHttpRequest();x.open('GET',API+'/option-chain?symbol='+encodeURIComponent(s)+'&vwap='+Date.now(),true);x.setRequestHeader('Accept','application/json');x.onload=function(){if(x.status>=200&&x.status<300){try{var j=JSON.parse(x.responseText),r=j.rows||(j.data&&j.data.rows)||[],z=calc(r);set(z.v,z.n)}catch(e){set(NaN,0)}}else set(NaN,0)};x.onerror=function(){set(NaN,0)};try{x.send()}catch(e){set(NaN,0)}}
function start(){if(!q('spOptionChainBody'))return;box();xhr();var host=q('spSelectedSymbol');if(host){var mo=new MutationObserver(function(){var s=host.textContent.trim();if(s&&s!==lastSymbol){clearTimeout(timer);timer=setTimeout(xhr,120)}});mo.observe(host,{childList:true,characterData:true,subtree:true})}setInterval(xhr,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
