(()=>{'use strict';
const ROOT=document.querySelector('.sp-analysis');
if(!ROOT)return;

const BASE='https://strike-pulse-relay.onrender.com';
const $=s=>ROOT.querySelector(s);
const $$=s=>[...ROOT.querySelectorAll(s)];
const value=id=>String($('#'+id)?.value||'').trim();
const fmt=(n,d=2)=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en-IN',{maximumFractionDigits:d});
const api=async(path,params={})=>{
 const u=new URL(BASE+path);
 Object.entries(params).forEach(([k,v])=>{if(v!==''&&v!=null)u.searchParams.set(k,v)});
 const r=await fetch(u,{cache:'no-store'});
 let j=null;try{j=await r.json()}catch(_){throw Error('Invalid provider response')};
 if(!r.ok||j?.success===false)throw Error(j?.error||'Provider data unavailable');
 return j;
};
const logError=(section,e)=>console.warn('[Strike Pulse '+section+']',e?.message||e);

function svg(tag,attrs={}){
 const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
 Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
 return e;
}
function drawLine(box,rows,key,label){
 if(!box)return;
 box.replaceChildren();
 const data=(rows||[]).map(x=>({t:x.t,y:Number(x[key])})).filter(x=>Number.isFinite(x.y));
 if(data.length<2){box.textContent='Insufficient historical data';return}
 const W=760,H=270,L=58,R=18,T=24,B=42;
 let lo=Math.min(...data.map(x=>x.y)),hi=Math.max(...data.map(x=>x.y));
 if(lo===hi){lo-=1;hi+=1}
 const X=i=>L+i*(W-L-R)/Math.max(1,data.length-1);
 const Y=v=>H-B-(v-lo)/(hi-lo)*(H-T-B);
 const g=svg('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':label});
 g.style.cssText='display:block;width:100%;height:auto';
 for(let i=0;i<=4;i++){
  const v=lo+(hi-lo)*i/4,y=Y(v);
  g.append(svg('line',{x1:L,y1:y,x2:W-R,y2:y,stroke:'#64748b','stroke-opacity':'.18','stroke-dasharray':'3 4'}));
  const t=svg('text',{x:L-7,y:y+4,'text-anchor':'end',fill:'#8293ad','font-size':10});
  t.textContent=fmt(v);g.append(t);
 }
 const points=data.map((p,i)=>X(i).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ');
 g.append(svg('polyline',{points,fill:'none',stroke:'#2563eb','stroke-width':2}));
 const title=svg('text',{x:L,y:15,fill:'#526579','font-size':11});title.textContent=label;g.append(title);
 box.append(g);
}
function metric(section,label,val){
 const m=$$('.sp-metric',section).find(x=>x.querySelector('span')?.textContent.trim().toLowerCase()===label.toLowerCase());
 if(m?.querySelector('strong'))m.querySelector('strong').textContent=val==null?'—':String(val);
}
function selectedSymbol(input){
 return String(input?.dataset.selectedSymbol||'').trim().toUpperCase();
}
function clearSelection(input){
 if(!input)return;
 delete input.dataset.selectedSymbol;
 input.classList.remove('sp-search-selected');
}
function makeSearch(input){
 if(!input||input.dataset.spSearchBound)return;
 input.dataset.spSearchBound='1';
 const row=document.createElement('div');
 row.className='sp-stock-search-row';
 row.style.cssText='display:flex;gap:8px;align-items:center;position:relative;width:100%';
 input.parentNode.insertBefore(row,input);
 row.appendChild(input);
 const button=document.createElement('button');
 button.type='button';button.className='sp-btn-secondary sp-field-search-button';button.textContent='Search';
 button.style.cssText='white-space:nowrap;min-height:42px';
 row.appendChild(button);
 const menu=document.createElement('div');
 menu.className='sp-stock-search-menu';menu.setAttribute('role','listbox');
 menu.style.cssText='position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:99999;background:#fff;border:1px solid #d7e3f2;border-radius:10px;box-shadow:0 12px 28px rgba(20,40,70,.16);max-height:280px;overflow:auto;display:none';
 row.appendChild(menu);
 let timer=0,controller=null;
 async function search(){
  const q=input.value.trim();
  clearSelection(input);button.textContent='Search';
  menu.replaceChildren();menu.style.display='none';
  if(!q)return;
  if(controller)controller.abort();
  controller=new AbortController();
  try{
   const r=await fetch(BASE+'/api/stock-search?q='+encodeURIComponent(q),{cache:'no-store',signal:controller.signal});
   const j=await r.json();
   if(!r.ok||j?.success===false)throw Error(j?.error||'Search unavailable');
   const results=Array.isArray(j.results)?j.results:[];
   results.forEach(x=>{
    const b=document.createElement('button');
    b.type='button';b.setAttribute('role','option');
    b.textContent=x.symbol+(x.name?' — '+x.name:'');
    b.style.cssText='display:block;width:100%;padding:11px 13px;text-align:left;border:0;border-bottom:1px solid #edf2f7;background:#fff;color:#243344;cursor:pointer';
    b.addEventListener('click',()=>{
     input.value=x.symbol;
     input.dataset.selectedSymbol=String(x.symbol).toUpperCase();
     input.dataset.selectedName=x.name||'';
     input.classList.add('sp-search-selected');
     button.textContent='Selected ✓';
     menu.style.display='none';
     ROOT.dispatchEvent(new CustomEvent('sp-stock-selected',{detail:{symbol:x.symbol,name:x.name,inputId:input.id}}));
    });
    menu.appendChild(b);
   });
   if(results.length)menu.style.display='block';
  }catch(e){if(e.name!=='AbortError')logError('stock-search',e)}
 }
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,180)});
 button.addEventListener('click',()=>{
  const first=menu.querySelector('button[role="option"]');
  if(first&&menu.style.display!=='none'){first.click();return}
  search();
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=menu.querySelector('button[role="option"]');if(first)first.click();else search()}if(e.key==='Escape')menu.style.display='none'});
 document.addEventListener('click',e=>{if(!row.contains(e.target))menu.style.display='none'});
}
function requireSelected(id){
 const el=$('#'+id);
 const symbol=selectedSymbol(el);
 if(!symbol){el?.focus();return null}
 return symbol;
}
function addSearches(){
 ['chart-symbol','volume-symbol','correlation-stock-a','correlation-stock-b','backtest-symbol','statistical-symbol'].forEach(id=>makeSearch($('#'+id)));
}
function renderStockTable(section,rows){
 const body=section?.querySelector('.sp-table tbody');if(!body)return;
 body.replaceChildren();
 (rows||[]).forEach(x=>{
  const tr=document.createElement('tr');
  [x.symbol,'₹'+fmt(x.price),x.change==null?'—':fmt(x.change)+'%',fmt(x.rsi),x.rvol==null?'—':fmt(x.rvol)+'x',x.vwap?fmt((x.price/x.vwap-1)*100)+'%':'—',x.high20&&x.price>x.high20?'20-candle breakout':x.low20&&x.price<x.low20?'20-candle breakdown':'No confirmed pattern',value('stock-timeframe')||'15 Minutes','View'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
  body.appendChild(tr);
 });
}
async function runStock(){
 const section=$('#stock-scanner');
 const q={universe:value('stock-universe'),minPrice:value('minimum-price'),rvol:value('relative-volume').match(/[0-9.]+/)?.[0]||'',rsiMin:value('rsi-minimum'),rsiMax:value('rsi-maximum')};
 const j=await api('/api/analysis/stock-scanner',q);
 let rows=j.results||[];
 const dir=value('stock-direction');
 if(dir==='Bullish')rows=rows.filter(x=>Number(x.change)>0);
 if(dir==='Bearish')rows=rows.filter(x=>Number(x.change)<0);
 if(dir==='Sideways')rows=rows.filter(x=>Number.isFinite(Number(x.change))&&Math.abs(Number(x.change))<0.3);
 const pattern=value('scan-pattern');
 if(pattern==='Price Breakout')rows=rows.filter(x=>x.high20!=null&&Number(x.price)>Number(x.high20));
 if(pattern==='Price Breakdown')rows=rows.filter(x=>x.low20!=null&&Number(x.price)<Number(x.low20));
 const checks=$$('input[type="checkbox"]',section).filter(x=>x.checked).map(x=>x.closest('label')?.textContent||'');
 if(checks.some(x=>/Above VWAP/i.test(x)))rows=rows.filter(x=>x.vwap!=null&&Number(x.price)>Number(x.vwap));
 if(checks.some(x=>/50 EMA/i.test(x)))rows=rows.filter(x=>x.ema50!=null&&Number(x.price)>Number(x.ema50));
 if(checks.some(x=>/200 EMA/i.test(x)))rows=rows.filter(x=>x.ema200!=null&&Number(x.price)>Number(x.ema200));
 if(checks.some(x=>/Unusual Volume/i.test(x)))rows=rows.filter(x=>x.rvol!=null&&Number(x.rvol)>=2);
 renderStockTable(section,rows);
 section.querySelector('.sp-demo-label')?.replaceChildren(document.createTextNode('PROVIDER DATA'));
}
function optionCharts(section,rows){
 const boxes=$$('.sp-chart-grid .sp-chart-placeholder',$('#contract-research'));
 const specs=[['ltp','Premium (₹)'],['oi','Open Interest'],['iv','Implied Volatility (%)'],['spread','Bid-Ask Spread (%)']];
 specs.forEach(([key,label],i)=>{
  const box=boxes[i];if(!box)return;
  const points=(rows||[]).filter(x=>Number.isFinite(Number(x[key])));
  if(key==='spread'&&points.length<2){box.replaceChildren();return}
  drawLine(box,points.map(x=>({t:x.strike,y:Number(x[key])})), 'y',label);
 });
}
function selectContract(x){
 const r=$('#contract-research');if(!r)return;
 r.querySelector('.sp-contract-heading h3').textContent=x.symbol+' '+fmt(x.strike)+' '+x.type;
 r.querySelector('.sp-contract-heading .sp-muted').textContent='Selected provider contract · '+(x.expiry||'—');
 r.querySelector('.sp-contract-price strong').textContent='₹'+fmt(x.ltp);
 const vals=[fmt(x.oi,0),fmt(x.volume,0),x.iv==null?'—':fmt(x.iv)+'%',x.spread==null?'—':fmt(x.spread)+'%'];
 $$('.sp-metric strong',r).forEach((e,i)=>{if(i<vals.length)e.textContent=vals[i]});
 const boxes=$$('.sp-chart-grid .sp-chart-placeholder',r);
 boxes.forEach((b,i)=>{if(i===3)b.replaceChildren()});
 r.dataset.spSelectedContract=[x.symbol,x.expiry,x.strike,x.type].join('|');
}
async function runOption(){
 const section=$('#option-scanner');
 const type=value('option-type').includes('Call')?'CE':value('option-type').includes('Put')?'PE':'both';
 const j=await api('/api/analysis/option-scanner',{symbol:value('option-underlying'),type,minOi:value('oi-change'),minVolume:value('minimum-option-volume'),minIv:value('minimum-iv'),maxSpread:value('maximum-spread')});
 let rows=(j.results||[]).filter(x=>Number(x.ltp)>0);
 const minOi=value('oi-change'),minVol=value('minimum-option-volume'),minIv=value('minimum-iv'),maxSpread=value('maximum-spread');
 if(minOi!=='')rows=rows.filter(x=>x.oiPct!=null&&Number(x.oiPct)>=Number(minOi));
 if(minVol!=='')rows=rows.filter(x=>x.volume!=null&&Number(x.volume)>=Number(minVol));
 if(minIv!=='')rows=rows.filter(x=>x.iv!=null&&Number(x.iv)>=Number(minIv));
 if(maxSpread!=='')rows=rows.filter(x=>x.spread!=null&&Number(x.spread)<=Number(maxSpread));
 const body=section.querySelector('.sp-table tbody');body.replaceChildren();
 rows.slice(0,150).forEach(x=>{
  const tr=document.createElement('tr');
  const vals=[x.symbol,fmt(x.strike),x.type,x.expiry||'—','₹'+fmt(x.ltp),fmt(x.oi,0),x.oiPct==null?'—':fmt(x.oiPct)+'%',fmt(x.volume,0),x.iv==null?'—':fmt(x.iv)+'%','Provider data'];
  vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
  const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent='Analyze';b.className='sp-option-analyze-button';td.appendChild(b);tr.appendChild(td);
  b.addEventListener('click',e=>{e.stopPropagation();selectContract(x)});
  tr.addEventListener('click',()=>selectContract(x));
  body.appendChild(tr);
 });
 optionCharts(section,rows);
}
async function runChart(){
 const section=$('#chart-lab'),symbol=requireSelected('chart-symbol');
 const main=section.querySelector('.sp-main-chart .sp-chart-placeholder');
 if(!symbol){main.textContent='Select an NSE stock to view the chart.';return}
 const tf=value('chart-timeframe'),interval=tf==='1h'?'60m':tf==='1D'?'1d':tf==='1W'?'1wk':tf||'15m',range=interval==='1d'||interval==='1wk'?'1y':'5d';
 const j=await api('/api/analysis/chart',{symbol,interval,range});
 const rows=(j.candles||[]).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
 main.replaceChildren();
 if(rows.length<2){main.textContent='Insufficient OHLC candles';return}
 const W=900,H=360,L=55,R=15,T=20,B=35,lo=Math.min(...rows.map(x=>x.l)),hi=Math.max(...rows.map(x=>x.h)),X=i=>L+(i+.5)*(W-L-R)/rows.length,Y=v=>H-B-(v-lo)/(hi-lo||1)*(H-T-B),g=svg('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':symbol+' historical candlestick chart'});
 g.style.cssText='display:block;width:100%;height:auto';
 rows.forEach((x,i)=>{const px=X(i),up=x.c>=x.o,col=up?'#16a34a':'#dc3545';g.append(svg('line',{x1:px,y1:Y(x.h),x2:px,y2:Y(x.l),stroke:col}));g.append(svg('rect',{x:px-3,y:Math.min(Y(x.o),Y(x.c)),width:6,height:Math.max(1,Math.abs(Y(x.o)-Y(x.c))),fill:col}))});
 const title=svg('text',{x:L,y:14,fill:'#526579','font-size':12});title.textContent=symbol+' · '+tf;g.append(title);main.append(g);
 const mini=$$('.sp-chart-grid .sp-chart-placeholder',section);
 if(mini[0])drawLine(mini[0],rows.map((x)=>({t:x.t,y:x.c})), 'y','Price');
 if(mini[1])drawLine(mini[1],rows.map((x,i)=>({t:x.t,y:i<14?null:(()=>{let up=0,down=0;for(let k=i-13;k<=i;k++){const d=rows[k].c-rows[k-1].c;up+=Math.max(0,d);down+=Math.max(0,-d)}return down?100-100/(1+up/down):100})()})),'y','RSI 14');
 if(mini[2])drawLine(mini[2],rows.map((x,i)=>({t:x.t,y:i<26?null:rows.slice(i-11,i+1).reduce((a,b)=>a+b.c,0)/12-rows.slice(i-25,i+1).reduce((a,b)=>a+b.c,0)/26})),'y','MACD');
}
async function runVolume(){
 const symbol=requireSelected('volume-symbol');if(!symbol)return;
 const j=await api('/api/analysis/volume-lab',{symbol,sessions:value('volume-period').match(/\d+/)?.[0]||20});
 const section=$('#volume-lab'),rows=j.points||j.data||[];
 const rv=j.relativeVolume??j.rvol;
 metric(section,'Relative Volume',rv==null?'—':fmt(rv)+'x');
 const boxes=$$('.sp-chart-placeholder',section);
 if(boxes[0])drawLine(boxes[0],rows,'volume','Historical Volume');
 if(boxes[1])drawLine(boxes[1],rows,'rvol','Relative Volume');
}
async function runCorrelation(){
 const a=requireSelected('correlation-stock-a'),b=requireSelected('correlation-stock-b');if(!a||!b)return;
 const j=await api('/api/analysis/correlation',{symbolA:a,symbolB:b,benchmark:value('correlation-benchmark'),sessions:value('correlation-window').match(/\d+/)?.[0]||20});
 const section=$('#correlation-lab');
 const corr=j.correlation??j.rollingCorrelation,beta=j.beta??j.rollingBeta,z=j.zScore??j.spreadZScore,te=j.trackingError;
 metric(section,'Rolling Correlation',corr==null?'—':fmt(corr,3));
 metric(section,'Rolling Beta',beta==null?'—':fmt(beta,3));
 metric(section,'Spread Z-Score',z==null?'—':fmt(z,3));
 metric(section,'Tracking Error',te==null?'—':fmt(te,3));
 const rows=j.points||j.data||[];
 const boxes=$$('.sp-chart-placeholder',section);
 if(boxes[0])drawLine(boxes[0],rows,'a',a);
 if(boxes[1])drawLine(boxes[1],rows,'b',b);
 if(boxes[2])drawLine(boxes[2],rows,'correlation','Rolling Correlation');
 if(boxes[3])drawLine(boxes[3],rows,'spread','Spread');
}
async function runBacktest(){
 const symbol=requireSelected('backtest-symbol');if(!symbol)return;
 const j=await api('/api/analysis/backtest',{symbol,strategy:value('backtest-strategy'),timeframe:value('backtest-timeframe'),hold:value('backtest-hold').match(/\d+/)?.[0]||5,cost:value('backtest-cost'),slippage:value('backtest-slippage')});
 const section=$('#backtesting');
 const map=[['Total Signals','totalSignals'],['Win Rate','winRate'],['Profit Factor','profitFactor'],['Expectancy','expectancy'],['Maximum Drawdown','maxDrawdown'],['Sharpe Ratio','sharpe']];
 map.forEach(([label,key])=>{let v=j[key];if(v!=null&&/Rate|Drawdown/.test(label)&&Number.isFinite(Number(v)))v=fmt(v)+'%';metric(section,label,v)});
 const rows=j.points||j.equityCurve||[];
 const boxes=$$('.sp-chart-placeholder',section);
 if(boxes[0])drawLine(boxes[0],rows,'equity','Equity Curve');
 if(boxes[1])drawLine(boxes[1],rows,'drawdown','Drawdown');
}
async function runStatistics(){
 const symbol=requireSelected('statistical-symbol');if(!symbol)return;
 const j=await api('/api/analysis/statistics',{symbol,sessions:value('statistical-period').match(/\d+/)?.[0]||60,pattern:value('statistical-pattern'),forward:value('forward-window').match(/\d+/)?.[0]||5});
 const section=$('#statistics');
 const map=[['Historical Occurrences','occurrences'],['Positive Return Frequency','positiveRatePct'],['Median Forward Return','medianForwardReturnPct'],['False Breakout Rate','falseBreakoutRatePct']];
 map.forEach(([label,key])=>{const v=j[key];metric(section,label,v==null?'—':(/Frequency|Return|Rate/.test(label)&&Number.isFinite(Number(v))?fmt(v)+'%':fmt(v,2)))});
 const rows=j.points||j.data||[];
 const boxes=$$('.sp-chart-placeholder',section);
 if(boxes[0])drawLine(boxes[0],rows,'returnPct','Forward Return');
 if(boxes[1])drawLine(boxes[1],rows,'frequency','Event Frequency');
}
function wire(id,fn){
 const section=$('#'+id),button=section?.querySelector('button.sp-btn-primary');
 if(!button)return;
 button.addEventListener('click',async e=>{
  e.preventDefault();if(button.dataset.running==='1')return;
  button.dataset.running='1';button.disabled=true;
  try{await fn()}catch(err){logError(id,err)}finally{button.disabled=false;delete button.dataset.running}
 });
}
function wireChart(){
 const section=$('#chart-lab');if(!section)return;
 const button=document.createElement('button');button.type='button';button.className='sp-btn-primary';button.textContent='Load Chart';
 section.querySelector('.sp-main-chart')?.insertAdjacentElement('afterend',button);
 button.addEventListener('click',()=>runChart().catch(e=>logError('chart-lab',e)));
}
function exportStock(){
 const button=$('#export-stock-csv'),body=$('#stock-scanner tbody');if(!button||!body)return;
 button.addEventListener('click',()=>{
  const rows=$$('#stock-scanner tr').map(tr=>$$('th,td',tr).map(td=>'"'+td.textContent.replace(/"/g,'""')+'"').join(','));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download='strike-pulse-stock-scan.csv';a.click();
 });
}
function saveStock(){
 const button=$('#save-stock-screen'),body=$('#stock-scanner tbody');if(!button||!body)return;
 button.addEventListener('click',()=>{
  const rows=$$('#stock-scanner tr').map(tr=>$$('th,td',tr).map(td=>td.textContent.trim()));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({savedAt:new Date().toISOString(),rows},null,2)],{type:'application/json'}));a.download='strike-pulse-stock-screen.json';a.click();
 });
}
function init(){
 addSearches();
 wire('stock-scanner',runStock);
 wire('option-scanner',runOption);
 wire('volume-lab',runVolume);
 wire('correlation-lab',runCorrelation);
 wire('backtesting',runBacktest);
 wire('statistics',runStatistics);
 wireChart();exportStock();saveStock();
 const badge=$('.sp-data-badge');
 api('/api/analysis/status').then(()=>{if(badge)badge.textContent='BACKEND CONNECTED · DATA ON REQUEST'}).catch(()=>{if(badge)badge.textContent='PROVIDER DATA UNAVAILABLE'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();