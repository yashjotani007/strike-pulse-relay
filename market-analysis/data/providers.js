'use strict';
const {safeSymbol}=require('../shared');
async function yahooChart(symbol,range='5d',interval='5m'){
 const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+encodeURIComponent(range)+'&interval='+encodeURIComponent(interval),{headers:{'User-Agent':'Mozilla/5.0 StrikePulseResearch/1.0','Accept':'application/json'},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Yahoo Finance HTTP '+r.status);
 const j=await r.json(),q=j?.chart?.result?.[0];if(!q)throw Error(j?.chart?.error?.description||'Historical market data unavailable');return q;
}
async function equityChart(symbol,range,interval){const s=safeSymbol(symbol),q=await yahooChart(s+'.NS',range,interval);if(!String(q.meta?.symbol||'').toUpperCase().endsWith('.NS'))throw Error('Provider symbol verification failed');return q;}
module.exports={yahooChart,equityChart};
