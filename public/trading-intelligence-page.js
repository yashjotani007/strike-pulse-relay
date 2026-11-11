/* Strike Pulse — standalone Trading Intelligence page */
(()=>{'use strict';
if(window.__SP_TRADING_INTELLIGENCE_PAGE_V1__)return;
window.__SP_TRADING_INTELLIGENCE_PAGE_V1__=true;
const API='https://strike-pulse-relay.onrender.com/api/market-intelligence';
const ROOT_ID='sp-ti-page';
const $=(sel,root=document)=>root.querySelector(sel);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const fmt=(v,d=2)=>num(v)==null?'—':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const table=(heads,rows,empty)=>'<div class="ti-table-wrap"><table><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+heads.length+'" class="ti-empty">'+esc(empty||'No verified records available')+'</td></tr>')+'</tbody></table></div>';
let busy=false,lastGood=null,root=null;
function markup(){return [
'<header class="ti-hero"><div><p class="ti-eyebrow">STRIKE PULSE · RESEARCH TERMINAL</p><h1>Trading Intelligence</h1><p class="ti-lead">Institutional activity, disclosed large deals, delivery participation and ownership disclosures. Exchange-published data only — research and analysis, not trading execution.</p></div><div class="ti-tools"><span class="ti-status" id="ti-status" role="status">Connecting to verified sources…</span><button class="ti-refresh" id="ti-refresh" type="button">↻ Refresh All</button></div></header>',
'<nav class="ti-nav" aria-label="Trading Intelligence sections"><a href="#ti-institutional">Institutional Activity</a><a href="#ti-live-pressure">Live Activity</a><a href="#ti-stock-flow">Stock-wise Flow</a><a href="#ti-bulk">Bulk Deals</a><a href="#ti-block">Block Deals</a><a href="#ti-delivery">Delivery Trends</a><a href="#ti-ownership">Ownership & Disclosures</a></nav>',
'<section class="ti-section" id="ti-institutional"><div class="ti-section-head"><div><h2>01 · Institutional Activity</h2><p class="ti-desc">Market-wide FII/FPI and DII cash-market gross purchases, gross sales and net flow.</p></div><span class="ti-meta" id="ti-inst-meta">NSE India · awaiting report</span></div><div class="ti-kpis"><article class="ti-kpi"><small>FII / FPI NET FLOW · ₹ CRORE</small><strong id="ti-fii-net">—</strong><span id="ti-fii-date">Report date: —</span></article><article class="ti-kpi"><small>DII NET FLOW · ₹ CRORE</small><strong id="ti-dii-net">—</strong><span id="ti-dii-date">Report date: —</span></article></div><div id="ti-inst-table" style="margin-top:14px"></div><p class="ti-note">These are market-wide totals, not stock-wise flows. Exchange figures may be provisional and can be revised. Report date and source are shown separately from the time this page fetched the data.</p></section>',
'<section class="ti-section" id="ti-live-pressure"><div class="ti-section-head"><div><h2>02 · Live Institutional Activity Tracker</h2><p class="ti-desc">Same-day NIFTY 50 market-pressure estimate, refreshed automatically during market hours.</p></div><span class="ti-meta" id="ti-live-meta">Connecting to NSE snapshot…</span></div><div class="ti-live-disclaimer">ESTIMATED MARKET PROXY · This is turnover-weighted price momentum, not confirmed FII/DII flow. It cannot identify the investor behind a trade.</div><div class="ti-live-kpis"><article class="ti-kpi"><small>MARKET PRESSURE SCORE</small><strong id="ti-live-score">—</strong><span id="ti-live-bias">Waiting for live snapshot</span></article><article class="ti-kpi"><small>ADVANCING STOCK TURNOVER · ₹ CR</small><strong id="ti-live-up">—</strong><span id="ti-live-adv">Advancing stocks: —</span></article><article class="ti-kpi"><small>DECLINING STOCK TURNOVER · ₹ CR</small><strong id="ti-live-down">—</strong><span id="ti-live-dec">Declining stocks: —</span></article></div><div class="ti-live-tables"><div><h3>Strongest Positive Pressure</h3><div id="ti-live-positive"></div></div><div><h3>Strongest Negative Pressure</h3><div id="ti-live-negative"></div></div></div><p class="ti-note" id="ti-live-note">NSE constituent snapshot is used where available. Auto-refresh interval: 30 seconds. Actual FII/DII identity-wise intraday trades are not publicly identified by this feed.</p></section>
<section class="ti-section" id="ti-stock-flow"><div class="ti-section-head"><div><h2>03 · Stock-wise Institutional Flow</h2><p class="ti-desc">Stock-level FII and DII gross buy/sell transactions.</p></div><span class="ti-meta">Source verification required</span></div><div class="ti-note ti-warning">Complete stock-wise FII/DII gross Buy and Sell data is not currently confirmed in a free public feed. No market-wide figures, holdings changes, bulk deals or estimates are substituted here.</div><div class="ti-meta" style="margin-top:8px">Historical FII trade-wise records may be available from CDSL for limited archived periods; this is not a current daily FII + DII feed.</div></section>',
'<section class="ti-section" id="ti-bulk"><div class="ti-section-head"><div><h2>04 · Bulk Deals</h2><p class="ti-desc">Exchange-disclosed bulk transactions in the available report window.</p></div><span class="ti-meta" id="ti-bulk-meta">NSE disclosures</span></div><div id="ti-bulk-table"></div></section>',
'<section class="ti-section" id="ti-block"><div class="ti-section-head"><div><h2>05 · Block Deals</h2><p class="ti-desc">Exchange-disclosed block transactions in the available report window.</p></div><span class="ti-meta" id="ti-block-meta">NSE disclosures</span></div><div id="ti-block-table"></div></section>',
'<section class="ti-section" id="ti-delivery"><div class="ti-section-head"><div><h2>06 · Delivery Trends</h2><p class="ti-desc">Security-wise deliverable quantity and delivery percentage from NSE full bhavcopy.</p></div><span class="ti-meta" id="ti-delivery-meta">NSE full bhavcopy</span></div><div class="ti-toolbar"><span class="ti-meta">Ranked by deliverable quantity · thinly traded symbols filtered</span><input class="ti-search" id="ti-search" type="search" placeholder="Filter visible tables by symbol / client"></div><div id="ti-delivery-table"></div><p class="ti-note" id="ti-delivery-note">Delivery is a participation metric, not proof of institutional buying or a directional signal.</p></section>',
'<section class="ti-section" id="ti-ownership"><div class="ti-section-head"><div><h2>07 · Ownership & Regulatory Disclosures</h2><p class="ti-desc">Promoter, insider and mutual-fund portfolio disclosures.</p></div><span class="ti-meta">Separate disclosure sources</span></div><div class="ti-placeholder-grid"><article class="ti-placeholder"><strong>Promoter Transactions</strong><span id="ti-promoter-state">Official exchange disclosure parser is not connected yet. No unverified transaction rows are shown.</span></article><article class="ti-placeholder"><strong>Insider Transactions</strong><span id="ti-insider-state">SEBI PIT / exchange disclosure parser is not connected yet. No inferred insider activity is shown.</span></article><article class="ti-placeholder"><strong>Mutual Fund Holdings</strong><span id="ti-mf-state">Monthly portfolio disclosure parser is not connected yet. No holdings are estimated from price movement.</span></article></div></section>',
'<footer class="ti-footer">Powered By Yash Jotani · Data is shown only when a source response is available. A successful refresh does not imply live market data; some exchange reports are published after market hours. Research only.</footer>'
].join('')}

function renderLivePressure(payload){
 const d=payload?.data||payload||{};
 const meta=$('#ti-live-meta',root);
 if(!d.available){meta.textContent=d.reason||'Live snapshot unavailable';$('#ti-live-note',root).textContent='NSE live constituent snapshot is currently unavailable. Official FII/DII report remains separate.';return;}
 const score=$('#ti-live-score',root),bias=$('#ti-live-bias',root);
 score.textContent=(d.pressure>0?'+':'')+fmt(d.pressure)+'%';
 score.className=d.pressure>0?'ti-positive':d.pressure<0?'ti-negative':'';
 bias.textContent=d.bias+' · '+d.session;
 $('#ti-live-up',root).textContent=fmt(d.upTurnoverCr);
 $('#ti-live-down',root).textContent=fmt(d.downTurnoverCr);
 $('#ti-live-adv',root).textContent='Advancing stocks: '+d.advances+' / '+d.symbols;
 $('#ti-live-dec',root).textContent='Declining stocks: '+d.declines+' / '+d.symbols;
 meta.textContent=d.source+' · '+d.reportDate+' · '+new Date(d.updatedAt||Date.now()).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'});
 const map=rows=>rows.map(x=>[x.symbol,(x.change>0?'+':'')+fmt(x.change)+'%',fmt(x.turnoverCr),fmt(x.pressureContribution)]);
 $('#ti-live-positive',root).innerHTML=table(['Symbol','Change','Turnover ₹ Cr','Pressure'],map(d.topPositive||[]),'No positive movers available.');
 $('#ti-live-negative',root).innerHTML=table(['Symbol','Change','Turnover ₹ Cr','Pressure'],map(d.topNegative||[]),'No negative movers available.');
 $('#ti-live-note',root).textContent='Method: '+d.method+'. '+d.disclaimer+' Auto-refresh: every 30 seconds during the session.';
}
async function loadLivePressure(force=false){
 try{
  const url='https://strike-pulse-relay.onrender.com/api/live-market-pressure'+(force?'?refresh=1&t=':'?t=')+Date.now();
  const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
  const payload=await res.json();
  if(!res.ok||payload?.success!==true)throw Error(payload?.error||('HTTP '+res.status));
  renderLivePressure(payload.data);
 }catch(e){$('#ti-live-meta',root).textContent='Live estimate unavailable · '+(e.message||'source error');}
}

function init(){
 root=document.getElementById(ROOT_ID);
 if(!root){console.warn('[Strike Pulse] Trading Intelligence root not found; page script did not mount.');return;}
 root.innerHTML=markup();
 $('#ti-refresh',root).addEventListener('click',()=>{load(true);loadLivePressure(true);});
 $('#ti-search',root).addEventListener('input',e=>filterTables(e.target.value));
 load(false);
 loadLivePressure(false);
 if(!window.__SP_TI_LIVE_PRESSURE_TIMER__){window.__SP_TI_LIVE_PRESSURE_TIMER__=setInterval(()=>{const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));const day=now.getDay(),mins=now.getHours()*60+now.getMinutes();if(document.visibilityState!=='hidden'&&day>=1&&day<=5&&mins>=540&&mins<930)loadLivePressure(false);},30000);}
}
function filterTables(value){const term=String(value||'').trim().toUpperCase();['#ti-bulk-table','#ti-block-table','#ti-delivery-table'].forEach(sel=>{const box=$(sel,root);if(!box)return;box.querySelectorAll('tbody tr').forEach(tr=>{tr.hidden=!!term&&!tr.textContent.toUpperCase().includes(term);});});}
function setNet(id,row){const el=$(id,root),v=num(row?.netValue);el.textContent=fmt(v);el.className=v==null?'':v>0?'ti-positive':v<0?'ti-negative':'';}
function renderDeals(targetId,metaId,section){const data=section||{},rows=Array.isArray(data.rows)?data.rows:[];const mapped=rows.map(x=>[x.date,x.symbol,x.clientName,x.side,fmt(x.quantity,0),fmt(x.averagePrice),num(x.quantity)!=null&&num(x.averagePrice)!=null?fmt(num(x.quantity)*num(x.averagePrice),2):'—']);$(targetId,root).innerHTML=table(['Date','Symbol','Client','Side','Quantity','Avg Price','Deal Value'],mapped,'No disclosed records in the available report window.');$(metaId,root).textContent=data.available?String(data.totalRows??rows.length)+' disclosed records · '+String(data.date||'report date unavailable'):(data.reason||'Source unavailable');}
function render(data){
 const p=data.participants||{},rows=Array.isArray(p.rows)?p.rows:[],find=s=>rows.find(x=>String(x.category||'').toUpperCase().includes(s)),fii=find('FII')||find('FPI'),dii=find('DII');
 setNet('#ti-fii-net',fii);setNet('#ti-dii-net',dii);
 $('#ti-fii-date',root).textContent='Report date: '+String(p.date||fii?.date||'—');
 $('#ti-dii-date',root).textContent='Report date: '+String(p.date||dii?.date||'—');
 $('#ti-inst-meta',root).textContent=(p.source||'NSE India')+(p.provisional?' · Provisional':'')+(p.available?' · Available':' · Unavailable');
 $('#ti-inst-table',root).innerHTML=table(['Category','Gross Buy (₹ Cr)','Gross Sell (₹ Cr)','Net (₹ Cr)'],rows.map(x=>[x.category,fmt(x.buyValue),fmt(x.sellValue),fmt(x.netValue)]),p.reason||'FII/DII report unavailable.');
 const deals=data.largeDeals||{};renderDeals('#ti-bulk-table','#ti-bulk-meta',deals.bulk);renderDeals('#ti-block-table','#ti-block-meta',deals.block);
 const delivery=data.delivery||{},top=Array.isArray(delivery.topByDeliveryQty)?delivery.topByDeliveryQty:[];
 $('#ti-delivery-meta',root).textContent=delivery.available?'Report date: '+String(delivery.date||'—')+' · '+String(delivery.qualifiedRows??0)+' qualifying stocks':(delivery.reason||'NSE delivery report unavailable');
 $('#ti-delivery-table',root).innerHTML=table(['Symbol','Traded Qty','Deliverable Qty','Delivery %'],top.map(x=>[x.symbol,fmt(x.tradedQty,0),fmt(x.deliveryQty,0),fmt(x.deliveryPercent)]),delivery.reason||'No verified delivery rows available.');
 $('#ti-status',root).textContent='Fetched '+new Date(data.generatedAt||Date.now()).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' · Report dates shown per section';
 filterTables($('#ti-search',root).value);
}
async function load(force){
 if(busy)return;busy=true;const btn=$('#ti-refresh',root),status=$('#ti-status',root);
 btn.disabled=true;btn.textContent='Fetching…';status.textContent=force?'Refreshing published sources…':'Loading published sources…';
 try{const url=API+(force?'?refresh=1&t=':'?t=')+Date.now();const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});const data=await res.json();if(!res.ok||data?.success!==true)throw Error(data?.error||('HTTP '+res.status));render(data);lastGood=data;}
 catch(e){status.textContent=lastGood?'Refresh failed · showing previous successful data':'Data unavailable · '+(e.message||'source error');console.error('[Strike Pulse Trading Intelligence]',e);}
 finally{busy=false;btn.disabled=false;btn.textContent='↻ Refresh All';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();