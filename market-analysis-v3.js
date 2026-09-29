'use strict';
// Provider-backed research routes for the original WordPress Volume, Backtesting and Statistics sections.
const express=require('express'),math=require('./lib/market-analysis-math'),original=express.application.use;
const valid=/^[A-Z0-9][A-Z0-9&-]{0,24}$/;
const numeric=(v,fallback)=>v==null||v===''?fallback:Number(v);
const averages=(a,n)=>a.map((_,i)=>i<n-1?null:math.mean(a.slice(i-n+1,i+1)));
const exponential=(a,n)=>{let e=null;return a.map((v,i)=>{if(i<n-1)return null;if(i===n-1)return e=math.mean(a.slice(0,n));return e=v*2/(n+1)+e*(n-1)/(n+1)})};
function intervalConfig(interval,period){
 const configs={'5m':['5m','1mo'],'15m':['15m','1mo'],'60m':['60m','3mo'],'1d':['1d','5y']};
 if(!configs[interval])throw Error('Unsupported candle interval');
 const [tf,maxRange]=configs[interval];
 if(interval!=='1d'&&['3y','5y'].includes(period))throw Error('Multi-year intraday history unavailable from current provider');
 return {tf,range:interval==='1d'?({'3m':'6mo','6m':'1y','1y':'2y','3y':'5y','5y':'5y'}[period]||maxRange):maxRange};
}
async function load(symbol,interval='1d',period='1y'){
 if(!valid.test(symbol))throw Error('Invalid NSE stock symbol');
 const {tf,range}=intervalConfig(interval,period),url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol+'.NS')+'?interval='+tf+'&range='+range;
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(14000)});
 if(!r.ok)throw Error('History provider HTTP '+r.status);
 const j=await r.json(),d=j?.chart?.result?.[0],q=d?.indicators?.quote?.[0];
 if(!d?.timestamp||!q)throw Error('Provider returned no OHLCV history');
 const rows=d.timestamp.map((t,i)=>({t:t*1000,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]})).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)&&x.c>0&&x.h>=x.l).sort((a,b)=>a.t-b.t);
 if(rows.length<30)throw Error('Insufficient verified OHLCV candles');
 return rows;
}
function rsi(closes,n=14){
 const result=Array(closes.length).fill(null);
 for(let i=n;i<closes.length;i++){let up=0,down=0;for(let k=i-n+1;k<=i;k++){const d=closes[k]-closes[k-1];up+=Math.max(0,d);down+=Math.max(0,-d)}result[i]=down===0?(up===0?50:100):100-100/(1+up/down)}
 return result;
}
function events(rows,pattern){
 const c=rows.map(x=>x.c),e9=exponential(c,9),e21=exponential(c,21),strength=rsi(c),hits=[];
 for(let i=21;i<rows.length;i++){
  const x=rows[i],p=rows[i-1],prior=rows.slice(i-20,i),avg=math.mean(prior.map(y=>y.v).filter(Number.isFinite)),hi=Math.max(...prior.map(y=>y.h)),lo=Math.min(...prior.map(y=>y.l));
  let hit=false,side='long';
  switch(pattern){
   case 'volume-breakout':hit=x.c>hi&&avg>0&&x.v>=avg*1.5;break;
   case 'ema-crossover':hit=e9[i-1]<=e21[i-1]&&e9[i]>e21[i];break;
   case 'rsi-reversal':hit=strength[i-1]!=null&&strength[i-1]<30&&strength[i]>=30;break;
   case 'previous-high':hit=x.c>p.h&&p.c<=rows[i-2].h;break;
   case 'previous-low':hit=x.c<p.l&&p.c>=rows[i-2].l;side='short';break;
   case 'volume-spike':hit=avg>0&&x.v>=avg*2;break;
   case 'gap-fill':hit=(x.o>p.h&&x.l<=p.h)||(x.o<p.l&&x.h>=p.l);break;
   case 'gap-up':hit=x.o>p.h;break;
   case 'gap-down':hit=x.o<p.l;side='short';break;
   case 'vwap-crossover':{
    const session=new Date(x.t).toISOString().slice(0,10),part=rows.slice(0,i+1).filter(y=>new Date(y.t).toISOString().slice(0,10)===session&&y.v>0);
    const v=part.reduce((s,y)=>s+y.v,0),vw=v?part.reduce((s,y)=>s+(y.h+y.l+y.c)/3*y.v,0)/v:null;
    hit=vw!=null&&p.c<=vw&&x.c>vw;break;
   }
   case 'opening-range':{
    const day=new Date(x.t).toISOString().slice(0,10),session=rows.slice(0,i).filter(y=>new Date(y.t).toISOString().slice(0,10)===day);
    if(session.length>=3){const range=Math.max(...session.slice(0,3).map(y=>y.h));hit=x.c>range&&p.c<=range}break;
   }
   default:throw Error('Pattern not implemented: '+pattern);
  }
  if(hit)hits.push({index:i,t:x.t,side});
 }
 return hits;
}
function sessionEnd(rows,i){const day=new Date(rows[i].t).toISOString().slice(0,10);let j=i;while(j+1<rows.length&&new Date(rows[j+1].t).toISOString().slice(0,10)===day)j++;return j}
function forwardIndex(rows,i,window){
 if(window==='next-day'){let j=sessionEnd(rows,i)+1;return j<rows.length?j:null}
 if(window==='next-5-days'){let j=i;for(let k=0;k<5;k++){j=sessionEnd(rows,j)+1;if(j>=rows.length)return null}return j}
 const n=Number(window);if(![5,10,20].includes(n))throw Error('Unsupported forward window');return i+n<rows.length?i+n:null;
}
async function statistics(q){
 const symbol=String(q.symbol||'TCS').toUpperCase(),pattern=String(q.pattern||'volume-spike'),period=String(q.period||'1y'),window=String(q.forward||'5'),interval=String(q.interval||'1d');
 if(!['3m','6m','1y','3y','5y'].includes(period))throw Error('Invalid historical period');
 if(['opening-range'].includes(pattern)&&interval==='1d')throw Error('Opening-range research requires intraday candles');
 const rows=await load(symbol,interval,period),months={'3m':3,'6m':6,'1y':12,'3y':36,'5y':60}[period],cutoff=Date.now()-months*31*86400000;
 const hits=events(rows,pattern).filter(x=>x.t>=cutoff),observed=hits.map(x=>{const j=forwardIndex(rows,x.index,window);if(j==null)return null;const ret=x.side==='short'?rows[x.index].c/rows[j].c-1:rows[j].c/rows[x.index].c-1;return {t:x.t,returnPct:ret*100,hour:new Date(x.t).getUTCHours()}}).filter(Boolean);
 const summary=math.summarizeForwardReturns(observed.map(x=>x.returnPct));
 return {success:true,symbol,pattern,period,window,interval,source:'yahoo-finance OHLCV',updated:new Date().toISOString(),...summary,points:observed,falseBreakoutRate:null,note:'Historical observed events only; false breakout requires a separately defined reversal threshold. Timestamp hours are UTC.'};
}
async function volume(q){
 const symbol=String(q.symbol||'RELIANCE').toUpperCase(),period=String(q.period||'20d'),lookback={'current':1,'5d':5,'20d':20,'3mo':60}[period];
 if(!lookback)throw Error('Unsupported volume period');
 const rows=await load(symbol,'1d','1y'),recent=rows.slice(-lookback),history=rows.slice(-21,-1),avg=math.mean(history.map(x=>x.v).filter(Number.isFinite));
 const current=rows.at(-1),relativeVolume=avg>0&&Number.isFinite(current.v)?current.v/avg:null;
 // Equal-distribution across each candle's high-low range is an approximation, NOT actual traded-at-price volume.
 const lows=recent.map(x=>x.l),highs=recent.map(x=>x.h),min=Math.min(...lows),max=Math.max(...highs),bins=40,step=(max-min||1)/bins,profile=Array(bins).fill(0);
 for(const x of recent){if(!Number.isFinite(x.v)||x.v<=0)continue;const lo=Math.max(0,Math.min(bins-1,Math.floor((x.l-min)/step))),hi=Math.max(lo,Math.min(bins-1,Math.floor((x.h-min)/step)));for(let k=lo;k<=hi;k++)profile[k]+=x.v/(hi-lo+1)}
 const total=profile.reduce((s,x)=>s+x,0),pocIndex=profile.indexOf(Math.max(...profile)),poc=min+(pocIndex+.5)*step;
 let left=pocIndex,right=pocIndex,acc=profile[pocIndex];while(acc<total*.7&&(left>0||right<bins-1)){const lv=left>0?profile[left-1]:-1,rv=right<bins-1?profile[right+1]:-1;if(lv>=rv){left--;acc+=profile[left]}else{right++;acc+=profile[right]}}
 return {success:true,symbol,period,source:'yahoo-finance daily OHLCV',updated:new Date().toISOString(),relativeVolume,pointOfControl:total?poc:null,valueAreaHigh:total?min+(right+1)*step:null,valueAreaLow:total?min+left*step:null,profile:profile.map((v,i)=>({price:min+(i+.5)*step,estimatedVolume:v})),history:rows.slice(-60).map(x=>({t:x.t,volume:x.v})),note:'POC/VAH/VAL are candle-range estimates, not exchange traded-at-price volume. Current day may be incomplete.'};
}
async function backtest(q){
 const symbol=String(q.symbol||'RELIANCE').toUpperCase(),strategy=String(q.strategy||'ema-crossover'),interval=String(q.interval||'1d'),hold=String(q.hold||'5'),cost=numeric(q.cost,0),slippage=numeric(q.slippage,0);
 if(!['volume-breakout','ema-crossover','rsi-reversal','vwap-crossover','opening-range'].includes(strategy))throw Error('Strategy requires custom scanner rule definition');
 if(!Number.isFinite(cost)||!Number.isFinite(slippage)||cost<0||cost>5||slippage<0||slippage>5)throw Error('Invalid fee/slippage percentage');
 if(!['5','10','20','session'].includes(hold))throw Error('Custom exit needs an explicit exit rule');
 if(strategy==='opening-range'&&interval==='1d')throw Error('Opening range requires intraday candles');
 if(strategy==='vwap-crossover'&&interval==='1d')throw Error('Session VWAP requires intraday candles');
 const rows=await load(symbol,interval,'1y'),start=q.start?Date.parse(q.start):0,end=q.end?Date.parse(q.end+'T23:59:59Z'):Infinity;
 if(!Number.isFinite(start)||Number.isNaN(end)||end<start)throw Error('Invalid backtest dates');
 const signals=events(rows,strategy).filter(x=>x.t>=start&&x.t<=end),trades=[],curve=[],drawdowns=[];let equity=1,peak=1,free=0;
 for(const x of signals){if(x.index<free||x.index+1>=rows.length)continue;const entry=x.index+1,exit=hold==='session'?sessionEnd(rows,entry):Math.min(rows.length-1,entry+Number(hold));if(exit<=entry||rows[exit].t>end)continue;const entryPrice=rows[entry].o*(1+(slippage+cost)/100),exitPrice=rows[exit].c*(1-(slippage+cost)/100);const ret=x.side==='short'?entryPrice/exitPrice-1:exitPrice/entryPrice-1;equity*=1+ret;peak=Math.max(peak,equity);trades.push({entry:rows[entry].t,exit:rows[exit].t,returnPct:ret*100});curve.push({t:rows[exit].t,equity});drawdowns.push({t:rows[exit].t,drawdownPct:(equity/peak-1)*100});free=exit+1}
 const returns=trades.map(x=>x.returnPct/100),wins=returns.filter(x=>x>0),losses=returns.filter(x=>x<0),grossWin=wins.reduce((s,x)=>s+x,0),grossLoss=-losses.reduce((s,x)=>s+x,0),std=math.variance(returns,true),annual=interval==='1d'?252:252*26;
 return {success:true,symbol,strategy,interval,source:'yahoo-finance OHLCV',updated:new Date().toISOString(),metrics:{totalSignals:signals.length,closedTrades:trades.length,winRate:trades.length?wins.length/trades.length:null,profitFactor:grossLoss>0?grossWin/grossLoss:null,expectancy:math.mean(returns),maximumDrawdown:drawdowns.length?Math.min(...drawdowns.map(x=>x.drawdownPct))/100:null,sharpe:std>0?math.mean(returns)/Math.sqrt(std)*Math.sqrt(annual):null},trades,curve,drawdowns,note:'Next-candle-open entry; close-price exit; historical illustrative fills. No live trading, dividends, borrowing, survivorship correction or guaranteed execution.'};
}
const handlers={'/api/analysis/v3/volume':volume,'/api/analysis/v3/statistics':statistics,'/api/analysis/v3/backtest':backtest};
express.application.use=function(...args){return original.call(this,async(req,res,next)=>{const fn=handlers[req.path];if(!fn)return next();res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.sendStatus(204);if(req.method!=='GET')return res.sendStatus(405);try{res.json(await fn(req.query||{}))}catch(e){res.status(502).json({success:false,error:e.message})}},...args)};
module.exports={events,statistics,volume,backtest};
