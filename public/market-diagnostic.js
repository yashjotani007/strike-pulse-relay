/* Strike Pulse read-only diagnostic. Run on your WordPress analysis page. */
(async()=>{
'use strict';
const base='https://strike-pulse-relay.onrender.com',started=Date.now(),rows=[];
const add=(area,test,status,details)=>{rows.push({area,test,status,details:String(details??'')});console.log((status==='PASS'?'✅':status==='FAIL'?'❌':status==='WARN'?'⚠️':'ℹ️')+' '+test+': '+details)};
const fetchJSON=async(path,ms=18000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(base+path,{cache:'no-store',signal:c.signal});const j=await r.json();if(!r.ok||j.success!==true)throw Error(j.error||'HTTP '+r.status);return j}finally{clearTimeout(t)}};
const test=async(area,name,path,validate,ms)=>{try{const j=await fetchJSON(path,ms);const result=validate(j);add(area,name,result.ok?'PASS':'WARN',result.message);return j}catch(e){add(area,name,'FAIL',e.message);return null}};
console.group('Strike Pulse — full read-only diagnostic');
add('Page','Analysis page HTML',document.querySelector('.sp-analysis')?'PASS':'WARN',document.querySelector('.sp-analysis')?'Wrapper found':'Open the WordPress analysis page to test UI');
add('Page','Main script initialized',window.__SP_ANALYSIS_V1__?'PASS':'WARN',window.__SP_ANALYSIS_V1__?'Main JavaScript initialized':'Script not initialized on this page');
for(const [name,selector] of [['Global search','#sp-universal-search input'],['Searchable scanner','#sp-extended-tools input[type=search]'],['Selected-stock scan button','#sp-extended-tools button'],['Stock Scanner','#stock-scanner'],['Option Scanner','#option-scanner'],['Chart Lab','#chart-lab'],['Volume Lab','#volume-lab'],['Correlation Lab','#correlation-lab'],['Backtesting','#backtesting'],['Statistics','#statistics']]){const el=document.querySelector('.sp-analysis '+selector);add('UI',name,el?'PASS':'WARN',el?'Present in DOM':'Not found; may be unimplemented or selector differs')}
const status=await test('Backend','Feature status','/api/analysis/status',j=>({ok:!!j.features,message:JSON.stringify(j.features)}));
await test('Directory','NSE stock directory','/api/analysis/universe?q=TCS&limit=5',j=>({ok:j.results?.some(x=>x.symbol==='TCS'),message:j.total+' matching symbols; TCS '+(j.results?.some(x=>x.symbol==='TCS')?'found':'missing')}));
await test('Scanner','Selected-stock scan','/api/analysis/stock-scanner?symbol=TCS',j=>({ok:j.results?.some(x=>x.symbol==='TCS'),message:j.results?.length+' results; '+j.failed+' provider failures'}));
await test('Scanner','Custom NSE stock scan','/api/analysis/scan-batch?symbols=TCS,RELIANCE&limit=2',j=>({ok:j.results?.length>0,message:j.results?.length+' of '+j.requested+' returned; '+j.failed?.length+' provider failures'}));
await test('Chart','Historical chart','/api/analysis/chart?symbol=TCS&interval=1d&range=1mo',j=>({ok:j.candles?.length>1,message:j.candles?.length+' historical candles'}));
await test('Correlation','Correlation research','/api/analysis/correlation?symbols=TCS,RELIANCE',j=>({ok:j.matrix?.length===2&&j.sessions>=20,message:j.sessions+' overlapping sessions; '+j.matrix?.length+' symbols'}));
await test('Backtest','SMA backtesting','/api/analysis/backtest?symbol=TCS&fast=10&slow=30',j=>({ok:Number.isFinite(j.totalReturn),message:'Trades '+j.trades+', historical return '+Number(j.totalReturn).toFixed(2)+'%'}));
await test('Options','Option-chain scanner','/api/analysis/option-scanner?symbol=NIFTY',j=>({ok:Array.isArray(j.results),message:j.results?.length+' contracts; source '+j.source}),25000);
for(const name of ['Volume Lab advanced analysis','Statistics historical patterns','Full BSE coverage','Live trading execution'])add('Scope',name,'INFO','Not implemented/verified by this diagnostic');
const counts=rows.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
const report={diagnostic:'Strike Pulse',time:new Date().toISOString(),page:location.href,durationMs:Date.now()-started,counts,checks:rows,featureStatus:status?.features||null};
console.table(rows);console.log('SUMMARY',counts);console.log('FULL REPORT JSON — copy this if needed:',JSON.stringify(report,null,2));console.groupEnd();
window.__SP_DIAGNOSTIC_REPORT__=report;
try{if(navigator.clipboard&&document.hasFocus()){await navigator.clipboard.writeText(JSON.stringify(report,null,2));console.log('Report copied to clipboard.')}else console.log('Copy report from console: window.__SP_DIAGNOSTIC_REPORT__')}catch(e){console.log('Clipboard unavailable; report saved in window.__SP_DIAGNOSTIC_REPORT__')}
return report;
})().catch(e=>console.error('Diagnostic failed:',e));