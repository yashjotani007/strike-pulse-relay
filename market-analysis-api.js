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
function metrics(rows){const c=rows.map(x=>x.c),last=rows.at(-1),prev=rows.at(-2);let pv=0,vol=0;for(const x of rows)if(x.v>0){pv+=(x.h+x.l+x.c)/3*x.v;vol+=x.v}const volumeRows=rows.filter(x=>Number(x.v)>0),latestVolume=volumeRows.at(-1)?.v||0,recent=volumeRows.slice(-21),avg=recent.length>1?recent.slice(0,-1).reduce((s,x)=>s+x.v,0)/(recent.length-1):0;let gain=0,loss=0;for(let i=Math.max(1,c.length-14);i<c.length;i++){const d=c[i]-c[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d)}return {price:last.c,change:prev?(last.c/prev.c-1)*100:null,rsi:c.length>14?(loss?100-100/(1+gain/loss):100):null,ema9:ema(c,9),ema21:ema(c,21),ema50:ema(c,50),ema200:ema(c,200),vwap:vol?pv/vol:null,volume:last.v,rvol:avg?latestVolume/avg:null,high20:rows.length>1?Math.max(...rows.slice(-21,-1).map(x=>x.h)):null,low20:rows.length>1?Math.min(...rows.slice(-21,-1).map(x=>x.l)):null}}
const indexCache=new Map();
const universePageCache=new Map();
const equityCache={at:0,symbols:[]};
const fnoCache={at:0,symbols:[]};

function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);cell='';
   if(row.some(x=>String(x).trim()!==''))rows.push(row);
   row=[];
  }else cell+=ch;
 }
 if(cell!==''||row.length){row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row)}
 return rows;
}
function normName(v){
 return String(v||'').replace(/&amp;/gi,'&').replace(/&#39;|&#x27;/gi,"'").replace(/&quot;/gi,'"')
  .replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim().toUpperCase()
  .replace(/^NIFTY\s+/,'').replace(/[^A-Z0-9]+/g,'');
}
function validSymbol(x){
 return /^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(String(x||'').trim().toUpperCase());
}
async function fetchCsvSymbols(url,headers={}){
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36','Accept':'text/csv,text/plain,*/*',...headers},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Constituent CSV HTTP '+r.status);
 const rows=csvRows((await r.text()).replace(/^\uFEFF/,''));
 if(!rows.length)throw Error('Empty constituent CSV');
 const header=rows[0].map(x=>String(x).trim().toUpperCase());
 const si=header.findIndex(x=>x==='SYMBOL'||x.includes('SYMBOL'));
 if(si<0)throw Error('SYMBOL column unavailable');
 return [...new Set(rows.slice(1).map(r=>String(r[si]||'').trim().toUpperCase()).filter(validSymbol))];
}
async function allNseEquitySymbols(){
 if(equityCache.symbols.length&&Date.now()-equityCache.at<6*60*60*1000)return equityCache.symbols;
 const urls=[
  'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
  'https://www.nseindia.com/api/equity-master'
 ];
 for(const url of urls){
  try{
   let symbols;
   if(url.includes('EQUITY_L.csv'))symbols=await fetchCsvSymbols(url,{'Referer':'https://www.nseindia.com/'});
   else{
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json,*/*','Referer':'https://www.nseindia.com/'},signal:AbortSignal.timeout(15000)});
    if(!r.ok)continue;
    const j=await r.json();
    symbols=[...new Set((Array.isArray(j?.data)?j.data:[]).map(x=>String(x?.symbol||'').trim().toUpperCase()).filter(validSymbol))];
   }
   if(symbols?.length){equityCache.at=Date.now();equityCache.symbols=symbols;return symbols}
  }catch(_){}
 }
 throw Error('NSE equity directory unavailable');
}
async function fnoSymbols(){
 if(fnoCache.symbols.length&&Date.now()-fnoCache.at<60*60*1000)return fnoCache.symbols;
 const urls=['https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv','https://archives.nseindia.com/content/fo/fo_mktlots.csv'];
 for(const url of urls){
  try{
   const rows=csvRows((await (await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/csv,text/plain,*/*','Referer':'https://www.nseindia.com/'},signal:AbortSignal.timeout(15000)})).text()).replace(/^\uFEFF/,''));
   if(!rows.length)continue;
   const header=rows[0].map(x=>String(x).trim().toUpperCase());
   let si=header.findIndex(x=>x==='SYMBOL'||x.includes('SYMBOL'));
   if(si<0)si=1;
   const symbols=[...new Set(rows.slice(1).map(r=>String(r[si]||'').trim().toUpperCase()).filter(validSymbol))];
   if(symbols.length){fnoCache.at=Date.now();fnoCache.symbols=symbols;return symbols}
  }catch(_){}
 }
 throw Error('NSE F&O security list unavailable');
}
async function discoverConstituentUrl(name){
 const key=normName(name);
 const cached=universePageCache.get(key);
 if(cached&&Date.now()-cached.at<6*60*60*1000)return cached.url;
 const pages=[
  'https://www.niftyindices.com/indices/equity/broad-based-indices',
  'https://www.niftyindices.com/indices/equity/sectoral-indices',
  'https://www.niftyindices.com/indices/equity/thematic-indices',
  'https://www.niftyindices.com/indices/equity/strategy-indices'
 ];
 const target=normName(name);
 for(const page of pages){
  try{
   const html=await (await fetch(page,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,*/*','Referer':'https://www.niftyindices.com/'},signal:AbortSignal.timeout(15000)})).text();
   const anchors=[...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
   for(const m of anchors){
    const text=String(m[2]).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if(normName(text)!==target)continue;
    const href=m[1];
    const url=href.startsWith('http')?href:new URL(href,page).href;
    const pageHtml=await (await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,*/*','Referer':'https://www.niftyindices.com/'},signal:AbortSignal.timeout(15000)})).text();
    const hit=pageHtml.match(/href=["']([^"']*IndexConstituent[^"']*\.csv)["']/i);
    if(hit){
     const csvUrl=new URL(hit[1],url).href;
     universePageCache.set(key,{at:Date.now(),url:csvUrl});
     return csvUrl;
    }
   }
  }catch(_){}
 }
 return null;
}
async function nseIndexConstituents(index){
 const name=String(index||'').trim().toUpperCase();
 if(!name)throw Error('Select an NSE universe');
 const cached=indexCache.get(name);
 if(cached&&Date.now()-cached.at<300000)return cached.symbols;

 const special={
  'NIFTY F&O':'NIFTY 50',
  'BANKNIFTY F&O':'NIFTY BANK',
  'FINNIFTY F&O':'NIFTY FINANCIAL SERVICES'
 };
 if(name==='ALL NSE EQUITY STOCKS'||name==='ALL NSE STOCKS'||name==='NSE EQUITY STOCKS'){
  const symbols=await allNseEquitySymbols();indexCache.set(name,{at:Date.now(),symbols});return symbols;
 }
 if(name==='ALL F&O STOCKS'||name==='F&O STOCKS'){
  const symbols=await fnoSymbols();indexCache.set(name,{at:Date.now(),symbols});return symbols;
 }
 if(['MACRO-ECONOMIC SECTOR','SECTOR','INDUSTRY','BASIC INDUSTRY'].includes(name)){
  const symbols=await allNseEquitySymbols();indexCache.set(name,{at:Date.now(),symbols});return symbols;
 }
 if(special[name])return nseIndexConstituents(special[name]);

 const nseHeaders={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36','Accept':'application/json,text/plain,*/*','Accept-Language':'en-US,en;q=0.9','Referer':'https://www.nseindia.com/'};
 try{
  const home=await fetch('https://www.nseindia.com/',{headers:nseHeaders,signal:AbortSignal.timeout(10000)}).catch(()=>null);
  const cookie=home?.headers?.get('set-cookie')||'';
  if(cookie)nseHeaders.Cookie=cookie.split(',').map(x=>x.split(';')[0]).join('; ');
  const r=await fetch('https://www.nseindia.com/api/equity-stockIndices?index='+encodeURIComponent(name),{headers:nseHeaders,signal:AbortSignal.timeout(15000)});
  if(r.ok){
   const j=await r.json();
   const symbols=[...new Set((Array.isArray(j?.data)?j.data:[]).map(x=>String(x?.symbol||'').trim().toUpperCase()).filter(validSymbol))];
   if(symbols.length){indexCache.set(name,{at:Date.now(),symbols});return symbols}
  }
 }catch(_){}

 const compact=name.toLowerCase().replace(/[^a-z0-9]+/g,'');
 const aliases={
  'NIFTY 50':'nifty50','NIFTY NEXT 50':'niftynext50','NIFTY BANK':'niftybank',
  'NIFTY FINANCIAL SERVICES':'niftyfinancialservices','NIFTY FINANCIAL SERVICES 25/50':'niftyfinancialservices2550',
  'NIFTY FINANCIAL SERVICES EX BANK':'niftyfinancialservicesexbank','NIFTY OIL AND GAS':'niftyoilgas',
  'NIFTY OIL & GAS':'niftyoilgas','NIFTY REITS & REALTY':'niftyreitsrealty'
 };
 const candidates=[aliases[name]||compact];
 if(compact.startsWith('nifty')&&!candidates.includes(compact))candidates.push(compact);
 for(const slug of candidates){
  try{
   const symbols=await fetchCsvSymbols('https://www.niftyindices.com/IndexConstituent/ind_'+slug+'list.csv',{'Referer':'https://www.niftyindices.com/'});
   if(symbols.length){indexCache.set(name,{at:Date.now(),symbols});return symbols}
  }catch(_){}
 }

 const discovered=await discoverConstituentUrl(name);
 if(discovered){
  const symbols=await fetchCsvSymbols(discovered,{'Referer':'https://www.niftyindices.com/'});
  if(symbols.length){indexCache.set(name,{at:Date.now(),symbols});return symbols}
 }
 throw Error('No constituents available for '+name);
}
async function stockScan(q){
 const sample=['RELIANCE','HDFCBANK','ICICIBANK','SBIN','TCS','INFY','ITC','LT','AXISBANK','BHARTIARTL','KOTAKBANK','HINDUNILVR','BAJFINANCE','MARUTI','SUNPHARMA','NTPC','TITAN','TATASTEEL','ONGC','WIPRO'];
 const selected=String(q.symbol||'').trim().toUpperCase().replace(/\.NS$/,'');
 const universe=String(q.universe||'').trim().toUpperCase();
 if(selected&&!validSymbol(selected))throw Error('Invalid NSE symbol');
 let target,coverage;
 if(universe&&universe!=='SELECTED-SYMBOL'){
  target=[...new Set(await nseIndexConstituents(universe))];
  coverage=universe+' · '+target.length+' constituents';
 }else if(selected){target=[selected];coverage='Selected NSE symbol';}
 else{target=sample;coverage='20 selected NSE stocks; choose an NSE universe for constituent scanning';}
 const settled=[];
 const limit=8;
 for(let i=0;i<target.length;i+=limit){
  const batch=target.slice(i,i+limit);
  const results=await Promise.allSettled(batch.map(async symbol=>({symbol,...metrics((await history(symbol,q.interval||'15m',q.range||'5d')).candles)})));
  settled.push(...results);
 }
 let rows=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
 const min=num(q.minPrice),rv=num(q.rvol),lo=num(q.rsiMin),hi=num(q.rsiMax);
 rows=rows.filter(x=>(min==null||x.price>=min)&&(rv==null||x.rvol!=null&&x.rvol>=rv)&&(lo==null||x.rsi!=null&&x.rsi>=lo)&&(hi==null||x.rsi!=null&&x.rsi<=hi));
 return {success:true,results:rows,coverage,requested:target.length,failed:settled.filter(x=>x.status==='rejected').length,updated:new Date().toISOString()};
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
 const sessionPoints=optionSnapshots.get(optionKey({symbol,expiry,strike,type}))||[];const points=Array.isArray(stored)&&stored.length?stored:sessionPoints;
 return {success:true,symbol,expiry,strike,type,points,source:stored?'WordPress MySQL option-chain observations':'session-collected option-chain snapshots',persistent:!!stored,note:stored?'Stored observations only; not exchange OHLC candles.':'Session observations; Render restart clears in-memory series.'};
}
async function optionScan(q){if(typeof global.__SP_LOAD_CHAIN__!=='function')throw Error('Option chain relay unavailable');const symbol=String(q.symbol||'NIFTY').toUpperCase(),d=await global.__SP_LOAD_CHAIN__(symbol,q.expiry||null,true);let rows=[];for(const row of d.rows||[])for(const type of ['ce','pe']){const x=row[type];if(x?.ltp==null||x?.oi==null)continue;const base=x.oi-x.oiChange,oiPct=x.oiChange!=null&&base>0?x.oiChange/base*100:null;rows.push({symbol,strike:row.strike,type:type.toUpperCase(),expiry:d.expiry,ltp:x.ltp,oi:x.oi,oiPct,volume:x.volume,iv:x.iv>0?x.iv:null,spread:x.ask!=null&&x.bid!=null&&x.ltp>0?(x.ask-x.bid)/x.ltp*100:null})}const oi=num(q.minOi),volume=num(q.minVolume),iv=num(q.minIv),spread=num(q.maxSpread),type=String(q.type||'both').toUpperCase(),moneyness=String(q.moneyness||'all').toLowerCase();const spot=num(d.spot);rows=rows.filter(x=>{if(!(x.ltp>0&&(type==='BOTH'||x.type===type)&&(oi==null||x.oiPct!=null&&x.oiPct>=oi)&&(volume==null||x.volume!=null&&x.volume>=volume)&&(iv==null||x.iv!=null&&x.iv>=iv)&&(spread==null||x.spread!=null&&x.spread<=spread)))return false;if(moneyness==='all'||spot==null)return true;if(moneyness.includes('atm'))return Math.abs(x.strike-spot)<=Math.max(spot*0.0025,1);const itm=x.type==='CE'?x.strike<spot:x.strike>spot;return moneyness.includes('itm')?itm:!itm;});const observedAt=new Date().toISOString();recordOptionSnapshots(rows,observedAt);await optionDb.save(rows,observedAt).catch(e=>console.error('[OPTION HISTORY DB SAVE]',e.message));return {success:true,symbol,source:d.source,expiry:d.expiry,spot:num(d.spot),results:rows,updated:d.updated}}
async function volumeLab(q){
 const symbol=String(q.symbol||'').trim().toUpperCase().replace(/\.NS$/,'');
 if(!validSymbol(symbol))throw Error('Invalid NSE symbol');
 const lookback=Math.max(5,Math.min(120,Number(q.lookback)||20));
 const d=await history(symbol,'1d',lookback>60?'1y':'6mo');
 const rows=d.candles.filter(x=>Number.isFinite(x.v)&&x.v>=0);
 if(rows.length<2)throw Error('Insufficient daily volume history');
 const recent=rows.slice(-lookback),latest=recent.at(-1)?.v||0,prior=recent.slice(0,-1).filter(x=>x.v>0);
 const avg=prior.length?prior.reduce((s,x)=>s+x.v,0)/prior.length:0;
 return {success:true,symbol,lookback,relativeVolume:avg?latest/avg:null,latestVolume:latest,averageVolume:avg||null,points:recent.map(x=>({t:x.t,volume:x.v})),source:d.source,updated:d.updated};
}
async function correlationLab(q){
 const parts=String(q.symbols||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
 const a=parts[0],b=parts[1],benchmark=parts[2]||'NIFTY',window=Math.max(20,Math.min(252,Number(q.window)||60));
 if(!a||!b||!validSymbol(a)||!validSymbol(b))throw Error('Invalid correlation symbols');
 const aliases={NIFTY:'^NSEI',NIFTY100:'^CNX100',NIFTYIT:'^CNXIT'};
 const load=async symbol=>{const ticker=aliases[symbol]||symbol+'.NS';const d=await history(ticker,'1d','2y');return d.candles};
 const [aa,bb,mm]=await Promise.all([load(a),load(b),load(benchmark)]);
 const map=rows=>new Map(rows.map(x=>[new Date(x.t).toISOString().slice(0,10),x]));
 const ma=map(aa),mb=map(bb),mc=map(mm),dates=[...ma.keys()].filter(k=>mb.has(k)&&mc.has(k)).sort();
 if(dates.length<window+1)throw Error('Insufficient aligned daily history');
 const ret=m=>dates.slice(1).map((d,i)=>({t:m.get(d).t,r:m.get(d).c/m.get(dates[i]).c-1}));
 const series=[{symbol:a,points:ret(ma)},{symbol:b,points:ret(mb)},{symbol:benchmark,points:ret(mc)}];
 return {success:true,symbols:[a,b,benchmark],window,sessions:series[0].points.length,series,source:'yahoo-finance',updated:new Date().toISOString()};
}
const routes={'/api/analysis/status':async()=>({success:true,features:{stockScanner:'selected symbol or 20-stock sample',optionScanner:'existing NSE relay',chart:'historical closing prices',backtest:'SMA historical research route available; provider-dependent',correlation:'Historical daily-return correlation route available; provider-dependent',universe:'NSE directory route available; provider-dependent',batchScanner:'Five stocks per request; provider-dependent'},updated:new Date().toISOString()}),'/api/analysis/universe':async q=>{const term=String(q.q||'').trim().toUpperCase();const limit=Math.min(20,Math.max(1,Number(q.limit)||10));const symbols=await allNseEquitySymbols();const exact=symbols.filter(x=>x===term);const prefix=symbols.filter(x=>x.startsWith(term)&&x!==term);return {success:true,results:[...exact,...prefix].slice(0,limit).map(symbol=>({symbol,name:symbol,matchType:symbol===term?'exact':'prefix'})),updated:new Date().toISOString()}}),'/api/analysis/stock-scanner':stockScan,'/api/analysis/option-scanner':optionScan,'/api/analysis/option-history':optionHistory,'/api/analysis/volume-lab':volumeLab,'/api/analysis/correlation':correlationLab,'/api/analysis/chart':async q=>{const symbol=String(q.symbol||'RELIANCE').toUpperCase().replace(/[^A-Z0-9&-]/g,'');const timeframeMap={'1m':{interval:'1m',range:'5d'},'5m':{interval:'5m',range:'5d'},'15m':{interval:'15m',range:'5d'},'1h':{interval:'60m',range:'5d'},'1D':{interval:'1d',range:'1y'},'1W':{interval:'1wk',range:'1y'}};const tf=String(q.timeframe||'');const mapped=timeframeMap[tf];const requestedInterval=String(q.interval||'');const interval=mapped?.interval||(['1m','5m','15m','30m','60m','1d','1wk'].includes(requestedInterval)?requestedInterval:'15m');const range=['1d','5d','1mo','3mo','6mo','1y','2y','5y'].includes(q.range)?q.range:(mapped?.range||((interval==='1d'||interval==='1wk')?'1y':'5d'));const d=await history(symbol,interval,range);return {...d,timeframe:tf||null,metrics:metrics(d.candles)}}};
express.application.use=function(...args){return original.call(this,async(req,res,next)=>{const fn=routes[req.path];if(!fn)return next();res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.sendStatus(204);try{return res.json(await fn(req.query||{}))}catch(e){return res.status(502).json({success:false,error:e.message})}},...args)};
// Collect new snapshots while the web service is awake; free instances may sleep.
let collecting=false;
async function collectOptionSnapshots(){
 if(collecting||!optionDb.enabled()||typeof global.__SP_LOAD_CHAIN__!=='function')return;
 collecting=true;
 try{
  for(const symbol of ['NIFTY','BANKNIFTY','FINNIFTY','SENSEX']){
   const d=await global.__SP_LOAD_CHAIN__(symbol,null,true);
   const rows=[];
   for(const row of d.rows||[])for(const type of ['ce','pe']){
    const x=row[type];if(x?.ltp==null||x?.oi==null)continue;
    rows.push({symbol,strike:row.strike,type:type.toUpperCase(),expiry:d.expiry,ltp:x.ltp,oi:x.oi,volume:x.volume,iv:x.iv,spread:x.ask!=null&&x.bid!=null&&x.ltp>0?(x.ask-x.bid)/x.ltp*100:null});
   }
   const observedAt=new Date().toISOString();recordOptionSnapshots(rows,observedAt);await optionDb.save(rows,observedAt);
  }
 }catch(e){console.error('[OPTION AUTO COLLECT]',e.message)}
 finally{collecting=false}
}
setTimeout(collectOptionSnapshots,45000);
setInterval(collectOptionSnapshots,5*60*1000);
console.log('[ANALYSIS] backend loaded');
