'use strict';

// Isolated Market Intelligence layer.
// It only adds /api/market-intelligence and does not alter option-chain routes.
const express = require('express');

const ORIGINAL_GET = express.application.get;
const ORIGINAL_USE = express.application.use;
const NSE = 'https://www.nseindia.com';
const YAHOO = 'https://query1.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Chrome/134 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': '*/*',
  'Referer': 'https://www.nseindia.com/market-data/live-market-indices'
};

let cookies = '';
let cookieAt = 0;
let last = null;
let lastAt = 0;
let historyCache = null, historyAt = 0;

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCookies(r) {
  if (typeof r.headers.getSetCookie === 'function') {
    return r.headers.getSetCookie().map(x => x.split(';')[0]).filter(Boolean).join('; ');
  }
  const x = r.headers.get('set-cookie') || '';
  return x ? x.split(/,(?=[^;,=]+=[^;,=]+)/).map(v => v.split(';')[0].trim()).filter(Boolean).join('; ') : '';
}

function mergeCookies(a, b) {
  const m = new Map();
  for (const part of String(a || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) m.set(part.slice(0, i).trim(), part.trim());
  }
  for (const part of String(b || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) m.set(part.slice(0, i).trim(), part.trim());
  }
  return [...m.values()].join('; ');
}

async function warm() {
  if (cookies && Date.now() - cookieAt < 240000) return cookies;
  const r = await fetch(NSE + '/', { headers: HEADERS, redirect: 'follow' });
  cookies = mergeCookies(cookies, getCookies(r));
  cookieAt = Date.now();
  return cookies;
}

async function nse(path, referer = HEADERS.Referer) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        cookies = '';
        cookieAt = 0;
      }
      const c = await warm();
      const r = await fetch(NSE + path, {
        headers: { ...HEADERS, Referer: referer, ...(c ? { Cookie: c } : {}), 'X-Requested-With': 'XMLHttpRequest' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000)
      });
      if ([401, 403, 429, 500, 502, 503, 504].includes(r.status)) {
        throw Error('NSE HTTP ' + r.status);
      }
      const text = await r.text();
      if (!r.ok) throw Error('NSE HTTP ' + r.status);
      try {
        return JSON.parse(text);
      } catch (_) {
        throw Error('NSE returned non-JSON response');
      }
    } catch (e) {
      lastError = e;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError || Error('NSE request failed');
}

async function yahoo(symbol) {
  const r = await fetch(YAHOO + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=5m', { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  if (!r.ok) throw Error('Yahoo HTTP ' + r.status);
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = num(meta.regularMarketPrice);
  const previous = num(meta.previousClose);
  return { price, change: price != null && previous ? ((price - previous) / previous) * 100 : null };
}

async function intradayHistory() {
  if (historyCache && Date.now() - historyAt < 60000) return historyCache;
  const symbols = { nifty:'^NSEI', banknifty:'^NSEBANK', finnifty:'^CNXFIN', sensex:'^BSESN' };
  const series = {};
  await Promise.all(Object.entries(symbols).map(async ([key,symbol]) => {
    try {
      const r = await fetch(YAHOO+'/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=1d&interval=5m', {headers:{'User-Agent':HEADERS['User-Agent']},signal:AbortSignal.timeout(9000)});
      if (!r.ok) throw Error('Yahoo HTTP '+r.status);
      const j=await r.json(), q=j?.chart?.result?.[0];
      const baseline=num(q?.meta?.chartPreviousClose ?? q?.meta?.previousClose);
      const times=q?.timestamp||[], quote=q?.indicators?.quote?.[0]||{}, closes=quote.close||[];
      if (!baseline) throw Error('Previous close unavailable');
      const points=times.map((t,i)=>{
        const p=num(closes[i]); if(p==null)return null;
        const dt=new Date(t*1000);
        const time=dt.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false});
        if(time<'09:15'||time>'15:30')return null;
        return {timestamp:t*1000,change:Number(((p-baseline)/baseline*100).toFixed(4)),open:num(quote.open?.[i]),high:num(quote.high?.[i]),low:num(quote.low?.[i]),close:p,volume:num(quote.volume?.[i])};
      }).filter(Boolean);
      if(points.length)series[key]=points;
    } catch(e) {console.warn('[INTRADAY]',key,e.message);}
  }));
  historyCache={source:'yahoo-5m',series};
  historyAt=Date.now();
  return historyCache;
}
function marketStatus() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = day >= 1 && day <= 5 && mins >= 555 && mins < 930;
  const pre = day >= 1 && day <= 5 && mins >= 540 && mins < 555;
  return { open, preOpen: pre, session: open ? 'LIVE' : pre ? 'PRE-OPEN' : 'CLOSED', ist: now.toISOString() };
}


let livePressureCache = null, livePressureAt = 0;
function marketNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}
async function getLivePressure(force = false) {
  if (!force && livePressureCache && Date.now() - livePressureAt < 15000) {
    return { ...livePressureCache, cached: true };
  }
  const market = marketStatus();
  try {
    const raw = await nse('/api/equity-stock-indices?index=NIFTY%2050', 'https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%2050');
    const sourceRows = Array.isArray(raw?.data) ? raw.data : [];
    const stocks = sourceRows.map(row => {
      const symbol = String(row?.symbol || row?.meta?.symbol || '').trim().toUpperCase();
      const change = marketNumber(row?.pChange ?? row?.percentChange ?? row?.change);
      const price = marketNumber(row?.lastPrice ?? row?.last ?? row?.ltp);
      const volume = marketNumber(row?.totalTradedVolume ?? row?.totalTradedQty ?? row?.volume);
      let turnover = marketNumber(row?.totalTradedValue ?? row?.turnover ?? row?.valueTraded);
      if (turnover == null && price != null && volume != null) turnover = price * volume;
      return { symbol, change, price, volume, turnover };
    }).filter(row => row.symbol && row.symbol !== 'NIFTY 50' && row.change != null && row.turnover != null && row.turnover > 0);
    if (stocks.length < 40) throw Error('NSE returned only ' + stocks.length + ' usable NIFTY 50 constituent rows');
    const totalTurnover = stocks.reduce((sum, row) => sum + row.turnover, 0);
    const up = stocks.filter(row => row.change > 0.05);
    const down = stocks.filter(row => row.change < -0.05);
    const flat = stocks.filter(row => Math.abs(row.change) <= 0.05);
    const upTurnover = up.reduce((sum, row) => sum + row.turnover, 0);
    const downTurnover = down.reduce((sum, row) => sum + row.turnover, 0);
    const flatTurnover = flat.reduce((sum, row) => sum + row.turnover, 0);
    const weightedPressure = stocks.reduce((sum, row) => {
      const cappedChange = Math.max(-2, Math.min(2, row.change));
      return sum + row.turnover * cappedChange / 2;
    }, 0) / totalTurnover * 100;
    const pressure = Number(Math.max(-100, Math.min(100, weightedPressure)).toFixed(2));
    const top = rows => rows.sort((x, y) => (y.turnover * Math.abs(y.change)) - (x.turnover * Math.abs(x.change))).slice(0, 5)
      .map(row => ({ symbol: row.symbol, change: Number(row.change.toFixed(2)), price: row.price,
        volume: row.volume, turnoverCr: Number((row.turnover / 10000000).toFixed(2)),
        pressureContribution: Number((row.turnover * row.change / totalTurnover).toFixed(3)) }));
    const result = {
      available: true,
      source: 'NSE India · NIFTY 50 constituent market snapshot',
      session: market.session,
      marketOpen: market.open,
      reportDate: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
      updatedAt: new Date().toISOString(),
      symbols: stocks.length,
      pressure,
      bias: pressure >= 8 ? 'POSITIVE' : pressure <= -8 ? 'NEGATIVE' : 'BALANCED',
      totalTurnoverCr: Number((totalTurnover / 10000000).toFixed(2)),
      upTurnoverCr: Number((upTurnover / 10000000).toFixed(2)),
      downTurnoverCr: Number((downTurnover / 10000000).toFixed(2)),
      flatTurnoverCr: Number((flatTurnover / 10000000).toFixed(2)),
      advances: up.length, declines: down.length, unchanged: flat.length,
      topPositive: top(stocks.filter(row => row.change > 0)),
      topNegative: top(stocks.filter(row => row.change < 0)),
      method: 'Turnover-weighted price momentum proxy',
      disclaimer: 'Estimated market-pressure indicator only. It does not identify FII/DII trades or prove institutional participation.',
      cached: false
    };
    livePressureCache = result;
    livePressureAt = Date.now();
    return result;
  } catch (error) {
    return { available: false, source: 'NSE India · NIFTY 50 constituent market snapshot',
      session: market.session, reason: error.message || 'Live market snapshot unavailable',
      updatedAt: new Date().toISOString(), cached: false };
  }
}

function classify(change) {
  if (change == null) return 'UNKNOWN';
  if (change >= 0.50) return 'STRONG_BULLISH';
  if (change >= 0.10) return 'BULLISH';
  if (change <= -0.50) return 'STRONG_BEARISH';
  if (change <= -0.10) return 'BEARISH';
  return 'NEUTRAL';
}

function buildRegime(m) {
  const changes = [m.nifty?.change, m.banknifty?.change, m.finnifty?.change, m.sensex?.change].filter(v => v != null);
  if (!changes.length) return { label: 'UNKNOWN', score: 0 };
  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
  const vix = m.vix?.change;
  let score = Math.max(-100, Math.min(100, avg * 45));
  if (vix != null && vix > 3) score -= 8;
  if (vix != null && vix < -3) score += 5;
  const label = score >= 35 ? 'BULLISH' : score <= -35 ? 'BEARISH' : 'MIXED';
  return { label, score: Number(score.toFixed(1)), averageChange: Number(avg.toFixed(3)) };
}

let deliveryCache = null, deliveryAt = 0;
function parseCsvLine(line) {
  const out=[]; let value='', quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"' && quoted && line[i+1]==='"'){value+='"';i++;}
    else if(ch==='"') quoted=!quoted;
    else if(ch===',' && !quoted){out.push(value.trim());value='';}
    else value+=ch;
  }
  out.push(value.trim()); return out;
}
async function getDelivery(force = false) {
  if(!force && deliveryCache && Date.now()-deliveryAt<900000) return deliveryCache;
  let lastError='NSE delivery report unavailable';
  for(let back=0;back<5;back++){
    const day=new Date(); day.setDate(day.getDate()-back);
    const dd=String(day.getDate()).padStart(2,'0'), mm=String(day.getMonth()+1).padStart(2,'0'), yyyy=day.getFullYear();
    const dateKey=dd+mm+yyyy;
    const url='https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_'+dateKey+'.csv';
    try{
      const response=await fetch(url,{headers:{'User-Agent':HEADERS['User-Agent'],Accept:'text/csv,text/plain,*/*'},redirect:'follow'});
      if(!response.ok){lastError='NSE report HTTP '+response.status+' for '+dateKey;continue;}
      const raw=await response.text();
      if(!raw || raw.length<100 || /^</.test(raw.trim())){lastError='NSE returned an empty or non-CSV report';continue;}
      const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
      const headers=parseCsvLine(lines.shift()).map(x=>x.toUpperCase().replace(/[^A-Z0-9]/g,''));
      const col=name=>headers.indexOf(name);
      const ix={symbol:col('SYMBOL'),series:col('SERIES'),date:col('DATE1'),qty:col('TTLTRDQNTY'),delivery:col('DELIVQTY'),percent:col('DELIVPER')};
      if(Object.values(ix).some(v=>v<0)) {lastError='NSE CSV schema did not contain expected delivery columns';continue;}
      const rows=lines.map(line=>parseCsvLine(line)).filter(c=>c.length>=headers.length && c[ix.series]==='EQ').map(c=>({
        symbol:c[ix.symbol],date:c[ix.date],tradedQty:Number(String(c[ix.qty]).replace(/,/g,'')),
        deliveryQty:Number(String(c[ix.delivery]).replace(/,/g,'')),
        deliveryPercent:Number(String(c[ix.percent]).replace(/,/g,''))
      })).filter(x=>x.symbol && Number.isFinite(x.deliveryQty) && Number.isFinite(x.deliveryPercent));
      if(!rows.length){lastError='NSE CSV contained no valid EQ delivery rows';continue;}
      const reportDate=rows[0].date || dateKey;
      // Exclude thinly traded securities from both rankings to avoid misleading
      // 100% delivery readings on tiny traded quantities.
      const minTradedQty = 100000;
      const qualifiedRows = rows.filter(x => x.tradedQty >= minTradedQty && x.deliveryQty >= 0 && x.deliveryPercent >= 0);
      deliveryCache={available:true,source:'NSE India · Full Bhavcopy and Security Deliverable data',date:reportDate,
        rows:rows.length,qualifiedRows:qualifiedRows.length,minTradedQty,
        topByDeliveryQty:[...qualifiedRows].sort((a,b)=>b.deliveryQty-a.deliveryQty).slice(0,10),
        topByDeliveryPercent:[...qualifiedRows].sort((a,b)=>b.deliveryPercent-a.deliveryPercent).slice(0,10)};
      deliveryAt=Date.now(); return deliveryCache;
    }catch(e){lastError=e.message||lastError;}
  }
  deliveryCache={available:false,source:'NSE India · Full Bhavcopy and Security Deliverable data',reason:lastError};
  deliveryAt=Date.now(); return deliveryCache;
}

let participantCache = null, participantAt = 0;
let largeDealsCache = null, largeDealsAt = 0;
function dealDate(d) {
  const p = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(d);
  const v = Object.fromEntries(p.map(x=>[x.type,x.value]));
  return v.day+'-'+v.month+'-'+v.year;
}
async function getDealType(optionType, from, to) {
  const raw = await nse('/api/historicalOR/bulk-block-short-deals?optionType='+encodeURIComponent(optionType)+'&from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to));
  const sourceRows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.data) ? raw.data.data : null;
  if (!sourceRows) throw Error('NSE '+optionType+' response did not contain a recognized data array');
  const rows = sourceRows.map(x=>({
    date:String(x.BD_DT_DATE||x.tradeDate||x.date||''),
    symbol:String(x.BD_SYMBOL||x.symbol||'').trim().toUpperCase(),
    securityName:String(x.BD_SCRIP_NAME||x.securityName||''),
    clientName:String(x.BD_CLIENT_NAME||x.clientName||''),
    side:String(x.BD_BUY_SELL||x.buySell||x.side||'').trim().toUpperCase(),
    quantity:num(x.BD_QTY_TRD??x.quantityTraded??x.quantity),
    averagePrice:num(x.BD_TP_WATP??x.tradePrice??x.weightedAveragePrice),
    remarks:String(x.BD_REMARKS||x.remarks||'')
  })).filter(x=>x.symbol && x.clientName && ['BUY','SELL'].includes(x.side) && x.quantity!=null && x.averagePrice!=null);
  return {available:true,rows:rows.slice(0,100),totalRows:rows.length};
}
async function getShortSelling(from, to) {
  const raw = await nse('/api/historicalOR/bulk-block-short-deals?optionType=short_selling&from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to));
  const sourceRows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.data) ? raw.data.data : null;
  if (!sourceRows) throw Error('NSE short-selling response did not contain a recognized data array');
  const rows = sourceRows.map(x=>({
    date:String(x.SS_DATE||x.date||''),
    symbol:String(x.SS_SYMBOL||x.symbol||'').trim().toUpperCase(),
    securityName:String(x.SS_NAME||x.securityName||x.name||''),
    quantity:num(x.SS_QTY??x.quantity??x.shortSellQuantity)
  })).filter(x=>x.symbol && x.quantity!=null);
  return {available:true,rows:rows.slice(0,100),totalRows:rows.length};
}
async function getLargeDeals(force = false) {
  if (!force && largeDealsCache && Date.now()-largeDealsAt<300000) return largeDealsCache;
  const toDate=new Date(), fromDate=new Date(toDate.getTime()-6*86400000);
  const from=dealDate(fromDate), to=dealDate(toDate);
  const [bulk,block,shortSelling]=await Promise.allSettled([
    getDealType('bulk_deals',from,to),
    getDealType('block_deals',from,to),
    getShortSelling(from,to)
  ]);
  const result={
    available:bulk.status==='fulfilled'||block.status==='fulfilled'||shortSelling.status==='fulfilled',
    source:'NSE India · Historical Bulk / Block / Short Selling Disclosures',
    from,to,
    bulk:bulk.status==='fulfilled'?bulk.value:{available:false,rows:[],reason:bulk.reason?.message||'NSE bulk deals unavailable'},
    block:block.status==='fulfilled'?block.value:{available:false,rows:[],reason:block.reason?.message||'NSE block deals unavailable'},
    shortSelling:shortSelling.status==='fulfilled'?shortSelling.value:{available:false,rows:[],reason:shortSelling.reason?.message||'NSE short-selling report unavailable'}
  };
  if(!result.available) result.reason='Bulk: '+result.bulk.reason+' · Block: '+result.block.reason+' · Short selling: '+result.shortSelling.reason;
  // Cache only successful source responses. A transient NSE failure must not
  // poison the normal page load for the full five-minute cache window.
  if (result.available) {
    largeDealsCache=result;
    largeDealsAt=Date.now();
  }
  return result;
}

async function getParticipants(force = false) {
  if (!force && participantCache && Date.now() - participantAt < 300000) return participantCache;
  try {
    const raw = await nse('/api/fiidiiTradeReact');
    if (!Array.isArray(raw) || !raw.length) throw Error('NSE returned no FII/DII rows');
    const rows = raw.map(row => ({
      date: String(row?.date || ''),
      category: String(row?.category || '').trim(),
      buyValue: num(row?.buyValue),
      sellValue: num(row?.sellValue),
      netValue: num(row?.netValue)
    })).filter(row => row.category && (row.buyValue != null || row.sellValue != null || row.netValue != null));
    if (!rows.length) throw Error('NSE FII/DII response had no recognized values');
    participantCache = {
      available: true,
      source: 'NSE India · fiidiiTradeReact',
      date: rows[0].date || null,
      provisional: true,
      rows
    };
  } catch (e) {
    participantCache = {
      available: false,
      source: 'NSE India · fiidiiTradeReact',
      reason: e.message || 'NSE FII/DII feed unavailable',
      rows: []
    };
  }
  // Do not cache unavailable responses: NSE blocks are often transient.
  if (participantCache.available) participantAt = Date.now();
  else participantAt = 0;
  return participantCache;
}

async function intelligence(force = false) {
  const status = marketStatus();
  if (!force && last && Date.now() - lastAt < 10000) return { ...last, cached: true };

  const data = {};
  let list = [];
  let body = null;
  try {
    body = await nse('/api/allIndices');
    list = Array.isArray(body?.data) ? body.data : [];
    const aliases = {
      nifty: ['NIFTY 50', 'NIFTY'],
      banknifty: ['NIFTY BANK', 'BANK NIFTY', 'NIFTY BANK 50'],
      finnifty: ['NIFTY FINANCIAL SERVICES', 'NIFTY FIN SERVICE', 'FINNIFTY'],
      vix: ['INDIA VIX', 'INDIA VIX INDEX'],
      sensex: ['SENSEX', 'BSE SENSEX', 'S&P BSE SENSEX', 'BSE SENSEX 30']
    };
    for (const [key, names] of Object.entries(aliases)) {
      const item = list.find(x => {
        const idx = String(x?.index || '').trim().toUpperCase();
        return names.some(n => idx === n) || (key === 'finnifty' && (idx.includes('FINANCIAL SERVICES') || idx.includes('FIN SERVICE')));
      });
      if (item) data[key] = { price: num(item.last ?? item.lastPrice ?? item.value), change: num(item.percentChange ?? item.pChange ?? item.change), direction: classify(num(item.percentChange ?? item.pChange ?? item.change)) };
    }
  } catch (e) {
    data.nseError = e.message;
  }

  // Sector/index momentum from the same NSE allIndices response.
  // Only publish sectors that NSE actually returned; no placeholder values.
  const sectorAliases = {
    banking: ['NIFTY BANK'],
    it: ['NIFTY IT'],
    energy: ['NIFTY ENERGY'],
    auto: ['NIFTY AUTO'],
    finance: ['NIFTY FINANCIAL SERVICES'],
    fmcg: ['NIFTY FMCG'],
    metal: ['NIFTY METAL'],
    pharma: ['NIFTY PHARMA'],
    realty: ['NIFTY REALTY'],
    media: ['NIFTY MEDIA']
  };
  data.sectors = {};
  const normalizeIndexName = value => String(value || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [key, names] of Object.entries(sectorAliases)) {
    const wanted = names.map(normalizeIndexName);
    const item = list.find(x => {
      const idx = normalizeIndexName(x?.index || x?.indexName || x?.name);
      return wanted.some(name => idx === name || idx.includes(name) || name.includes(idx));
    });
    if (item) {
      const change = num(item.percentChange ?? item.pChange ?? item.change);
      const itemPrice = num(item.last ?? item.lastPrice ?? item.value ?? item.close);
      data.sectors[key] = {
        price: itemPrice,
        change,
        direction: classify(change),
        name: String(item.index || item.indexName || item.name || names[0])
      };
    }
  }

  const extraRows = [
    ...(Array.isArray(body?.sectorData) ? body.sectorData : []),
    ...(Array.isArray(body?.sectorIndices) ? body.sectorIndices : []),
    ...(Array.isArray(body?.indices) ? body.indices : [])
  ];
  for (const row of extraRows) {
    const idx = normalizeIndexName(row?.index || row?.indexName || row?.name);
    const match = Object.entries(sectorAliases).find(([, names]) =>
      names.some(name => {
        const wanted = normalizeIndexName(name);
        return idx === wanted || idx.includes(wanted) || wanted.includes(idx);
      })
    );
    if (!match) continue;
    const [key, names] = match;
    const change = num(row?.percentChange ?? row?.pChange ?? row?.change);
    const itemPrice = num(row?.last ?? row?.lastPrice ?? row?.value ?? row?.close);
    if (!data.sectors[key] || data.sectors[key].change == null) {
      data.sectors[key] = {
        price: itemPrice,
        change,
        direction: classify(change),
        name: String(row?.index || row?.indexName || row?.name || names[0])
      };
    }
  }

  // When NSE allIndices omits sector rows, use individually quoted sector
  // index symbols. Only publish real quotes with a valid price and change.
  const sectorFallbacks = {
    banking: ['^NSEBANK'],
    it: ['^CNXIT'],
    auto: ['^CNXAUTO'],
    pharma: ['^CNXPHARMA'],
    energy: ['^CNXENERGY'],
    fmcg: ['^CNXFMCG'],
    metal: ['^CNXMETAL'],
    realty: ['^CNXREALTY']
  };
  const missingSectors = Object.entries(sectorFallbacks)
    .filter(([key]) => data.sectors[key]?.change == null);
  const sectorQuotes = await Promise.allSettled(missingSectors.map(async ([key, symbols]) => {
    for (const symbol of symbols) {
      try {
        const quote = await yahoo(symbol);
        if (quote.price != null && quote.change != null) {
          return [key, { price: quote.price, change: quote.change,
            direction: classify(quote.change), name: sectorAliases[key][0],
            source: 'yahoo-fallback' }];
        }
      } catch (_) { /* An unavailable quote is not a zero-percent move. */ }
    }
    return null;
  }));
  for (const result of sectorQuotes) {
    if (result.status === 'fulfilled' && result.value) {
      const [key, quote] = result.value;
      data.sectors[key] = quote;
    }
  }

  const fallback = { nifty: '^NSEI', banknifty: '^NSEBANK', finnifty: '^CNXFIN', sensex: '^BSESN', vix: '^INDIAVIX' };
  for (const [key, symbol] of Object.entries(fallback)) {
    if (!data[key]?.price) {
      try {
        const q = await yahoo(symbol);
        data[key] = { price: q.price, change: q.change, direction: classify(q.change), source: 'yahoo-fallback' };
      } catch (e) {}
    }
  }

  let breadth = null;
  try {
    const body = await nse('/api/equity-stockIndices?index=NIFTY%2050');
    const rows = Array.isArray(body?.data) ? body.data : [];
    let advances = 0, declines = 0, unchanged = 0;
    for (const x of rows) {
      const c = num(x?.pChange ?? x?.percentChange ?? x?.change);
      if (c == null) continue;
      if (c > 0.05) advances++; else if (c < -0.05) declines++; else unchanged++;
    }
    if (advances + declines + unchanged >= 45) breadth = { advances, declines, unchanged, total: advances + declines + unchanged, source:'nse-nifty50-constituents' };
  } catch (e) {}

  // Use NSE's published index-level breadth only if the constituent feed is blocked.
  if (!breadth) {
    const niftyRow = list.find(x => String(x?.index || '').trim().toUpperCase() === 'NIFTY 50');
    const advances = num(niftyRow?.advances ?? niftyRow?.advance);
    const declines = num(niftyRow?.declines ?? niftyRow?.decline);
    const unchanged = num(niftyRow?.unchanged) ?? 0;
    if (advances != null && declines != null && advances + declines + unchanged >= 45 && advances + declines + unchanged <= 51) {
      breadth = {advances,declines,unchanged,total:advances+declines+unchanged,source:'nse-index-summary'};
    }
  }

  // Reuse the site's existing, verified option-chain relay with v3 endpoint fallback.
  let options = {available:false,source:null,symbol:'NIFTY',strikes:[],pcr:null,maxPain:null,error:null};
  try {
    if (typeof global.__SP_LOAD_CHAIN__ !== 'function') throw Error('Option-chain relay unavailable');
    const chain = await global.__SP_LOAD_CHAIN__('NIFTY',null,true);
    const strikes = (chain.rows || []).map(row=>({
      strike:num(row.strike),
      callOI:num(row.ce?.oi),
      putOI:num(row.pe?.oi)
    })).filter(row=>row.strike!=null && (row.callOI!=null || row.putOI!=null));
    if (chain.success && strikes.length >= 10) {
      options={available:true,source:chain.source||'nse-option-chain',symbol:'NIFTY',
        expiry:chain.expiry,strikes,totalCallOI:num(chain.callOI),totalPutOI:num(chain.putOI),
        pcr:num(chain.pcr),maxPain:num(chain.maxPain),error:null};
    } else options.error='Verified strike-wise OI unavailable';
  } catch(e) {options.error=e.message;}

  const sectorEntries = Object.entries(data.sectors || {})
    .filter(([, v]) => v && v.change != null)
    .sort((a, b) => b[1].change - a[1].change);

  data.drivers = {
    strongest: sectorEntries[0] ? { key: sectorEntries[0][0], ...sectorEntries[0][1] } : null,
    weakest: sectorEntries.length ? { key: sectorEntries[sectorEntries.length - 1][0], ...sectorEntries[sectorEntries.length - 1][1] } : null,
    sectors: sectorEntries.slice(0, 4).map(([key, v]) => ({ key, ...v }))
  };

  const intraday = await intradayHistory();
  const regime = buildRegime(data);
  const signals = [];
  if (regime.label === 'BULLISH') signals.push('Index momentum is broadly positive');
  if (regime.label === 'BEARISH') signals.push('Index momentum is broadly negative');
  if (regime.label === 'MIXED') signals.push('Major indices are giving mixed signals');
  if (breadth && breadth.advances > breadth.declines) signals.push('NIFTY 50 breadth is positive');
  if (breadth && breadth.declines > breadth.advances) signals.push('NIFTY 50 breadth is negative');
  if (data.vix?.change != null && data.vix.change > 3) signals.push('India VIX is rising; volatility is elevated');
  if (data.vix?.change != null && data.vix.change < -3) signals.push('India VIX is falling; volatility pressure is easing');
  if (data.drivers?.strongest?.name) signals.push(data.drivers.strongest.name + ' is showing the strongest sector momentum');
  if (data.drivers?.weakest?.name && data.drivers.weakest.key !== data.drivers?.strongest?.key) signals.push(data.drivers.weakest.name + ' is showing the weakest sector momentum');

  const participants = await getParticipants(force);
  const delivery = await getDelivery(force);
  const largeDeals = await getLargeDeals(force);
  last = { success: true, source: 'strike-pulse-market-intelligence', market: status, regime, breadth, options, intraday, indices: data, participants, delivery, largeDeals, signals, generatedAt: new Date().toISOString(), cached: false };
  lastAt = Date.now();
  return last;
}

global.__SP_MARKET_INTELLIGENCE_HANDLER__ = intelligence;

express.application.use = function(...args) {
  const middleware = async function(req, res, next) {
    if (req?.path === '/api/live-market-pressure' || req?.originalUrl?.split('?')[0] === '/api/live-market-pressure') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      try { return res.json({ success: true, data: await getLivePressure(String(req.query?.refresh || '') === '1') }); }
      catch (e) { return res.status(502).json({ success: false, error: e.message, source: 'strike-pulse-live-market-pressure' }); }
    }
    if (req?.path === '/api/market-intelligence' || req?.originalUrl?.split('?')[0] === '/api/market-intelligence') {
      // This middleware runs before the original server's CORS middleware,
      // so the isolated endpoint must provide its own CORS headers.
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      try { return res.json(await intelligence(String(req.query?.refresh || '') === '1')); }
      catch (e) { return res.status(502).json({ success: false, error: e.message, source: 'strike-pulse-market-intelligence' }); }
    }
    return next();
  };
  return ORIGINAL_USE.call(this, middleware, ...args);
};

express.application.get = function(path, ...handlers) {
  if (path === '/api/market-intelligence') {
    return ORIGINAL_GET.call(this, path, async (req, res) => {
      try { res.json(await intelligence()); }
      catch (e) { res.status(502).json({ success: false, error: e.message, source: 'strike-pulse-market-intelligence' }); }
    });
  }
  return ORIGINAL_GET.call(this, path, ...handlers);
};

console.log('[MARKET INTELLIGENCE] isolated route loaded — /api/market-intelligence');
