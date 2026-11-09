'use strict';
function runEmaCrossover(candles,fastPeriod=10,slowPeriod=20,options={}){
 if(!Array.isArray(candles)||candles.length<slowPeriod+2)throw Error('Insufficient historical candles');
 if(!(Number.isInteger(fastPeriod)&&Number.isInteger(slowPeriod)&&fastPeriod>0&&slowPeriod>fastPeriod))throw Error('Invalid EMA periods');
 const close=candles.map(x=>Number(x.close));if(close.some(x=>!Number.isFinite(x)||x<=0))throw Error('Invalid candle close');
 const stop=Number(options.stopLossPct)>0?Number(options.stopLossPct):null,target=Number(options.targetPct)>0?Number(options.targetPct):null,fee=Math.max(0,Number(options.feeBps)||0),slippage=Math.max(0,Number(options.slippageBps)||0),roundTripCost=2*(fee+slippage)/100;
 if(fee>500||slippage>500)throw Error('Fee/slippage must not exceed 500 bps per side');
 const ema=p=>{const a=2/(p+1);let prev=null;return close.map(x=>(prev=prev===null?x:x*a+prev*(1-a)));},f=ema(fastPeriod),s=ema(slowPeriod);
 let position=null,trades=[];
 const exit=(i,price,reason)=>{const gross=(price/position.price-1)*100,net=gross-roundTripCost;trades.push({entry:{price:position.price,timestamp:candles[position.index].timestamp},exit:{price,timestamp:candles[i].timestamp},grossReturnPercent:gross,costPercent:roundTripCost,returnPercent:net,exitReason:reason});position=null;};
 for(let i=1;i<close.length;i++){
  if(position){
   const low=Number(candles[i].low),high=Number(candles[i].high),stopPrice=stop?position.price*(1-stop/100):null,targetPrice=target?position.price*(1+target/100):null;
   if(stopPrice&&Number.isFinite(low)&&low<=stopPrice){exit(i,stopPrice,'stop-loss');continue;}
   if(targetPrice&&Number.isFinite(high)&&high>=targetPrice){exit(i,targetPrice,'target');continue;}
   if(f[i]<s[i]&&f[i-1]>=s[i-1])exit(i,close[i],'ema-cross-down');
  }else if(f[i]>s[i]&&f[i-1]<=s[i-1])position={price:close[i],index:i};
 }
 const wins=trades.filter(t=>t.returnPercent>0),losses=trades.filter(t=>t.returnPercent<0),grossWin=wins.reduce((a,t)=>a+t.returnPercent,0),grossLoss=Math.abs(losses.reduce((a,t)=>a+t.returnPercent,0));
 let equity=1,peak=1,maxDD=0;for(const t of trades){equity*=1+t.returnPercent/100;peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak*100);}
 const buyHold=(close.at(-1)/close[0]-1)*100;
 return{strategy:'Long-only EMA crossover',fastPeriod,slowPeriod,stopLossPct:stop,targetPct:target,feeBps:fee,slippageBps:slippage,trades,openPosition:position?{price:position.price,timestamp:candles[position.index].timestamp}:null,metrics:{closedTrades:trades.length,winRate:trades.length?wins.length/trades.length*100:null,averageReturn:trades.length?trades.reduce((a,t)=>a+t.returnPercent,0)/trades.length:null,profitFactor:grossLoss?grossWin/grossLoss:(grossWin?null:0),maxDrawdown:maxDD,netReturn:trades.reduce((a,t)=>a+t.returnPercent,0),buyAndHoldReturn:buyHold},note:'Historical long-only simulation. Costs are approximate; stop/target intrabar ordering assumes stop is hit first when both levels are crossed.'};
}
module.exports={runEmaCrossover};