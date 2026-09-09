document.addEventListener('DOMContentLoaded',()=>{
  console.log('[StrikePulse] PUBLIC JS LOADED');
  const BASE='https://strike-pulse-relay.onrender.com/api';
  const PRICE=BASE+'/prices';
  let priceBusy=false;

  async function forceSensexAttach(){try{let card=document.querySelector('.sp-market-sensex');if(!card){card=document.createElement('div');card.className='sp-market-card sp-market-sensex';card.innerHTML='<div class="sp-market-name">SENSEX</div><div class="sp-price" data-market="sensex">Loading…</div><div class="sp-change" data-change="sensex">—</div><div class="sp-updated" data-updated="sensex">Updated --</div><div class="sp-market-status sp-closed">CLOSED</div>';console.error('[StrikePulse] SENSEX CARD WAS MISSING — CREATED NOW')}const p=document.querySelector('.sp-price[data-market="nifty"]');const grid=p?.closest('.wp-block-columns');if(grid&&card.parentElement!==grid)grid.appendChild(card);card.classList.add('sp-market-card','sp-market-sensex');console.log('[StrikePulse] SENSEX FORCE ATTACHED');return card}catch(e){console.error('[StrikePulse] SENSEX FORCE ATTACH FAILED',e);return null}}

  async function prices(){forceSensexAttach();
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
