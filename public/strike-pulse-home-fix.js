/* Strike Pulse home-price compatibility fix */
(function(){
  const API='https://strike-pulse-relay.onrender.com/api/prices';
  const fmt=v=>v==null||v===''||isNaN(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const now=()=>new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  function update(){
    fetch(API+'?t='+Date.now(),{cache:'no-store'})
      .then(r=>r.json())
      .then(j=>{
        const d=j.data||j;
        ['nifty','banknifty','finnifty','vix'].forEach(k=>{
          const els=document.querySelectorAll('.sp-price[data-market="'+k+'"], .sp-market-price[data-market="'+k+'"]');
          els.forEach(el=>{
            if(d[k]!=null) el.textContent=fmt(d[k]);
            const card=el.closest('.sp-market-card')||el.closest('.wp-block-column')||el.parentElement;
            const ch=card&&card.querySelector('.sp-market-change,.sp-change');
            const up=card&&card.querySelector('.sp-updated');
            if(ch&&d[k+'Change']!=null){
              const n=Number(d[k+'Change']);
              ch.textContent=(n>0?'▲ +':n<0?'▼ ':'● ')+n.toFixed(2)+'%';
            }
            if(up) up.textContent='Updated '+now();
          });
        });
      })
      .catch(e=>console.error('Strike Pulse home price fix',e));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{update();setInterval(update,2000)});
  else {update();setInterval(update,2000)}
})();
