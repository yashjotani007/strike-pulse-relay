document.addEventListener('DOMContentLoaded',()=>{
  console.log('[StrikePulse] PUBLIC JS LOADED');
  const BASE='https://strike-pulse-relay.onrender.com/api';
  const PRICE=BASE+'/prices';
  let priceBusy=false;

  async function prices(){
    if(priceBusy) return;
    priceBusy=true;
    try{
      const r=await fetch(PRICE+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      const d=j.data||j;
      const map={nifty:'NIFTY',banknifty:'BANKNIFTY',finnifty:'FINNIFTY',vix:'VIX',sensex:'SENSEX'};
      Object.keys(map).forEach(k=>{
        const card=document.querySelector('.sp-market-card[data-market-card="'+k+'"]');
        if(!card) return;
        const value=d[k], change=d[k+'Change'];
        const p=card.querySelector('.sp-price'), c=card.querySelector('.sp-change');
        const u=card.querySelector('.sp-updated'), s=card.querySelector('.sp-market-status');
        if(p && value!==null && value!==undefined && value!=='') p.textContent=Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
        if(c && change!==null && change!==undefined && change!==''){
          const n=Number(change); c.textContent=(n>=0?'+':'')+n.toFixed(2)+'%';
          c.classList.toggle('up',n>=0); c.classList.toggle('down',n<0);
        }
        if(u && d.updated) u.textContent=new Date(d.updated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        if(s) s.textContent='LIVE';
      });
    }catch(e){ console.error('[StrikePulse] prices error:',e); }
    finally{ priceBusy=false; }
  }
  prices();
  setInterval(prices,5000);
});
