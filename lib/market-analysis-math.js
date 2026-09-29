'use strict';
// Pure, provider-independent quantitative helpers. No fabricated market data.
const finite = x => typeof x === 'number' && Number.isFinite(x);
function mean(xs) { if (!xs.length || !xs.every(finite)) return null; return xs.reduce((a,b)=>a+b,0)/xs.length; }
function variance(xs, sample=false) { const m=mean(xs); if(m===null || xs.length< (sample?2:1)) return null; return xs.reduce((a,x)=>a+(x-m)**2,0)/(xs.length-(sample?1:0)); }
function pearson(xs,ys) {
 if(xs.length!==ys.length || xs.length<3 || !xs.every(finite) || !ys.every(finite)) return null;
 const mx=mean(xs),my=mean(ys); let cov=0,vx=0,vy=0;
 xs.forEach((x,i)=>{const a=x-mx,b=ys[i]-my;cov+=a*b;vx+=a*a;vy+=b*b});
 return vx>0 && vy>0 ? cov/Math.sqrt(vx*vy) : null;
}
function returns(candles) {
 const rows=[...candles].filter(x=>finite(x.t)&&finite(x.c)&&x.c>0).sort((a,b)=>a.t-b.t);
 const result=new Map();
 for(let i=1;i<rows.length;i++) if(rows[i-1].c>0 && rows[i].t!==rows[i-1].t) result.set(rows[i].t,rows[i].c/rows[i-1].c-1);
 return result;
}
function alignedReturns(a,b) {
 const x=returns(a),y=returns(b),dates=[...x.keys()].filter(t=>y.has(t)).sort((a,b)=>a-b);
 return {dates,a:dates.map(t=>x.get(t)),b:dates.map(t=>y.get(t))};
}
function rollingCorrelation(a,b,window) {
 if(!Number.isInteger(window)||window<3||a.length!==b.length) throw Error('Invalid rolling window');
 return a.map((_,i)=>i+1<window?null:pearson(a.slice(i+1-window,i+1),b.slice(i+1-window,i+1)));
}
function beta(a,benchmark) {
 if(a.length!==benchmark.length||a.length<3||!a.every(finite)||!benchmark.every(finite))return null;
 const mb=mean(benchmark),ma=mean(a),v=benchmark.reduce((s,x)=>s+(x-mb)**2,0);
 return v>0?a.reduce((s,x,i)=>s+(x-ma)*(benchmark[i]-mb),0)/v:null;
}
function zscore(values) {
 if(values.length<3||!values.every(finite))return null;
 const v=variance(values);return v>0?(values.at(-1)-mean(values))/Math.sqrt(v):null;
}
function trackingError(activeReturns,annualization=252) {
 const v=variance(activeReturns,true);return v===null?null:Math.sqrt(v*annualization);
}
function drawdown(equity) {
 if(!equity.length||!equity.every(x=>finite(x)&&x>0))return null;
 let peak=equity[0],worst=0;const series=equity.map(x=>{peak=Math.max(peak,x);const dd=x/peak-1;worst=Math.min(worst,dd);return dd});
 return {maximum:worst,series};
}
function median(xs) {
 if(!xs.length||!xs.every(finite))return null;
 const a=[...xs].sort((x,y)=>x-y),n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;
}
function summarizeForwardReturns(xs) {
 if(!xs.length||!xs.every(finite))return {occurrences:0,positiveFrequency:null,medianReturn:null};
 return {occurrences:xs.length,positiveFrequency:xs.filter(x=>x>0).length/xs.length,medianReturn:median(xs)};
}
module.exports={mean,variance,pearson,returns,alignedReturns,rollingCorrelation,beta,zscore,trackingError,drawdown,median,summarizeForwardReturns};
