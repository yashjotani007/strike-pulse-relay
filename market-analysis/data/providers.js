'use strict';
const {safeSymbol}=require('../shared');
const INDEXES={NIFTY:'^NSEI',BANKNIFTY:'^NSEBANK',FINNIFTY:'^CNXFIN',SENSEX:'^BSESN','INDIA-VIX':'^INDIAVIX',INDIAVIX:'^INDIAVIX',MIDCPNIFTY:'^NSEMDCP50',NIFTYNXT50:'^NSMIDCP'};
async function yahooChart(symbol,range='5d',interval='5m'){
 const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+encodeURIComponent(range)+'&interval='+encodeURIComponent(interval),{headers:{'User-Agent':'Mozilla/5.0 StrikePulseResearch/2.0','Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Yahoo Finance HTTP '+r.status);
 const j=await r.json(),q=j?.chart?.result?.[0];if(!q)throw Error(j?.chart?.error?.description||'Historical market data unavailable');return q;
}
async function marketChart(input,range,interval){const s=safeSymbol(input),provider=INDEXES[s]||s+'.NS',q=await yahooChart(provider,range,interval);if(!String(q.meta?.symbol||'').toUpperCase().includes(provider.toUpperCase()))throw Error('Provider symbol verification failed');return q;}
async function equityChart(symbol,range,interval){const s=safeSymbol(symbol);if(INDEXES[s])throw Error('Index symbols are not equity stocks');return marketChart(s,range,interval);}
module.exports={yahooChart,equityChart,marketChart,INDEXES};