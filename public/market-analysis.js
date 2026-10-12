(() => {
  'use strict';
  if (window.__SP_MARKET_ANALYSIS_V1__) return;
  window.__SP_MARKET_ANALYSIS_V1__ = true;

  const API = 'https://strike-pulse-relay.onrender.com';
  const ID_ALIASES = {'stock-universe':'sp-stock-preset','stock-timeframe':'sp-stock-timeframe','stock-direction':'sp-stock-trend','chart-symbol':'sp-chart-symbol','chart-timeframe':'sp-chart-timeframe','volume-symbol':'sp-volume-symbol','volume-period':'sp-volume-timeframe','option-underlying':'sp-options-underlying','option-type':'sp-options-type','minimum-option-volume':'sp-options-min-volume','futures-symbol':'sp-futures-symbol','volatility-symbol':'sp-volatility-symbol','correlation-stock-a':'sp-correlation-symbol-a','correlation-stock-b':'sp-correlation-symbol-b','correlation-window':'sp-correlation-period','backtest-strategy':'sp-backtest-strategy','backtest-universe':'sp-backtest-symbol','backtest-cost':'sp-backtest-cost','statistical-period':'sp-statistics-period','statistical-type':'sp-statistics-type'};
  const SECTION_ALIASES = {'chart-lab':'technical-analysis','volume-lab':'volume-analysis','option-scanner':'options','correlation-lab':'correlation'};
  const $ = id => document.getElementById(id) || document.getElementById(ID_ALIASES[id] || '__sp_missing__');
  const all = (selector, root=document) => [...root.querySelectorAll(selector)];
  const num = v => v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const fmt = (v, d=2) => num(v) == null ? '—' : Number(v).toLocaleString('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d});
  const pct = v => num(v) == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = id => $(id)?.value ?? '';
  const msg = (section, text, error=false) => {
    const el = typeof section === 'string' ? $(section) : section;
    if (!el) return;
    let node = el.querySelector(':scope > .sp-runtime-message');
    if (!node) { node=document.createElement('div'); node.className='sp-runtime-message'; node.setAttribute('role','status'); el.prepend(node); }
    node.textContent=text;
    node.style.cssText='padding:10px 12px;margin:10px 0;border-radius:8px;font-size:13px;background:'+(error?'#fff1f2':'#eff6ff')+';color:'+(error?'#9f1239':'#1e40af')+';border:1px solid '+(error?'#fecdd3':'#bfdbfe');
  };
  async function api(path, params={}) {
    const u = new URL(API + path);
    Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k,String(v)); });
    console.info('[Strike Pulse] API REQUEST →', u.toString());
    let r;
    try {
      r = await fetch(u.toString(), {headers:{Accept:'application/json'}, signal:AbortSignal.timeout(35000)});
    } catch (e) {
      console.error('[Strike Pulse] API NETWORK ERROR ✗', u.toString(), e);
      throw e;
    }
    let data;
    try { data=await r.json(); } catch {
      console.error('[Strike Pulse] API INVALID RESPONSE ✗', r.status, u.toString());
      throw Error('API returned a non-JSON response (HTTP '+r.status+').');
    }
    if (!r.ok || data?.success === false) {
      console.error('[Strike Pulse] API ERROR ✗', r.status, u.toString(), data);
      throw Error(data?.error || ('API request failed (HTTP '+r.status+').'));
    }
    console.info('[Strike Pulse] API SUCCESS ✓', r.status, u.toString(), data);
    return data;
  }
  function section(id){ return $(SECTION_ALIASES[id] || id); }
  function setStatus(text, good=true) {
    const badge=document.querySelector('.sp-data-badge');
    if (badge) { badge.lastChild.textContent=' '+text; badge.style.color=good?'#166534':'#9f1239'; }
  }
  function setTable(table, headers, rows) {
    if (!table) return;
    const thead=table.querySelector('thead');
    const tbody=table.querySelector('tbody');
    if (thead) thead.innerHTML='<tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>';
    if (tbody) tbody.innerHTML=rows.length ? rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('') : '<tr><td colspan="'+headers.length+'">No matching records returned by the data provider.</td></tr>';
    const footer=table.closest('.sp-panel')?.querySelector('.sp-table-footer');
    if (footer) footer.textContent=rows.length+' result(s) · Live provider response · '+new Date().toLocaleString('en-IN');
  }
  function addResultsTable(panel, name, headers, rows) {
    let box=panel.querySelector('[data-sp-results="'+name+'"]');
    if (!box) { box=document.createElement('div'); box.dataset.spResults=name; box.className='sp-table-scroll'; panel.appendChild(box); }
    box.innerHTML='<table class="sp-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">No results returned.</td></tr>')+'</tbody></table>';
  }
  function clearSampleRows() {
    const first=section('stock-scanner')?.querySelector('.sp-table tbody');
    if(first) first.innerHTML='<tr><td colspan="9">Run Stock Scan to load provider-backed results.</td></tr>';
    const option=section('option-scanner')?.querySelector('.sp-table tbody');
    if(option) option.innerHTML='<tr><td colspan="11">Run Option Scan to load provider-backed contracts.</td></tr>';
    all('.sp-demo-label').forEach(x=>{ if(/SAMPLE DATA|CHART PLACEHOLDER|AWAITING BACKTEST/i.test(x.textContent)) x.textContent='LIVE DATA ON REQUEST'; });
    all('.sp-chart-placeholder').forEach(x=>{ x.innerHTML='<strong>Waiting for data</strong><small>Run the related analysis to request real provider data.</small>'; });
  }
  function downloadCSV(name, rows) {
    if (!rows.length) { alert('There are no result rows to export yet. Run an analysis first.'); return; }
    const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=name; a.click(); URL.revokeObjectURL(a.href);
  }
  let lastStockRows=[], lastOptionRows=[], lastChart=null;
  function metricValues(panel, values) {
    const cards=all('.sp-metric',panel);
    cards.forEach((card,i)=>{ if(values[i]===undefined)return; const strong=card.querySelector('strong'); if(strong)strong.textContent=values[i]; });
  }
  function metricByLabel(panel,label,value) {
    const card=all('.sp-metric',panel).find(c=>new RegExp(label,'i').test(c.querySelector('span,.sp-metric-label,label')?.textContent||c.textContent||''));
    const strong=card?.querySelector('strong'); if(strong)strong.textContent=value;
  }
  function rsiSeries(candles,period=14) {
    const out=[]; let gains=0,losses=0;
    for(let i=1;i<candles.length;i++){const delta=candles[i].c-candles[i-1].c;
      if(i<=period){gains+=Math.max(delta,0);losses+=Math.max(-delta,0);if(i<period)continue;if(i===period){gains/=period;losses/=period;}}
      else {gains=(gains*(period-1)+Math.max(delta,0))/period;losses=(losses*(period-1)+Math.max(-delta,0))/period;}
      out.push({t:candles[i].t,c:losses===0?100:100-100/(1+gains/losses)});
    } return out;
  }
  function atrValue(candles,period=14) {
    if(candles.length<period+1)return null; const tr=[];
    for(let i=1;i<candles.length;i++)tr.push(Math.max(candles[i].h-candles[i].l,Math.abs(candles[i].h-candles[i-1].c),Math.abs(candles[i].l-candles[i-1].c)));
    const tail=tr.slice(-period);return tail.reduce((a,b)=>a+b,0)/tail.length;
  }
  function drawLine(host, points, key='c', label='Price') {
    if(!host)return;
    const clean=(points||[]).map(p=>({x:Number(p.t),y:num(p[key])})).filter(p=>p.y!=null);
    if(clean.length<2){host.innerHTML='<div class="sp-chart-placeholder"><strong>Chart unavailable</strong><small>Provider returned fewer than two usable observations.</small></div>';return;}
    const w=900,h=250,pad=30,ys=clean.map(p=>p.y),lo=Math.min(...ys),hi=Math.max(...ys),span=hi-lo||1;
    const coords=clean.map((p,i)=>[(pad+i*(w-2*pad)/(clean.length-1)),h-pad-((p.y-lo)/span)*(h-2*pad)]);
    const path=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    host.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(label)+' chart" style="width:100%;height:auto;min-height:180px"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="#cbd5e1"/><line x1="'+pad+'" y1="'+pad+'" x2="'+pad+'" y2="'+(h-pad)+'" stroke="#cbd5e1"/><path d="'+path+'" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><text x="'+pad+'" y="18" font-size="13" fill="#334155">'+esc(fmt(hi))+'</text><text x="'+pad+'" y="'+(h-5)+'" font-size="13" fill="#334155">'+esc(fmt(lo))+'</text></svg>';
  }
  async function loadStatus() {
    try { await api('/api/analysis/status'); setStatus('DATA API CONNECTED',true); }
    catch(e) { setStatus('DATA API UNAVAILABLE',false); msg(section('stock-scanner'),'Backend status check failed: '+e.message,true); }
  }
  function stockParams() {
    const universe=val('stock-universe');
    const symbol=universe==='All Available Stocks'?'':universe==='F&O Stocks'?'F&O':universe.replace('NIFTY ','NIFTY ');
    const universeMap={'NIFTY 50':'NIFTY 50','NIFTY 100':'NIFTY 100','NIFTY 200':'NIFTY 200','NIFTY 500':'NIFTY 500','F&O Stocks':'ALL F&O STOCKS','All Available Stocks':'ALL NSE EQUITY STOCKS'};
    const tf=val('stock-timeframe');
    const intervals={'5 Minutes':'5m','15 Minutes':'15m','30 Minutes':'30m','1 Hour':'60m','Daily':'1d','Weekly':'1wk','5m':'5m','15m':'15m','30m':'30m','60m':'60m','1d':'1d','1wk':'1wk'};
    const pattern=val('scan-pattern');
    return {symbol:'',universe:universeMap[universe]||'',timeframe:tf,interval:intervals[tf]||'15m',pattern,direction:val('stock-direction'),minPrice:val('minimum-price'),rvol:val('relative-volume').replace('x','').replace('Any Volume',''),rsiMin:val('rsi-minimum'),rsiMax:val('rsi-maximum'),trend:val('stock-direction')==='Bullish Conditions'?'bullish':val('stock-direction')==='Bearish Conditions'?'bearish':'',structure:pattern==='Price Breakout'?'breakout':pattern==='Price Breakdown'?'breakdown':'',volumeCondition:pattern==='Volume Breakout'?'high volume':'',aboveVwap:checkedText('Above VWAP'),aboveEma50:checkedText('Above 50 EMA'),aboveEma200:checkedText('Above 200 EMA'),unusualVolume:checkedText('Unusual Volume'),atrExpansion:checkedText('ATR Expansion'),trendlineBreak:checkedText('Trendline Break')};
  }
  function checkedText(label) {
    const el=all('.sp-check').find(x=>x.innerText.trim().includes(label));
    return !!el?.querySelector('input')?.checked;
  }
  async function runStockScan() {
    const sec=section('stock-scanner'); msg(sec,'Requesting real historical data; larger universes may take time.');
    try {
      const p=stockParams();
      const data=await api('/api/analysis/stock-scanner',p);
      lastStockRows=(data.results||[]).filter(r=>{
        if(p.minPrice && num(r.price??r.ltp)<Number(p.minPrice))return false;
        if(p.rsiMin && num(r.rsi)<Number(p.rsiMin))return false;
        if(p.rsiMax && num(r.rsi)>Number(p.rsiMax))return false;
        if(p.rvol && p.rvol!=='Any Volume' && num(r.rvol)<Number(p.rvol))return false;
        return true;
      });
      const table=sec.querySelector('.sp-table');
      setTable(table,['Symbol','LTP','Change','RSI','RVOL','VWAP Distance','Pattern','Timeframe','Chart'],lastStockRows.map(r=>[
        '<strong>'+esc(r.symbol)+'</strong>',esc(fmt(r.price??r.ltp)),esc(pct(r.change)),esc(fmt(r.rsi,1)),esc(num(r.rvol)==null?'—':fmt(r.rvol,1)+'x'),esc(pct(r.vwapDistancePct)),esc(r.pattern||p.pattern||'Historical scan'),esc(p.timeframe),'<a class="sp-text-link" href="#chart-lab" data-chart-symbol="'+esc(r.symbol)+'">View</a>'
      ]));
      msg(sec,'Received '+lastStockRows.length+' provider-backed result(s). Source: '+(data.source||'market relay')+'.');
    } catch(e) { msg(sec,'Stock scan failed: '+e.message,true); }
  }
  async function runOptionScan() {
    const sec=section('option-scanner'); msg(sec,'Loading option-chain data from the market relay.');
    try {
      const underlying=val('option-underlying');
      const symbol=underlying==='Selected F&O Stock'||underlying==='All Available F&O'?'NIFTY':underlying;
      const moneyness=val('moneyness').toLowerCase().includes('itm')?'itm':val('moneyness').toLowerCase().includes('otm')?'otm':val('moneyness').toLowerCase().includes('atm')?'atm':'all';
      const selectedType=val('option-type');
      const data=await api('/api/analysis/option-scanner',{symbol,type:selectedType==='Call Options Only'||selectedType==='CE'?'CE':selectedType==='Put Options Only'||selectedType==='PE'?'PE':'both',moneyness,minOi:val('oi-change'),minVolume:val('minimum-option-volume'),minIv:val('minimum-iv'),maxSpread:val('maximum-spread')});
      lastOptionRows=data.results||[];
      const strikes=lastOptionRows.map(r=>num(r.strike)).filter(v=>v!=null);
      const spot=num(data.underlyingPrice??data.spot??data.underlying?.price);
      const atm=strikes.length?(spot==null?null:strikes.reduce((best,v)=>Math.abs(v-spot)<Math.abs(best-spot)?v:best,strikes[0])):null;
      const ceOi=lastOptionRows.filter(r=>String(r.type).toUpperCase()==='CE').reduce((sum,r)=>sum+(num(r.oi)||0),0);
      const peOi=lastOptionRows.filter(r=>String(r.type).toUpperCase()==='PE').reduce((sum,r)=>sum+(num(r.oi)||0),0);
      const ivs=lastOptionRows.map(r=>num(r.iv)).filter(v=>v!=null&&v>=0&&v<=300);
      metricByLabel(sec,'ATM Strike',atm==null?'—':fmt(atm,0));
      metricByLabel(sec,'Put/Call Ratio',ceOi>0?fmt(peOi/ceOi,2):'—');
      metricByLabel(sec,'Implied Volatility',ivs.length?fmt(ivs.reduce((a,b)=>a+b,0)/ivs.length,1)+'%':'—');
      const table=sec.querySelector('.sp-table');
      setTable(table,['Underlying','Strike','Type','Expiry','LTP','OI','OI Change','Volume','IV','Pattern','Research'],lastOptionRows.map(r=>[
        esc(r.symbol),esc(fmt(r.strike,0)),esc(r.type),esc(r.expiry),esc(fmt(r.ltp)),esc(fmt(r.oi,0)),esc(pct(r.oiPct)),esc(fmt(r.volume,0)),esc(r.iv==null?'—':fmt(r.iv,1)+'%'),esc(r.oiPct>=15?'OI Spike':r.volume>=100000?'High Volume':'Observed'),'<a class="sp-text-link" href="#contract-research" data-contract="'+esc(JSON.stringify({symbol:r.symbol,strike:r.strike,type:r.type,expiry:r.expiry}))+'">Analyze</a>'
      ]));
      msg(sec,'Received '+lastOptionRows.length+' contract(s) for '+symbol+'. Source: '+(data.source||'market relay')+'.');
    } catch(e) { msg(sec,'Option scan failed: '+e.message,true); }
  }
  async function runChart() {
    const sec=section('chart-lab'); const rawSymbol=(val('chart-symbol')||'RELIANCE').trim().toUpperCase().replace(/\.NS$/,''); const symbol=rawSymbol==='RELIENCE'?'RELIANCE':rawSymbol;
    msg(sec,'Loading '+symbol+' historical candles.');
    try {
      const rawTf=val('chart-timeframe')||'15m';
      const tfMap={'1 minute':'1m','5 minutes':'5m','15 minutes':'15m','30 minutes':'30m','1 hour':'1h','daily':'1D','weekly':'1W','5m':'5m','15m':'15m','30m':'30m','60m':'1h','1d':'1D','1wk':'1W'};
      const tf=tfMap[rawTf.toLowerCase()]||rawTf;
      const data=await api('/api/analysis/chart',{symbol,timeframe:tf});
      lastChart=data; const candles=data.candles||[];
      const heading=sec.querySelector('.sp-main-chart .sp-chart-heading h4');
      if(heading)heading.textContent=symbol+' · Price Action';
      const main=sec.querySelector('.sp-main-chart .sp-chart-placeholder');
      if(main)drawLine(main,candles,'c',symbol+' historical close price');
      const chartBoxes=all('.sp-chart-box',sec);
      const rsiBox=chartBoxes.find(x=>/Relative Strength Index/i.test(x.innerText));
      if(rsiBox)drawLine(rsiBox.querySelector('.sp-chart-placeholder'),rsiSeries(candles),'c','RSI');
      const macdBox=chartBoxes.find(x=>/^MACD/m.test(x.innerText));
      if(macdBox)drawLine(macdBox.querySelector('.sp-chart-placeholder'),candles.map(c=>({t:c.t,c:c.c})).slice(-60),'c','MACD price proxy');
      const metrics=data.metrics||{};
      metricByLabel(sec,'Trend',candles.length>1?(candles.at(-1).c>=candles.at(-2).c?'Up':'Down'):'—');
      metricByLabel(sec,'RSI',metrics.rsi==null?(rsiSeries(candles).at(-1)?.c==null?'—':fmt(rsiSeries(candles).at(-1).c,1)):fmt(metrics.rsi,1));
      metricByLabel(sec,'ATR',fmt(atrValue(candles),2));
      msg(sec,'Loaded '+candles.length+' candles from '+(data.source||'provider')+'. Last close ₹'+fmt(metrics.price??candles.at(-1)?.c)+', change '+pct(metrics.change)+'.');
      setStatus('LIVE HISTORY LOADED',true);
    } catch(e) { msg(sec,'Chart request failed: '+e.message,true); }
  }
  async function runVolume() {
    const sec=section('volume-lab'); const symbol=(val('volume-symbol')||'RELIANCE').trim().toUpperCase();
    const period=val('volume-period'); const lookback=period.includes('Current')?5:period.includes('5 Trading')?5:period.includes('20 Trading')?20:60;
    msg(sec,'Loading historical volume for '+symbol+'.');
    try {
      const d=await api('/api/analysis/volume-lab',{symbol,lookback});
      metricValues(sec,[d.relativeVolume==null?'—':fmt(d.relativeVolume,2)+'x',d.points?.length?fmt(d.points.at(-1).volume,0):'—','—','—']);
      const boxes=all('.sp-chart-box',sec);
      if(boxes[1])drawLine(boxes[1].querySelector('.sp-chart-placeholder'),(d.points||[]).map(p=>({t:p.t,c:p.volume})),'c','Volume history');
      if(boxes[0]) {
        const host=boxes[0].querySelector('.sp-chart-placeholder');
        if(host)host.innerHTML='<div class="sp-runtime-message">Point of Control / Value Area require price-level volume data. Candle-volume profile is not being fabricated.</div>';
      }
      msg(sec,'Volume history loaded for '+d.symbol+'. Relative volume: '+(d.relativeVolume==null?'unavailable':fmt(d.relativeVolume,2)+'x')+'.');
    } catch(e) { msg(sec,'Volume analysis failed: '+e.message,true); }
  }
  async function runCorrelation() {
    const sec=section('correlation-lab'),rawA=(val('correlation-stock-a')||'RELIANCE').trim().toUpperCase(),rawB=(val('correlation-stock-b')||'ONGC').trim().toUpperCase(),a=rawA==='RELIENCE'?'RELIANCE':rawA,b=rawB==='RELIENCE'?'RELIANCE':rawB;
    const benchmark=val('correlation-benchmark').includes('100')?'NIFTY100':'NIFTY';
    const window=Number((val('correlation-window').match(/\d+/)||[])[0]||60);
    msg(sec,'Loading aligned daily returns for '+a+', '+b+' and '+benchmark+'.');
    try {
      const d=await api('/api/analysis/correlation',{symbols:[a,b,benchmark].join(','),window});
      const series=d.series||[];
      const returns=series.map(s=>(s.points||[]).map(p=>p.r).filter(Number.isFinite));
      const corr=(x,y)=>{const n=Math.min(x.length,y.length);if(n<3)return null;const xx=x.slice(-n),yy=y.slice(-n),mx=xx.reduce((s,v)=>s+v,0)/n,my=yy.reduce((s,v)=>s+v,0)/n;let xy=0,xxs=0,yys=0;for(let i=0;i<n;i++){xy+=(xx[i]-mx)*(yy[i]-my);xxs+=(xx[i]-mx)**2;yys+=(yy[i]-my)**2}return xxs&&yys?xy/Math.sqrt(xxs*yys):null;};
      const r=corr(returns[0]||[],returns[1]||[]);
      const cards=all('.sp-metric',sec); if(cards[0]?.querySelector('strong'))cards[0].querySelector('strong').textContent=r==null?'—':r.toFixed(3);
      if(cards[1]?.querySelector('strong'))cards[1].querySelector('strong').textContent='—';
      if(cards[2]?.querySelector('strong'))cards[2].querySelector('strong').textContent='—';
      if(cards[3]?.querySelector('strong'))cards[3].querySelector('strong').textContent=returns[0]?.length&&returns[2]?.length?fmt(Math.sqrt(returns[0].slice(-window).reduce((s,v,i)=>s+(v-(returns[2].slice(-window)[i]||0))**2,0)/Math.min(window,returns[0].length))*100,2)+'%':'—';
      const box=all('.sp-chart-box',sec)[0]?.querySelector('.sp-chart-placeholder');
      if(box)drawLine(box,(series[0]?.points||[]).map((p,i)=>({t:p.t,c:corr((returns[0]||[]).slice(0,i+1),(returns[1]||[]).slice(0,i+1))})).filter(p=>p.c!=null),'c','Rolling correlation');
      const perf=all('.sp-chart-box',sec)[1]?.querySelector('.sp-chart-placeholder');
      if(perf)drawLine(perf,(series[0]?.points||[]).map((p,i)=>({t:p.t,c:100*((returns[0]||[]).slice(0,i+1).reduce((x,y)=>x*(1+y),1)-1)})),'c','Relative performance');
      addResultsTable(sec,'correlation',['Symbol','Aligned sessions','Source'],series.map(s=>[esc(s.symbol),String(s.points?.length||0),esc(d.source||'provider')]));
      msg(sec,'Correlation calculated from '+(d.sessions||0)+' aligned sessions. Pearson coefficient ('+a+' vs '+b+'): '+(r==null?'unavailable':r.toFixed(3))+'. Beta and spread Z-score are not available from the current API and are left unreported.');
    } catch(e) { msg(sec,'Correlation analysis failed: '+e.message,true); }
  }
  async function runBacktest() {
    const sec=section('backtesting'); const strategy=val('backtest-strategy');
    const fast=strategy.includes('EMA')?10:10, slow=strategy.includes('EMA')?30:30;
    const symbol=val('backtest-universe')==='Selected Symbol'?'RELIANCE':'RELIANCE';
    msg(sec,'Running daily historical moving-average crossover backtest for '+symbol+'. The API currently supports this strategy only.');
    try {
      const d=await api('/api/analysis/backtest',{symbol,fast,slow,cost:(num(val('backtest-cost'))||0)+(num(val('backtest-slippage'))||0)});
      const cards=all('.sp-metric',sec);
      const values=[d.trades,d.winRate==null?'—':fmt(d.winRate,1)+'%',d.profitFactor==null?'—':fmt(d.profitFactor),d.expectancy==null?'—':fmt(d.expectancy,2),d.maxDrawdown==null?'—':fmt(d.maxDrawdown,2)+'%',d.sharpe==null?'—':fmt(d.sharpe,2)];
      cards.forEach((c,i)=>{if(c.querySelector('strong')&&values[i]!==undefined)c.querySelector('strong').textContent=values[i]});
      const boxes=all('.sp-chart-box',sec);
      if(boxes[0])drawLine(boxes[0].querySelector('.sp-chart-placeholder'),(d.curve||d.equityCurve||[]).map((p,i)=>({t:p.t??i,c:p.equity??p.value??p})), 'c','Backtest equity curve');
      if(boxes[1])drawLine(boxes[1].querySelector('.sp-chart-placeholder'),(d.curve||[]).map((p,i)=>({t:p.t??i,c:p.drawdown??0})),'c','Drawdown history');
      msg(sec,'Backtest response received. Strategy actually tested: SMA '+fast+'/'+slow+' crossover; '+(d.trades??d.totalTrades??'—')+' trades. Results are historical, provider-dependent and not a forecast.');
    } catch(e) { msg(sec,'Backtest failed: '+e.message,true); }
  }
  async function runStatistics() {
    const sec=section('statistics'),symbol=(val('statistical-symbol')||'TCS').trim().toUpperCase();
    const text=val('statistical-period'),sessions=/^\\d+$/.test(text)?Math.max(5,Number(text)):text.includes('3 Months')?60:text.includes('6 Months')?120:text.includes('3 Years')?240:240;
    msg(sec,'Calculating descriptive historical daily-return statistics for '+symbol+'. This endpoint does not yet calculate the selected named pattern.');
    try {
      const d=await api('/api/analysis/statistics',{symbol,sessions});
      const cards=all('.sp-metric',sec),values=[d.sessions??'—',d.positiveRatePct==null?'—':fmt(d.positiveRatePct,1)+'%',pct(d.medianDailyReturnPct),'Not provided by current API'];
      cards.forEach((c,i)=>{if(c.querySelector('strong')&&values[i]!==undefined)c.querySelector('strong').textContent=values[i]});
      const boxes=all('.sp-chart-box',sec);
      if(boxes[0])drawLine(boxes[0].querySelector('.sp-chart-placeholder'),(d.points||[]).map(p=>({t:p.t,c:p.returnPct})),'c','Daily return history');
      if(boxes[1])drawLine(boxes[1].querySelector('.sp-chart-placeholder'),(d.points||[]).map((p,i)=>({t:p.t,c:p.close})),'c','Historical closes');
      addResultsTable(sec,'statistics',['Measure','Value'],[
        ['Symbol',esc(d.symbol)],['Sessions',String(d.sessions)],['Mean daily return',esc(pct(d.meanDailyReturnPct))],['Median daily return',esc(pct(d.medianDailyReturnPct))],['Daily volatility',esc(fmt(d.dailyVolatilityPct,2)+'%')],['Best day',esc(pct(d.bestDayPct))],['Worst day',esc(pct(d.worstDayPct))],['10th percentile',esc(pct(d.p10Pct))],['90th percentile',esc(pct(d.p90Pct))],['Period return',esc(pct(d.periodReturnPct))],['Data note',esc(d.note)]
      ]);
      msg(sec,'Descriptive historical return statistics loaded for '+d.symbol+'. This is not a named-pattern occurrence study; the backend does not currently expose that calculation.');
    } catch(e) { msg(sec,'Statistics request failed: '+e.message,true); }
  }
  function runRisk() {
    const sec=section('risk');
    const account=num(val('risk-account')), riskPct=num(val('risk-percent')), entry=num(val('risk-entry')), stop=num(val('risk-stop')), target=num(val('risk-target'));
    if (![account,riskPct,entry,stop].every(v=>v!=null) || account<=0 || riskPct<=0 || entry<=0 || stop<=0 || entry===stop) {
      msg(sec,'Enter a positive account size, risk percentage, entry and stop-loss. Entry and stop-loss must be different.',true); return;
    }
    const riskAmount=account*riskPct/100, perUnit=Math.abs(entry-stop), quantity=Math.floor(riskAmount/perUnit);
    const direction=entry>stop?'Long':'Short';
    const validTarget=target!=null&&target>0&&(entry>stop?target>entry:target<entry);
    const reward=validTarget?Math.abs(target-entry):null;
    const rr=reward==null?null:reward/perUnit;
    const lines=['Risk per trade: ₹'+fmt(riskAmount),'Risk per unit: ₹'+fmt(perUnit),'Position quantity: '+quantity+' unit(s)','Position value: ₹'+fmt(quantity*entry),'Direction assumed: '+direction,(rr==null?'Risk/reward: unavailable (check target direction)':'Risk/reward: 1 : '+fmt(rr,2)),'Estimate only; excludes slippage, taxes and lot-size rules.'];
    msg(sec,lines.join(' · '),false);
    console.info('[Strike Pulse] Risk calculation', {account,riskPct,entry,stop,target,quantity,riskAmount,riskPerUnit:perUnit,riskReward:rr});
  }
  function unsupportedFeature(sectionId, name) {
    msg(section(sectionId),name+' is not connected to a verified backend endpoint yet. No market data or result has been fabricated.',true);
    console.warn('[Strike Pulse] '+name+' is not implemented by the current backend; no API request sent.');
  }
  function bind() {
    const buttons=all('button');
    const byText=(text,fn,root=document)=>all('button',root).find(b=>b.textContent.trim().toLowerCase()===text.toLowerCase());
    const bindText=(text,fn,root=document)=>{const b=byText(text,fn,root);if(b&&!b.dataset.spBound){b.dataset.spBound='1';b.addEventListener('click',e=>{e.preventDefault();Promise.resolve(fn()).catch(err=>console.error('[Strike Pulse] '+text+' failed:',err));})}};
    const bindId=(id,fn)=>{const b=$(id);if(b&&!b.dataset.spBound){b.dataset.spBound='1';b.addEventListener('click',e=>{e.preventDefault();Promise.resolve(fn()).catch(err=>console.error('[Strike Pulse] '+id+' failed:',err));});}};
    // Bind using the real IDs present in the current WordPress page.
    bindId('sp-run-stock-scanner',runStockScan);
    bindId('sp-load-chart',runChart);
    bindId('sp-run-volume-lab',runVolume);
    bindId('sp-run-options-scanner',runOptionScan);
    bindId('sp-run-correlation',runCorrelation);
    bindId('sp-run-backtest',runBacktest);
    bindId('sp-run-statistics',runStatistics);
    bindId('sp-run-futures-scanner',()=>unsupportedFeature('futures','Futures Scanner'));
    bindId('sp-run-volatility',()=>unsupportedFeature('volatility','Volatility Lab'));
    bindId('sp-calculate-risk',runRisk);
    bindId('sp-refresh-health',loadStatus);
    // Keep text-based compatibility for older page markup.
    bindText('Run Stock Scan',runStockScan,section('stock-scanner'));
    bindText('Run Option Scan',runOptionScan,section('option-scanner'));
    bindText('Load Chart',runChart,section('chart-lab'));
    bindText('Run Volume',runVolume,section('volume-lab'));
    bindText('Run Correlation',runCorrelation,section('correlation-lab'));
    bindText('Run Historical Test',runBacktest,section('backtesting'));
    bindText('Run Backtest',runBacktest,section('backtesting'));
    bindText('Calculate Statistics',runStatistics,section('statistics'));
    bindText('Calculate Risk',runRisk,section('risk'));
    bindText('Analyze Historical Pattern',runStatistics,section('statistics'));
    const exportResearch=byText('Export Research');
    if(exportResearch)exportResearch.addEventListener('click',()=>downloadCSV('strike-pulse-research.csv',[
      ['Section','Symbol','Value'],
      ...lastStockRows.map(r=>['Stock Scanner',r.symbol,JSON.stringify(r)]),
      ...lastOptionRows.map(r=>['Option Scanner',r.symbol,JSON.stringify(r)])
    ]));
    const exportButtons=all('button').filter(b=>b.textContent.trim()==='Export CSV');
    exportButtons.forEach(b=>b.addEventListener('click',()=>downloadCSV('strike-pulse-stock-scan.csv',[['Symbol','Price','Change','RSI','RVOL','Pattern'],...lastStockRows.map(r=>[r.symbol,r.price??r.ltp,r.change,r.rsi,r.rvol,r.pattern])])));
    all('button').filter(b=>b.textContent.trim()==='Save Screen').forEach(b=>b.addEventListener('click',()=>{const state=JSON.stringify(stockParams(),null,2);downloadCSV('strike-pulse-screen-settings.csv',[['Setting','Value'],...Object.entries(JSON.parse(state))]);}));
    all('button').filter(b=>b.type==='reset').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>msg(b.closest('.sp-section')||b.closest('.sp-panel'),'Filters reset. Run the analysis again to refresh provider data.'),0)));
    document.addEventListener('click',e=>{
      const link=e.target.closest('[data-chart-symbol]');
      if(link){const input=$('chart-symbol');if(input)input.value=link.dataset.chartSymbol;setTimeout(runChart,50);}
      const contract=e.target.closest('[data-contract]');
      if(contract){try{const c=JSON.parse(contract.dataset.contract);const panel=$('contract-research');if(panel){const title=panel.querySelector('.sp-contract-heading h3');if(title)title.textContent=c.symbol+' '+fmt(c.strike,0)+' '+c.type;msg(panel,'Selected live chain contract: '+c.symbol+' '+c.strike+' '+c.type+' · '+c.expiry+'. Detailed historical contract candles are not available from the current API.');}}catch(_){}}
    });
    ['chart-symbol','volume-symbol','correlation-stock-a','correlation-stock-b','statistical-symbol'].forEach(id=>{
      const el=$(id); if(!el)return;
      el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(id==='chart-symbol')runChart();else if(id==='volume-symbol')runVolume();else if(id.startsWith('correlation'))runCorrelation();else runStatistics();}});
    });
    const nav=all('.sp-nav-link');
    const updateNav=()=>{const id=location.hash;nav.forEach(a=>a.classList.toggle('sp-nav-active',a.getAttribute('href')===id));};
    window.addEventListener('hashchange',updateNav);updateNav();
  }
  function bindStockSuggestions() {
    const ids=['chart-symbol','volume-symbol','correlation-stock-a','correlation-stock-b','statistical-symbol','futures-symbol','volatility-symbol'];
    ids.forEach(id=>{
      const input=$(id); if(!input||input.dataset.spSuggestBound)return;
      input.dataset.spSuggestBound='1';
      const listId='sp-suggestions-'+id;
      let list=$(listId);
      if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);}
      input.setAttribute('list',listId);
      input.setAttribute('autocomplete','off');
      let timer=null,last='';
      input.addEventListener('input',()=>{
        const q=input.value.trim(); clearTimeout(timer);
        if(q.length<1){list.replaceChildren();return;}
        timer=setTimeout(async()=>{
          if(q===last)return; last=q;
          try{
            const d=await api('/api/analysis/universe',{q,limit:12});
            if(document.activeElement!==input&&input.value.trim()!==q)return;
            list.replaceChildren(...(d.results||[]).map(item=>{
              const opt=document.createElement('option');opt.value=item.symbol;opt.label=item.name&&item.name!==item.symbol?item.symbol+' — '+item.name:item.symbol;return opt;
            }));
          }catch(e){console.warn('[Strike Pulse] Stock suggestions unavailable:',e.message);}
        },180);
      });
    });
  }
  function init() {
    if (!document.querySelector('.sp-analysis')) return;
    clearSampleRows();
    bind();
    bindStockSuggestions();
    loadStatus();
    const heading=document.querySelector('.sp-header .sp-data-badge');
    if(heading)heading.title='Backend API connectivity status';
    console.info('[Strike Pulse] single-file market-analysis.js loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();