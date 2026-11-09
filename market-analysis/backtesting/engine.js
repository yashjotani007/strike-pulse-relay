'use strict';
function runEmaCrossover(candles,fastPeriod=10,slowPeriod=20){
 if(!Array.isArray(candles)||candles.length<slowPeriod+2)throw Error('Insufficient historical candles');
 if(!(fastPeriod>0&&slowPeriod>fastPeriod))throw Error('Invalid EMA periods');
 const close=candles.map(x=>Number(x.close));if(close.some(x=>!Number.isFinite(x)||x<=0))throw Error('Invalid candle close');
 const ema=p=>{const a=2/(p+1);let prev=null;return close.map(x=>(prev=prev===null?x:x*a+prev*(1-a)));},f=ema(fastPeriod),s=ema(slowPeriod);
 let position=null,trades=[];
 for(let i=1;i<close.length;i++){if(!position&&f[i]>s[i]&&f[i-1]<=s[i-1])position={price:close[i],timestamp:candles[i].timestamp};else if(position&&f[i]<s[i]&&f[i-1]>=s[i-1]){trades.push({entry:position,exit:{price:close[i],timestamp:candles[i].timestamp},returnPercent:(close[i]/position.price-1)*100});position=null;}}
 return{strategy:'EMA crossover',fastPeriod,slowPeriod,trades,openPosition:position?{entry:position}:null,note:'Research simulation only; brokerage, slippage and taxes are excluded.'};
}
module.exports={runEmaCrossover};
