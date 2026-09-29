'use strict';
// V2 research endpoint: align real daily closes before calculating rolling statistics.
const express=require('express');
const math=require('./lib/market-analysis-math');
const old=express.application.use;
const allowed=/^[A-Z0-9][A-Z0-9&-]{0,24}$/;
const aliases={NIFTY:'^NSEI',BANKNIFTY:'^NSEBANK',FINNIFTY:'^CNXFIN',SENSEX:'^BSESN'};
async function candles(symbol,range){
 const ticker=aliases[symbol]||symbol+'.NS';
 const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?interval=1d&range='+range;
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('History provider HTTP '+response.status);
 const j=await response.json(),d=j?.chart?.result?.[0],q=d?.indicators?.quote?.[0];
 if(!d?.timestamp||!q?.close)throw Error('Historical daily closes unavailable for '+symbol);
 const rows=d.timestamp.map((t,i)=>({t:t*1000,c:q.close[i]})).filter(x=>Number.isFinite(x.c)&&x.c>0);
 if(rows.length<22)throw Error('Insufficient daily history for '+symbol);
 return rows;
}
async function correlation(q){
 const a=String(q.a||'').trim().toUpperCase(),b=String(q.b||'').trim().toUpperCase(),benchmark=String(q.benchmark||'NIFTY').trim().toUpperCase();
 const window=Number(q.window||60),range=String(q.range||'1y');
 if(!allowed.test(a)||!allowed.test(b)||!allowed.test(benchmark))throw Error('Invalid symbol');
 if(a===b)throw Error('Choose two different stocks');
 if(![20,60,120,252].includes(window))throw Error('Rolling window must be 20, 60, 120 or 252');
 if(!['6mo','1y','2y','5y'].includes(range))throw Error('Unsupported historical range');
 const symbols=[...new Set([a,b,benchmark])],data=await Promise.all(symbols.map(async s=>[s,await candles(s,range)])),map=new Map(data);
 const paired=math.alignedReturns(map.get(a),map.get(b));
 const bench=math.returns(map.get(benchmark));
 const common=paired.dates.filter(t=>bench.has(t));
 if(common.length<window)throw Error('Insufficient common trading sessions for requested rolling window');
 const ax=math.returns(map.get(a)),by=math.returns(map.get(b));
 const ar=common.map(t=>ax.get(t)),br=common.map(t=>by.get(t)),mr=common.map(t=>bench.get(t));
 const rolling=math.rollingCorrelation(ar,br,window),spread=ar.map((v,i)=>v-br[i]),active=ar.map((v,i)=>v-mr[i]);
 const z=spread.length>=window?math.zscore(spread.slice(-window)):null;
 const firstA=map.get(a)[0].c,firstB=map.get(b)[0].c;
 return {success:true,a,b,benchmark,window,source:'yahoo-finance daily close',updated:new Date().toISOString(),sessions:common.length,
  metrics:{rollingCorrelation:rolling.at(-1),rollingBeta:math.beta(ar.slice(-window),mr.slice(-window)),spreadZScore:z,trackingError:math.trackingError(active.slice(-window))},
  points:common.map((t,i)=>({t,returnA:ar[i],returnB:br[i],benchmarkReturn:mr[i],rollingCorrelation:rolling[i],spread:spread[i]})),
  note:'Daily close-to-close returns aligned by common provider timestamps; unadjusted prices and provider coverage may affect results.'};
}
express.application.use=function(...args){
 return old.call(this,async(req,res,next)=>{
  if(req.path!=='/api/analysis/v2/correlation')return next();
  res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.sendStatus(204);
  if(req.method!=='GET')return res.sendStatus(405);
  try{res.json(await correlation(req.query||{}))}catch(e){res.status(502).json({success:false,error:e.message})}
 },...args);
};
module.exports={correlation};
