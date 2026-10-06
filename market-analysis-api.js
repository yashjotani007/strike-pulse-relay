'use strict';
const express=require('express');
const optionDb=require('./option-history-db');
const original=express.application.use;
const num=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
async function history(symbol,interval='15m',range='5d'){
 const aliases={NIFTY:'^NSEI',BANKNIFTY:'^NSEBANK',FINNIFTY:'^CNXFIN',SENSEX:'^BSESN'};
 const ticker=aliases[symbol]||symbol+'.NS';
 const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?interval='+interval+'&range='+range;
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('History provider HTTP '+r.status);
 const j=await r.json(),data=j?.chart?.result?.[0],q=data?.indicators?.quote?.[0];
 if(!q||!data.timestamp)throw Error('Historical data unavailable');
 const candles=data.timestamp.map((t,i)=>({t:t*1000,o:num(q.open[i]),h:num(q.high[i]),l:num(q.low[i]),c:num(q.close[i]),v:num(q.volume[i])})).filter(x=>x.c!=null&&x.h!=null&&x.l!=null);
 if(!candles.length)throw Error('No valid historical candles');
 return {success:true,symbol,interval,range,source:'yahoo-finance',updated:new Date().toISOString(),candles};
}
function ema(a,n){if(a.length<n)return null;let v=a.slice(0,n).reduce((x,y)=>x+y,0)/n;for(let i=n;i<a.length;i++)v=a[i]*2/(n+1)+v*(n-1)/(n+1);return v}
function metrics(rows){const c=rows.map(x=>x.c),last=rows.at(-1),prev=rows.at(-2);let pv=0,vol=0;for(const x of rows)if(x.v>0){pv+=(x.h+x.l+x.c)/3*x.v;vol+=x.v}const recent=rows.slice(-20),avg=recent.reduce((s,x)=>s+(x.v||0),0)/recent.length;let gain=0,loss=0;for(let i=Math.max(1,c.length-14);i<c.length;i++){const d=c[i]-c[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d)}return {price:last.c,change:prev?(last.c/prev.c-1)*100:null,rsi:c.length>14?(loss?100-100/(1+gain/loss):100):null,ema9:ema(c,9),ema21:ema(c,21),ema50:ema(c,50),ema200:ema(c,200),vwap:vol?pv/vol:null,volume:last.v,rvol:avg?last.v/avg:null,high20:rows.length>1?Math.max(...rows.slice(-21,-1).map(x=>x.h)):null,low20:rows.length>1?Math.min(...rows.slice(-21,-1).map(x=>x.l)):null}}
const indexCache=new Map();
async function nseIndexConstituents(index){
 const name=String(index||'').trim().toUpperCase();
 if(!name)throw Error('Select an NSE universe');
 const cached=indexCache.get(name);if(cached&&Date.now()-cached.at<300000)return cached.symbols;
 const url='https://www.nseindia.com/api/equity-stockIndices?index='+encodeURIComponent(name);
 const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36','Accept':'application/json,text/plain,*/*','Referer':'https://www.nseindia.com/'};
 let home=await fetch('https://www.nseindia.com/',{headers,signal:AbortSignal.timeout(10000)}).catch(()=>null);
 const cookie=home?.headers?.get('set-cookie')||'';
 if(cookie)headers.Cookie=cookie.split(',').map(x=>x.split(';')[0]).join('; ');
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('NSE index data HTTP '+r.status);
 const j=await r.json();
 const symbols=[...new Set((Array.isArray(j?.data)?j.data:[]).map(x=>String(x?.symbol||'').trim().toUpperCase()).filter(x=>/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(x)))];
 if(!symbols.length)throw Error('No constituents available for '+name);
 indexCache.set(name,{at:Date.now(),symbols});return symbols;
}
async function stockScan(q){
 const sample=['RELIANCE','HDFCBANK','ICICIBANK','SBIN','TCS','INFY','ITC','LT','AXISBANK','BHARTIARTL','KOTAKBANK','HINDUNILVR','BAJFINANCE','MARUTI','SUNPHARMA','NTPC','TITAN','TATASTEEL','ONGC','WIPRO'];
 const selected=String(q.symbol||'').trim().toUpperCase().replace(/\\.NS$/,'');
 const universe=String(q.universe||'').trim().toUpperCase();
 if(selected&&!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(selected))throw Error('Invalid NSE symbol');
 let target,coverage;
 if(universe&&universe!=='SELECTED-SYMBOL'){
  target=await nseIndexConstituents(universe);coverage=universe+' · '+target.length+' constituents';
 }else if(selected){target=[selected];coverage='Selected NSE symbol';}
 else{target=sample;coverage='20 selected NSE stocks; choose an NSE universe for constituent scanning';}
 const settled=await Promise.allSettled(target.map(async symbol=>({symbol,...metrics((await history(symbol,q.interval||'15m',q.range||'5d')).candles)})));
 let rows=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
 const min=num(q.minPrice),rv=num(q.rvol),lo=num(q.rsiMin),hi=num(q.rsiMax);
 rows=rows.filter(x=>(min==null||x.price>=min)&&(rv==null||x.rvol!=null&&x.rvol>=rv)&&(lo==null||x.rsi!=null&&x.rsi>=lo)&&(hi==null||x.rsi!=null&&x.rsi<=hi));
 return {success:true,results:rows,coverage,requested:target.length,failed:settled.filter(x=>x.status==='rejected').length,updated:new Date().toISOString()}
}
// Ephemeral, bounded research snapshots. Never present these as exchange historical candles.
const optionSnapshots=new Map();
const optionKey=x=>[x.symbol,x.expiry,x.strike,x.type].join('|');
function recordOptionSnapshots(rows,observedAt){
 const t=Number.isFinite(Date.parse(observedAt))?Date.parse(observedAt):Date.now();
 for(const x of rows){
  const key=optionKey(x),series=optionSnapshots.get(key)||[];
  if(series.length&&t<=series[series.length-1].t)continue;
  series.push({t,premium:x.ltp??null,oi:x.oi??null,volume:x.volume??null,iv:x.iv??null,spread:x.spread??null});
  if(series.length>300)series.splice(0,series.length-300);
  optionSnapshots.set(key,series);
 }
 if(optionSnapshots.size>4000){const oldest=optionSnapshots.keys().next().value;optionSnapshots.delete(oldest)}
}
async function optionHistory(q){
 const symbol=String(q.symbol||'').toUpperCase(),expiry=String(q.expiry||''),type=String(q.type||'').toUpperCase(),strike=Number(q.strike);
 if(!/^[A-Z0-9&-]{2,24}$/.test(symbol)||!expiry||!Number.isFinite(strike)||!['CE','PE'].includes(type))throw Error('Invalid contract');
 const stored=await optionDb.history({symbol,expiry,strike,type}).catch(e=>{console.error('[OPTION HISTORY]',e.message);return null});
 const points=stored||optionSnapshots.get(optionKey({symbol,expiry,strike,type}))||[];
 return {success:true,symbol,expiry,strike,type,points,source:stored?'WordPress MySQL option-chain observations':'session-collected option-chain snapshots',persistent:!!stored,note:stored?'Stored observations only; not exchange OHLC candles.':'Session observations; Render restart clears in-memory series.'};
}
async function optionScan(q){if(typeof global.__SP_LOAD_CHAIN__!=='function')throw Error('Option chain relay unavailable');const symbol=String(q.symbol||'NIFTY').toUpperCase(),d=await global.__SP_LOAD_CHAIN__(symbol,q.expiry||null,true);let rows=[];for(const row of d.rows||[])for(const type of ['ce','pe']){const x=row[type];if(x?.ltp==null||x?.oi==null)continue;const base=x.oi-x.oiChange,oiPct=x.oiChange!=null&&base>0?x.oiChange/base*100:null;rows.push({symbol,strike:row.strike,type:type.toUpperCase(),expiry:d.expiry,ltp:x.ltp,oi:x.oi,oiPct,volume:x.volume,iv:x.iv>0?x.iv:null,spread:x.ask!=null&&x.bid!=null&&x.ltp>0?(x.ask-x.bid)/x.ltp*100:null})}const oi=num(q.minOi),volume=num(q.minVolume),iv=num(q.minIv),spread=num(q.maxSpread),type=String(q.type||'both').toUpperCase(),moneyness=String(q.moneyness||'all').toLowerCase();const spot=num(d.spot);rows=rows.filter(x=>{if(!(x.ltp>0&&(type==='BOTH'||x.type===type)&&(oi==null||x.oiPct!=null&&x.oiPct>=oi)&&(volume==null||x.volume!=null&&x.volume>=volume)&&(iv==null||x.iv!=null&&x.iv>=iv)&&(spread==null||x.spread!=null&&x.spread<=spread)))return false;if(moneyness==='all'||spot==null)return true;if(moneyness.includes('atm'))return Math.abs(x.strike-spot)<=Math.max(spot*0.0025,1);const itm=x.type==='CE'?x.strike<spot:x.strike>spot;return moneyness.includes('itm')?itm:!itm;});recordOptionSnapshots(rows,d.updated);await optionDb.save(rows,d.updated).catch(e=>console.error('[OPTION HISTORY DB SAVE]',e.message));return {success:true,symbol,source:d.source,expiry:d.expiry,spot:num(d.spot),results:rows,updated:d.updated}}
const routes={'/api/analysis/status':async()=>({success:true,features:{stockScanner:'selected symbol or 20-stock sample',optionScanner:'existing NSE relay',chart:'historical closing prices',backtest:'SMA historical research route available; provider-dependent',correlation:'Historical daily-return correlation route available; provider-dependent',universe:'NSE directory route available; provider-dependent',batchScanner:'Five stocks per request; provider-dependent'},updated:new Date().toISOString()}),'/api/analysis/stock-scanner':stockScan,'/api/analysis/option-scanner':optionScan,'/api/analysis/option-history':optionHistory,'/api/analysis/chart':async q=>{const symbol=String(q.symbol||'RELIANCE').toUpperCase().replace(/[^A-Z0-9&-]/g,'');const timeframeMap={'1m':{interval:'1m',range:'5d'},'5m':{interval:'5m',range:'5d'},'15m':{interval:'15m',range:'5d'},'1h':{interval:'60m',range:'5d'},'1D':{interval:'1d',range:'1y'},'1W':{interval:'1wk',range:'1y'}};const tf=String(q.timeframe||'');const mapped=timeframeMap[tf];const requestedInterval=String(q.interval||'');const interval=mapped?.interval||(['1m','5m','15m','30m','60m','1d','1wk'].includes(requestedInterval)?requestedInterval:'15m');const range=['1d','5d','1mo','3mo','6mo','1y','2y','5y'].includes(q.range)?q.range:(mapped?.range||((interval==='1d'||interval==='1wk')?'1y':'5d'));const d=await history(symbol,interval,range);return {...d,timeframe:tf||null,metrics:metrics(d.candles)}}};
express.application.use=function(...args){return original.call(this,async(req,res,next)=>{const fn=routes[req.path];if(!fn)return next();res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.sendStatus(204);try{return res.json(await fn(req.query||{}))}catch(e){return res.status(502).json({success:false,error:e.message})}},...args)};
// Collect new snapshots while the web service is awake; free instances may sleep.
let collecting=false;
async function collectOptionSnapshots(){
 if(collecting||!optionDb.enabled()||typeof global.__SP_LOAD_CHAIN__!=='function')return;
 collecting=true;
 try{
  for(const symbol of ['NIFTY','BANKNIFTY']){
   const d=await global.__SP_LOAD_CHAIN__(symbol,null,true);
   const rows=[];
   for(const row of d.rows||[])for(const type of ['ce','pe']){
    const x=row[type];if(x?.ltp==null||x?.oi==null)continue;
    rows.push({symbol,strike:row.strike,type:type.toUpperCase(),expiry:d.expiry,ltp:x.ltp,oi:x.oi,volume:x.volume,iv:x.iv,spread:x.ask!=null&&x.bid!=null&&x.ltp>0?(x.ask-x.bid)/x.ltp*100:null});
   }
   recordOptionSnapshots(rows,d.updated);await optionDb.save(rows,d.updated);
  }
 }catch(e){console.error('[OPTION AUTO COLLECT]',e.message)}
 finally{collecting=false}
}
setTimeout(collectOptionSnapshots,45000);
setInterval(collectOptionSnapshots,5*60*1000);
console.log('[ANALYSIS] backend loaded');
