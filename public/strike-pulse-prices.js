(function(){
  const API='https://strike-pulse-relay.onrender.com/api/prices';
  const num=v=>v==null||!Number.isFinite(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

  function setText(selectors,value){
    if(value==null)return;
    selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.textContent=num(value);el.style.visibility='visible';el.style.opacity='1';}));
  }

  function update(key,price,change){
    if(price==null)return;

    /* HOME MARKET CARDS */
    setText([
      '.sp-price[data-market="'+key+'"]',
      '.sp-market-price[data-market="'+key+'"]',
      '#sp-'+key+'-price',
      '#sp'+key.charAt(0).toUpperCase()+key.slice(1)+'Price'
    ],price);

    /* OPTION-CHAIN HOME SUMMARY / SPOT */
    if(key==='nifty'){
      setText(['#sp-chain-spot','#spSpot','.sp-vwap-spot'],price);
    }
    if(key==='banknifty') setText(['#sp-banknifty-price','#spBankniftyPrice'],price);
    if(key==='finnifty') setText(['#sp-finnifty-price','#spFinniftyPrice'],price);
    if(key==='vix') setText(['#sp-vix-price','#spVixPrice'],price);

    const selectors=[
      '.sp-price[data-market="'+key+'"]',
      '.sp-market-price[data-market="'+key+'"]',
      '#sp-'+key+'-price',
      '#sp'+key.charAt(0).toUpperCase()+key.slice(1)+'Price'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el=>{
      const card=el.closest('.sp-market-card')||el.closest('.wp-block-column')||el.parentElement;
      const ch=card&&card.querySelector('.sp-market-change,.sp-change,[data-change="'+key+'"]');
      if(ch&&change!=null){
        const n=Number(change);
        ch.textContent=(n>0?'▲ +':n<0?'▼ ':'● ')+n.toFixed(2)+'%';
        ch.classList.toggle('positive',n>0);
        ch.classList.toggle('negative',n<0);
      }
    });
  }

  function status(){
    const p=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    const get=t=>p.find(x=>x.type===t)?.value||'';
    const day={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5}[get('weekday')]||0;
    const mins=Number(get('hour'))*60+Number(get('minute'));
    const open=day>=1&&day<=5&&mins>=555&&mins<930;
    document.querySelectorAll('.sp-market-status').forEach(el=>{
      el.classList.toggle('sp-live',open);
      el.classList.toggle('sp-closed',!open);
    });
  }

  async function load(){
    try{
      const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const j=await r.json();
      const d=j&&typeof j.data==='object'?j.data:j;
      ['nifty','banknifty','finnifty','vix'].forEach(k=>update(k,d[k],d[k+'Change']));
      status();
      console.log('✅ STRIKE PULSE LIVE PRICES UPDATED');
    }catch(e){console.error('❌ STRIKE PULSE PRICE API',e)}
  }

  function start(){load();setInterval(load,5000);status();setInterval(status,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
