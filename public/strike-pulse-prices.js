(function(){
  const API='https://strike-pulse-relay.onrender.com/api/prices';
  const num=v=>v==null||v===''||!Number.isFinite(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pick=(d,keys)=>{for(const k of keys){if(d&&d[k]!=null&&d[k]!=='')return d[k]}return null};

  function setText(selectors,value){
    if(value==null)return 0;
    let count=0;
    selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{
      el.textContent=num(value);el.style.visibility='visible';el.style.opacity='1';count++;
    }));
    return count;
  }

  function update(key,price,change){
    const cap=key.charAt(0).toUpperCase()+key.slice(1);
    if(price==null){console.error('❌ '+key.toUpperCase()+' PRICE MISSING');return false;}
    const selectors=[
      '.sp-price[data-market="'+key+'"]','.sp-market-price[data-market="'+key+'"]',
      '#sp-'+key+'-price','#sp'+cap+'Price','#sp-'+key,'#sp'+cap,'[data-price="'+key+'"]'
    ];
    if(key==='nifty')selectors.push('#sp-chain-spot','#spSpot','.sp-vwap-spot');
    if(key==='banknifty')selectors.push('#sp-banknifty-price','#spBankniftyPrice','#sp-banknifty','#spBanknifty');
    if(key==='finnifty')selectors.push('#sp-finnifty-price','#spFinniftyPrice','#sp-finnifty','#spFinnifty');
    if(key==='sensex')selectors.push('#sp-sensex-price','#spSensexPrice','#sp-sensex','#spSensex','.sp-sensex-price');
    if(key==='vix')selectors.push('#sp-vix-price','#spVixPrice','#sp-vix','#spVix');
    const found=setText(selectors,price);
    if(!found)console.warn('⚠️ '+key.toUpperCase()+' PRICE FOUND IN API BUT NO HTML ELEMENT MATCHED',price);

    document.querySelectorAll(selectors.join(',')).forEach(el=>{
      const card=el.closest('.sp-market-card')||el.closest('.market-card')||el.closest('.wp-block-column')||el.parentElement;
      const ch=card&&card.querySelector('.sp-market-change,.sp-change,[data-change="'+key+'"]');
      if(ch&&change!=null){const x=Number(change);ch.textContent=(x>0?'▲ +':x<0?'▼ ':'● ')+x.toFixed(2)+'%';ch.classList.toggle('positive',x>0);ch.classList.toggle('negative',x<0);}
    });
    console.log('✅ '+key.toUpperCase()+' PRICE:',price,'HTML MATCHES:',found);
    return true;
  }

  function status(){
    const p=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    const get=t=>p.find(x=>x.type===t)?.value||'';const day={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5}[get('weekday')]||0;const mins=Number(get('hour'))*60+Number(get('minute'));const open=day>=1&&day<=5&&mins>=555&&mins<930;
    document.querySelectorAll('.sp-market-status').forEach(el=>{el.classList.toggle('sp-live',open);el.classList.toggle('sp-closed',!open)});
  }

  async function load(){
    console.log('🔄 STRIKE PULSE PRICE CHECK:',new Date().toLocaleTimeString());
    try{
      const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});
      console.log('🌐 PRICE API HTTP:',r.status,r.ok?'OK':'FAILED');
      if(!r.ok)throw Error('HTTP '+r.status);
      const j=await r.json();
      const d=j&&j.data&&typeof j.data==='object'?j.data:j;
      console.log('📦 FULL PRICE API RESPONSE:',d);
      console.log('🔑 API KEYS:',Object.keys(d||{}));

      const markets={
        nifty:['nifty','nifty50','NIFTY'],
        banknifty:['banknifty','bankNifty','BANKNIFTY'],
        finnifty:['finnifty','finNifty','FINNIFTY'],
        sensex:['sensex','SENSEX','bseSensex','bse_sensex','BSE_SENSEX','bseSensexPrice','sensexPrice'],
        vix:['vix','indiaVix','india_vix','INDIA_VIX','indiaVixPrice','vixPrice']
      };

      let ok=0;
      Object.keys(markets).forEach(k=>{
        const price=pick(d,markets[k]);
        const change=pick(d,markets[k].map(x=>x+'Change').concat(k+'Change'));
        console.log('🔎 '+k.toUpperCase()+' RAW:',{price,change,checkedKeys:markets[k]});
        if(update(k,price,change))ok++;
      });
      status();
      console.log('📊 RESULT: '+ok+'/5 MARKET PRICES UPDATED');
      if(ok<5)console.error('❌ ONE OR MORE MARKET PRICES FAILED — CHECK THE 🔎 RAW LOG ABOVE');
    }catch(e){console.error('❌ STRIKE PULSE PRICE API ERROR:',e);}
  }

  function start(){console.log('🚀 STRIKE PULSE PRICES JS STARTED');load();setInterval(load,5000);status();setInterval(status,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
