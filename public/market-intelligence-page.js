(() => {
  'use strict';
  const API='https://strike-pulse-relay.onrender.com/api/market-intelligence';
  const REFRESH_MS=15000;
  let busy=false;
  const $=id=>document.getElementById(id);
  const text=(id,value)=>{const el=$(id);if(el)el.textContent=value??'—';};
  const cls=(el,name)=>{if(!el)return;el.classList.remove('spmi-up','spmi-down','spmi-neutral');if(name)el.classList.add(name);};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
  const fmt=(v,digits=2)=>{const x=n(v);return x==null?'—':x.toLocaleString('en-IN',{minimumFractionDigits:digits,maximumFractionDigits:digits});};
  const pct=v=>{const x=n(v);return x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%';};
  const direction=v=>{const x=n(v);return x==null?'NEUTRAL':x>0.05?'UP':x<-0.05?'DOWN':'FLAT';};
  const changeClass=v=>{const x=n(v);return x==null||Math.abs(x)<=0.05?'spmi-neutral':x>0?'spmi-up':'spmi-down';};

  function updateClock(){
    const now=new Date();
    text('spmi-clock',now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}));
    text('spmi-date',now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})+' • IST');
  }

  function setMarketStatus(market){
    const session=String(market?.session||'CLOSED').toUpperCase();
    text('spmi-market-status',session==='LIVE'?'MARKET LIVE':session);
    const dot=document.querySelector('.spmi-status-dot');
    if(dot)dot.classList.toggle('spmi-status-live',session==='LIVE');
  }

  function setIndex(key,data){
    const price=n(data?.price),change=n(data?.change);
    text('spmi-'+key,fmt(price));
    text('spmi-'+key+'-change',pct(change));
    text('spmi-'+key+'-state',direction(change));
    cls($('spmi-'+key+'-change'),changeClass(change));
    cls($('spmi-'+key+'-state'),changeClass(change));
    const line=$('spmi-'+key+'-line');
    if(line){line.style.width=Math.min(100,Math.max(12,50+(change||0)*18))+'%';cls(line,changeClass(change));}
  }

  function setBreadth(b){
    const advances=n(b?.advances),declines=n(b?.declines),unchanged=n(b?.unchanged);
    const valid=advances!=null&&declines!=null&&unchanged!=null;
    const a=valid?advances:0,d=valid?declines:0,u=valid?unchanged:0,total=a+d+u;
    const ad=d?a/d:a?a:null;
    text('spmi-advances',valid?a.toLocaleString('en-IN'):'—');
    text('spmi-declines',valid?d.toLocaleString('en-IN'):'—');
    text('spmi-unchanged',valid?u.toLocaleString('en-IN'):'—');
    text('spmi-ad-ratio',total&&ad!=null?ad.toFixed(2):'—');
    text('spmi-advance-pct',total?(a/total*100).toFixed(1)+'%':'—');
    text('spmi-decline-pct',total?(d/total*100).toFixed(1)+'%':'—');
    const setBar=(id,value)=>{const el=$(id);if(el)el.style.width=total?(value/total*100)+'%':'0%';};
    setBar('spmi-advances-bar',a);setBar('spmi-declines-bar',d);setBar('spmi-unchanged-bar',u);
    const state=!valid?'Unavailable':a>d*1.15?'POSITIVE':d>a*1.15?'NEGATIVE':'BALANCED';
    text('spmi-breadth-state',state);
    return{advances:valid?a:null,declines:valid?d:null,unchanged:valid?u:null,total,state};
  }

  function setVix(vix){
    const value=n(vix?.price),change=n(vix?.change);
    const condition=value==null?'—':value<12?'LOW':value<20?'MODERATE':'HIGH';
    const dir=direction(change);
    text('spmi-vix',fmt(value));text('spmi-vix-big',fmt(value));
    text('spmi-vix-change',pct(change));text('spmi-vix-change-big',pct(change));
    text('spmi-vix-state',dir);text('spmi-vix-badge',condition);
    text('spmi-vix-condition',condition);text('spmi-vix-direction',dir);
    const fill=$('spmi-vix-gauge-fill');
    if(fill&&value!=null)fill.style.width=Math.min(100,Math.max(5,value/30*100))+'%';
    cls($('spmi-vix-change'),changeClass(change));cls($('spmi-vix-change-big'),changeClass(change));cls($('spmi-vix-state'),changeClass(change));
    return{value,change,condition,dir};
  }

  function setRegime(regime,breadthState,vix){
    const rawScore=n(regime?.score);
    const score100=rawScore==null?50:Math.min(100,Math.max(0,50+rawScore/2));
    const label=String(regime?.label||'MIXED').toUpperCase();
    const avg=n(regime?.averageChange);
    text('spmi-regime',label);text('spmi-score',Math.round(score100));
    text('spmi-momentum',avg==null?'—':avg>0.25?'Positive':avg<-0.25?'Negative':'Neutral');
    const fill=$('spmi-meter-fill'),pointer=$('spmi-meter-pointer');
    if(fill)fill.style.width=score100+'%';if(pointer)pointer.style.left=score100+'%';
    text('spmi-breadth-state',breadthState||'Unavailable');text('spmi-vol-state',vix?.condition||'Moderate');
    return{score100,label};
  }

  function setPressure(breadth,regime){
    let score=50;
    if(breadth?.total)score=(breadth.advances/breadth.total)*100;
    else if(n(regime?.score)!=null)score=50+n(regime.score)/2;
    score=Math.min(100,Math.max(0,score));
    const state=score>=60?'BUYING':score<=40?'SELLING':'BALANCED';
    text('spmi-pressure-score',Math.round(score));text('spmi-pressure-state',state);
    text('spmi-pressure-note',state==='BUYING'?'Buying participation is currently stronger.':state==='SELLING'?'Selling participation is currently stronger.':'Market participation is currently balanced.');
    const fill=$('spmi-pressure-fill'),dot=$('spmi-pressure-dot');
    if(fill)fill.style.width=score+'%';if(dot)dot.style.left=score+'%';
    return{score,state};
  }

  function setSignals(data,indices,breadth,vix,regime){
    const trend=n(regime?.score)>20?'BULLISH':n(regime?.score)<-20?'BEARISH':'MIXED';
    text('spmi-signal-trend',trend);text('spmi-signal-participation',breadth?.state||'BALANCED');
    text('spmi-signal-volatility',vix?.condition||'MODERATE');text('spmi-signal-overall',String(regime?.label||'MIXED').toUpperCase());

    const entries=[['NIFTY 50',n(indices?.nifty?.change)],['BANK NIFTY',n(indices?.banknifty?.change)],['FIN NIFTY',n(indices?.finnifty?.change)],['SENSEX',n(indices?.sensex?.change)]].filter(x=>x[1]!=null);
    if(entries.length){
      const strongest=entries.reduce((a,b)=>b[1]>a[1]?b:a),weakest=entries.reduce((a,b)=>b[1]<a[1]?b:a);
      text('spmi-best-index',strongest[0]+' '+pct(strongest[1]));text('spmi-weakest-index',weakest[0]+' '+pct(weakest[1]));
    }

    const sectors=data?.indices?.sectors||data?.sectors||{};
    const sectorNames={banking:'BANKING',it:'IT',energy:'ENERGY',auto:'AUTO',finance:'FINANCE',fmcg:'FMCG',metal:'METAL',pharma:'PHARMA',realty:'REALTY',media:'MEDIA'};

    document.querySelectorAll('.spmi-heat').forEach(card=>{
      const label=card.querySelector('small');if(!label)return;
      const key=Object.keys(sectorNames).find(k=>sectorNames[k]===label.textContent.trim().toUpperCase());
      const sector=key?sectors[key]:null,value=card.querySelector('strong'),state=card.querySelector('span');
      if(sector&&n(sector.change)!=null){
        const ch=n(sector.change);
        if(value)value.textContent=pct(ch);if(state)state.textContent=direction(ch);
        card.classList.remove('spmi-positive-strong','spmi-positive','spmi-neutral','spmi-negative');
        card.classList.add(ch>=0.5?'spmi-positive-strong':ch>=0.1?'spmi-positive':ch<=-0.1?'spmi-negative':'spmi-neutral');
      }else{if(value)value.textContent='—';if(state)state.textContent='Unavailable';}
    });

    const sectorEntries=Object.entries(sectors).filter(([,v])=>v&&n(v.change)!=null).sort((a,b)=>n(b[1].change)-n(a[1].change));
    const strongest=sectorEntries[0],weakestSector=sectorEntries[sectorEntries.length-1];
    text('spmi-top-sector',strongest?(strongest[1].name||sectorNames[strongest[0]]||strongest[0])+' '+pct(strongest[1].change):'—');
    text('spmi-bottom-sector',weakestSector?(weakestSector[1].name||sectorNames[weakestSector[0]]||weakestSector[0])+' '+pct(weakestSector[1].change):'—');

    const driverCards=[...document.querySelectorAll('.spmi-driver')];
    sectorEntries.slice(0,driverCards.length).forEach(([key,sector],i)=>{
      const card=driverCards[i],title=card.querySelector('strong'),desc=card.querySelector('span'),badge=card.querySelector('b'),ch=n(sector.change);
      if(title)title.textContent=sectorNames[key]||sector.name||key.toUpperCase();
      if(desc)desc.textContent=(ch>=0.5?'Strong momentum':ch>=0.1?'Positive participation':ch<=-0.1?'Under pressure':'Near flat')+' • '+pct(ch);
      if(badge)badge.textContent=ch>=0.5?'Strong':ch>=0.1?'Positive':ch<=-0.1?'Weak':'Neutral';
      card.classList.remove('positive','negative');card.classList.add(ch>=0.1?'positive':'negative');
      const icon=card.querySelector('i');if(icon)icon.textContent=ch>=0?'↑':'↓';
    });
  }

  function setStory(data,regime,breadth,vix){
    if(data?.signals?.length){text('spmi-story',data.signals.join(' • ')+'.');return;}
    const label=regime?.label||'MIXED';
    const breadthText=breadth?.state==='POSITIVE'?'breadth is positive':breadth?.state==='NEGATIVE'?'breadth is negative':'breadth is balanced';
    const volText=vix?.condition?'volatility is '+vix.condition.toLowerCase():'volatility is unavailable';
    text('spmi-story','Market regime is '+label.toLowerCase()+', '+breadthText+', and '+volText+'.');
  }

  async function load(){
    if(busy||document.hidden)return;
    busy=true;
    try{
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
      const res=await fetch(API+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});
      clearTimeout(timeout);
      const data=await res.json();
      if(!res.ok||!data?.success)throw new Error(data?.error||'Market Intelligence API error');

      const indices=data.indices||data.data?.indices||{},regime=data.regime||{};
      const breadth=setBreadth(data.breadth||{}),vix=setVix(indices.vix||{});
      const finalRegime=setRegime(regime,breadth.state,vix);
      setPressure(breadth,regime);setSignals(data,indices,breadth,vix,regime);

      setIndex('nifty',indices.nifty||{});setIndex('banknifty',indices.banknifty||{});setIndex('finnifty',indices.finnifty||{});
      setIndex('sensex',indices.sensex||{});setIndex('vix',indices.vix||{});
      setMarketStatus(data.market);

      const nowIST=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})),minsIST=nowIST.getHours()*60+nowIST.getMinutes();
      document.querySelectorAll('.spmi-time-item').forEach(item=>{
        const t=Number(item.dataset.time),label=item.querySelector('span');
        item.classList.toggle('active',minsIST>=t);
        if(label)label.textContent=minsIST<t?'Upcoming':t===930&&minsIST>=930?'Market Closed':'Completed';
      });

      text('spmi-updated',data.generatedAt?'Updated '+new Date(data.generatedAt).toLocaleTimeString('en-IN'):'Updated just now');
      text('spmi-final-bias',finalRegime.label==='BULLISH'?'BULLISH':finalRegime.label==='BEARISH'?'BEARISH':'MIXED');
      text('spmi-final-score',Math.round(finalRegime.score100)+'/100');
      text('spmi-final-momentum',n(regime.averageChange)==null?'—':n(regime.averageChange)>0?'Positive':n(regime.averageChange)<0?'Negative':'Neutral');
      text('spmi-final-volatility',vix.condition||'—');
      setStory(data,regime,breadth,vix);
      document.documentElement.dataset.spMiReady='1';
      console.log('[STRIKE PULSE] Market Intelligence live data updated',data);
    }catch(err){
      console.error('[STRIKE PULSE] Market Intelligence error:',err);
      text('spmi-market-status','DATA ERROR');text('spmi-updated','API unavailable');
    }finally{busy=false;}
  }

  function timeline(){
    const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})),mins=now.getHours()*60+now.getMinutes();
    document.querySelectorAll('.spmi-time-item').forEach(item=>item.classList.toggle('active',mins>=Number(item.dataset.time)));
  }

  function init(){updateClock();timeline();load();setInterval(updateClock,1000);setInterval(timeline,30000);setInterval(load,REFRESH_MS);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();