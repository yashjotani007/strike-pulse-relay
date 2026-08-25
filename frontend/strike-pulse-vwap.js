/* STRIKE PULSE - LIVE VWAP MODULE */
(()=>{
  const API='https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=1d&interval=1m';
  const $=id=>document.getElementById(id);
  const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
  function set(id,v){const e=$(id);if(e)e.textContent=v}
  function paint(price,vwap){
    if(price==null||vwap==null)return;
    const diff=price-vwap, pct=vwap?(diff/vwap)*100:0;
    set('sp-vwap-current-price',fmt(price));set('sp-vwap-value',fmt(vwap));set('sp-vwap-difference',(diff>=0?'+':'')+fmt(diff));set('sp-vwap-percent',(pct>=0?'+':'')+pct.toFixed(2)+'%');
    set('sp-vwap-info-price',fmt(price));set('sp-vwap-info-vwap',fmt(vwap));
    const bias=diff>0.01?'ABOVE VWAP':diff<-0.01?'BELOW VWAP':'AT VWAP';set('sp-vwap-bias',bias);set('sp-vwap-info-signal',bias);
    const b=$('sp-vwap-bias');if(b){b.classList.remove('sp-vwap-above','sp-vwap-below','sp-vwap-neutral');b.classList.add(diff>0.01?'sp-vwap-above':diff<-0.01?'sp-vwap-below':'sp-vwap-neutral')}
    const s=$('sp-vwap-status-text');if(s)s.textContent='LIVE';
  }
  async function load(){
    if(!$('sp-vwap-value'))return;
    try{
      const r=await fetch(API+'&t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Yahoo HTTP '+r.status);
      const j=await r.json(),res=j?.chart?.result?.[0],q=res?.indicators?.quote?.[0],meta=res?.meta||{};
      const close=q?.close||[],high=q?.high||[],low=q?.low||[],volume=q?.volume||[];let pv=0,sv=0;
      for(let i=0;i<close.length;i++){const c=Number(close[i]),h=Number(high[i]),l=Number(low[i]),v=Number(volume[i]);if(!Number.isFinite(c)||!Number.isFinite(v)||v<=0)continue;const tp=(Number.isFinite(h)&&Number.isFinite(l)?(h+l+c)/3:c);pv+=tp*v;sv+=v}
      const price=Number(meta.regularMarketPrice)||Number(close.filter(Number.isFinite).at(-1));
      if(!Number.isFinite(price)||!sv)throw Error('Intraday volume unavailable');
      paint(price,pv/sv);set('sp-vwap-status-text','LIVE');
    }catch(e){console.warn('[StrikePulse VWAP]',e.message);const s=$('sp-vwap-status-text');if(s)s.textContent='DATA UNAVAILABLE'}
  }
  function boot(){load();setInterval(load,30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
