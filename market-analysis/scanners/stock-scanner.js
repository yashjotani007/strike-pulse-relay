'use strict';
const {equityChart}=require('../data/providers'),{validCandles}=require('../data/validation'),{safeSymbol}=require('../shared');
const {calculateEMA,calculateRSI}=require('../charts/indicators');
async function scanStock(input){
 const symbol=safeSymbol(input),q=await equityChart(symbol,'1mo','1d'),v=q.indicators?.quote?.[0]||{};
 const candles=validCandles((q.timestamp||[]).map((t,i)=>({timestamp:t*1000,open:v.open?.[i],high:v.high?.[i],low:v.low?.[i],close:v.close?.[i],volume:v.volume?.[i]})));
 if(candles.length<20)throw Error('At least 20 valid daily candles are required');
 const closes=candles.map(x=>x.close),vol=candles.map(x=>x.volume).filter(x=>x!=null),last=candles.at(-1),avg=vol.slice(-20).reduce((a,b)=>a+b,0)/Math.min(20,vol.slice(-20).length);
 return{success:true,available:true,symbol,name:q.meta?.longName||q.meta?.shortName||symbol,exchange:'NSE',source:'yahoo-finance',interval:'1d',price:last.close,changePercent:q.meta?.chartPreviousClose?((last.close-q.meta.chartPreviousClose)/q.meta.chartPreviousClose)*100:null,indicators:{rsi14:calculateRSI(closes,14).at(-1),ema20:calculateEMA(closes,20).at(-1),ema50:calculateEMA(closes,50).at(-1),volumeRatio:avg>0&&last.volume!=null?last.volume/avg:null},candles,generatedAt:new Date().toISOString()};
}
module.exports={scanStock};
