document.addEventListener('DOMContentLoaded',()=>{
  console.log('[StrikePulse] PUBLIC JS LOADED');
  const BASE='https://strike-pulse-relay.onrender.com/api';
  const PRICE=BASE+'/prices';
  let priceBusy=false;

  async function forceSensexAttach(){try{let card=document.querySelector('.sp-market-sensex');if(!card){card=document.createElement('div');card.className='sp-market-card sp-market-sensex';card.innerHTML='<div class="sp-market-name">SENSEX</div><div class="sp-price" data-market="sensex">Loading…</div><div class="sp-change" data-change="sensex">—</div><div class="sp-updated" data-updated="sensex">Updated --</div><div class="sp-market-status sp-closed">CLOSED</div>';console.error('[StrikePulse] SENSEX CARD WAS MISSING — CREATED NOW')}const p=document.querySelector('.sp-price[data-market="nifty"]');const grid=p?.closest('.wp-block-columns');if(grid&&card.parentElement!==grid)grid.appendChild(card);card.classList.add('sp-market-card','sp-market-sensex');console.log('[StrikePulse] SENSEX FORCE ATTACHED');return card}catch(e){console.error('[StrikePulse] SENSEX FORCE ATTACH FAILED',e);return null}}

  async function prices(){forceSensexAttach();forceSensexAttach();
    if(priceBusy) return;
    priceBusy=true;
    try{
      await forceSensexAttach();
      const r=await fetch(PRICE+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      const d=j.data||j;
      ['nifty','banknifty','finnifty','vix','sensex'].forEach(k=>{
        const card=document.querySelector('.sp-market-card[data-market-card="'+k+'"]') || document.querySelector('.sp-market-card.sp-market-'+k);
        if(!card) return;
        const value=d[k], change=d[k+'Change'];
        const p=card.querySelector('.sp-price,[data-market="'+k+'"]'), c=card.querySelector('.sp-change,[data-change="'+k+'"]');
        const u=card.querySelector('.sp-updated,[data-updated="'+k+'"]'), s=card.querySelector('.sp-market-status');
        if(p && value!==null && value!==undefined && value!=='') p.textContent=Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
        if(c && change!==null && change!==undefined && change!==''){const n=Number(change);c.textContent=(n>=0?'+':'')+n.toFixed(2)+'%';c.classList.toggle('up',n>=0);c.classList.toggle('down',n<0)}
        if(u && d.updated) u.textContent='Updated '+new Date(d.updated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        if(s){s.textContent='LIVE';s.classList.remove('sp-closed');s.classList.add('sp-live')}
      });
    }catch(e){console.error('[StrikePulse] prices error:',e)}finally{priceBusy=false}
  }
  prices();
  setInterval(prices,5000);
});

/* Strike Pulse — Market Intelligence on the same common root loader */
(function(){
'use strict';
if(window.__StrikePulseMarketIntelligenceLoaded)return;
window.__StrikePulseMarketIntelligenceLoaded=true;
var API='https://strike-pulse-relay.onrender.com';
function N(v){var n=Number(v);return Number.isFinite(n)?n:null}
function F(v){var n=N(v);return n==null?'—':n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function P(v){var n=N(v);return n==null?'—':(n>=0?'+':'')+n.toFixed(2)+'%'}
function S(id,v){var e=document.getElementById(id);if(e)e.textContent=v}
function score(v){var n=N(v);return n==null?50:Math.max(0,Math.min(100,(n+100)/2))}
function momentum(d){var n=N(d&&d.regime&&d.regime.averageChange);return n==null?'Unavailable':n>0.05?'Positive':n<-0.05?'Negative':'Neutral'}
function breadth(b){if(!b||N(b.advances)==null)return'Unavailable';return N(b.advances)>N(b.declines)?'Healthy':N(b.declines)>N(b.advances)?'Weak':'Balanced'}
function volatility(v){var n=N(v&&v.change);return n==null?'Unavailable':n>3?'Elevated':n<-3?'Easing':'Moderate'}
function gauge(v){var n=N(v);return n==null?30:Math.max(0,Math.min(100,((n-5)/25)*100))}
function update(d){
 var page=document.querySelector('.spmi-page');if(!page)return false;
 var r=d.regime||{},i=d.indices||{},b=d.breadth||null,sc=score(r.score),bias=String(r.label||'UNKNOWN');
 S('spmi-bias',bias);S('spmi-score',Math.round(sc));S('spmi-final-bias',bias);S('spmi-final-score',Math.round(sc)+'/100');
 S('spmi-momentum',momentum(d));S('spmi-breadth-state',breadth(b));S('spmi-vol-state',volatility(i.vix));
 var ptr=document.getElementById('spmi-meter-pointer'),fill=document.getElementById('spmi-meter-fill');if(ptr)ptr.style.left=sc+'%';if(fill)fill.style.width=sc+'%';
 [['nifty','spmi-nifty'],['banknifty','spmi-banknifty'],['finnifty','spmi-finnifty'],['vix','spmi-vix']].forEach(function(x){var q=i[x[0]]||{},el=document.getElementById(x[1]);S(x[1],F(q.price));if(el&&el.parentElement){var em=el.parentElement.querySelector('em');if(em){em.textContent=P(q.change);em.classList.remove('spmi-up','spmi-down');var n=N(q.change);if(n>0)em.classList.add('spmi-up');else if(n<0)em.classList.add('spmi-down')}}});
 S('spmi-vix-big',F(i.vix&&i.vix.price));
 var g=document.querySelector('.spmi-vix-track span');if(g)g.style.width=gauge(i.vix&&i.vix.price)+'%';
 var vb=document.querySelector('.spmi-vol-badge');if(vb)vb.textContent=volatility(i.vix).toUpperCase();
 var session=d.market&&d.market.session||'UNKNOWN',closed=session==='CLOSED',sessionText=closed?'MARKET CLOSED':session==='LIVE'?'LIVE SESSION':session==='PRE-OPEN'?'PRE-OPEN':'MARKET CLOSED',liveText=closed?'CLOSED':session==='PRE-OPEN'?'PRE-OPEN':'LIVE';
 S('spmi-session-status',sessionText);var chip=page.querySelector('.spmi-snapshot .spmi-chip');if(chip)chip.textContent=liveText;page.querySelectorAll('.spmi-live,[data-market-status="live"]').forEach(function(el){el.textContent=liveText});
 console.log('[StrikePulse] Market Intelligence updated');return true
}
async function load(){try{var r=await fetch(API+'/api/market-intelligence?t='+Date.now(),{cache:'no-store'}),d=await r.json();if(!r.ok||!d.success)throw Error(d.error||('HTTP '+r.status));if(!update(d))console.warn('[StrikePulse] .spmi-page not found; no Market Intelligence UI created')}catch(e){console.error('[StrikePulse] Market Intelligence error',e)}}
function start(){if(!document.querySelector('.spmi-page'))return;load();setInterval(load,15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
