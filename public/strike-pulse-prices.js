(function(){
  const API='https://strike-pulse-relay.onrender.com/api/prices';
  const num=v=>v==null||v===''||!Number.isFinite(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pick=(d,keys)=>{for(const k of keys){if(d&&d[k]!=null&&d[k]!=='')return d[k]}return null};
  const aliases={
    nifty:['nifty','nifty50','NIFTY'],banknifty:['banknifty','bankNifty','BANKNIFTY'],finnifty:['finnifty','finNifty','FINNIFTY'],
    sensex:['sensex','SENSEX','bseSensex','bse_sensex','BSE_SENSEX','bseSensexPrice','sensexPrice'],vix:['vix','indiaVix','india_vix','INDIA_VIX','indiaVixPrice','vixPrice']
  };
  const selectors={
    nifty:['#sp-nifty-price','#spNiftyPrice','#sp-nifty','#spNifty','[data-price="nifty"]','.sp-price[data-market="nifty"]','.sp-market-price[data-market="nifty"]'],
    banknifty:['#sp-banknifty-price','#spBankniftyPrice','#sp-banknifty','#spBanknifty','[data-price="banknifty"]','.sp-price[data-market="banknifty"]'],
    finnifty:['#sp-finnifty-price','#spFinniftyPrice','#sp-finnifty','#spFinnifty','[data-price="finnifty"]','.sp-price[data-market="finnifty"]'],
    sensex:['#sp-sensex-price','#spSensexPrice','#sp-sensex','#spSensex','.sp-sensex-price','[data-price="sensex"]','.sp-price[data-market="sensex"]'],
    vix:['#sp-vix-price','#spVixPrice','#sp-vix','#spVix','[data-price="vix"]','.sp-price[data-market="vix"]']
  };
  function setEls(list,value){let n=0;list.forEach(s=>document.querySelectorAll(s).forEach(e=>{e.textContent=num(value);e.style.visibility='visible';e.style.opacity='1';n++}));return n}
  function update(k,p,ch){if(p==null){console.error('❌ '+k.toUpperCase()+' PRICE MISSING');return false}let list=selectors[k].slice();if(k==='nifty')list.push('#sp-chain-spot','#spSpot','.sp-vwap-spot');const found=setEls(list,p);if(!found)console.warn('⚠️ '+k.toUpperCase()+' PRICE FOUND IN API BUT HOME HTML ELEMENT NOT MATCHED',p);document.querySelectorAll(list.join(',')).forEach(e=>{const c=e.closest('.sp-market-card')||e.closest('.market-card')||e.parentElement;if(c&&ch!=null){const x=Number(ch),el=c.querySelector('.sp-market-change,.sp-change,[data-change="'+k+'"]');if(el){el.textContent=(x>0?'▲ +':x<0?'▼ ':'● ')+x.toFixed(2)+'%';el.classList.toggle('positive',x>0);el.classList.toggle('negative',x<0)}}});console.log('✅ '+k.toUpperCase()+':',p,'HOME MATCHES:',found);return true}
  async function load(){try{const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json(),d=j?.data&&typeof j.data==='object'?j.data:j;console.log('📦 STRIKE PULSE PRICES:',d);let ok=0;Object.keys(aliases).forEach(k=>{const p=pick(d,aliases[k]),ch=pick(d,aliases[k].map(x=>x+'Change').concat(k+'Change'));if(update(k,p,ch))ok++});console.log('📊 HOME PRICE RESULT:',ok+'/5')}catch(e){console.error('❌ HOME PRICE API ERROR:',e)}}
  function start(){console.log('🚀 STRIKE PULSE HOME PRICE JS STARTED');load();setInterval(load,5000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();