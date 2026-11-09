'use strict';
const {equityChart}=require('../data/providers'),{validCandles}=require('../data/validation'),{safeSymbol}=require('../shared');
async function getChart(input,range='1mo',interval='1d'){
 const symbol=safeSymbol(input),ranges=new Set(['1d','5d','1mo','3mo','6mo','1y','2y']),intervals=new Set(['1m','5m','15m','30m','1h','1d','1wk']);
 range=ranges.has(String(range))?String(range):'1mo';interval=intervals.has(String(interval))?String(interval):'1d';
 const q=await equityChart(symbol,range,interval),v=q.indicators?.quote?.[0]||{};
 const candles=validCandles((q.timestamp||[]).map((t,i)=>({timestamp:t*1000,open:v.open?.[i],high:v.high?.[i],low:v.low?.[i],close:v.close?.[i],volume:v.volume?.[i]})));
 if(!candles.length)throw Error('No valid chart candles returned');
 return{success:true,available:true,symbol,source:'yahoo-finance',range,interval,candles,generatedAt:new Date().toISOString()};
}
module.exports={getChart};
