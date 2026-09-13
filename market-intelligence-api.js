'use strict';

// Isolated Market Intelligence layer.
// It only adds /api/market-intelligence and does not alter option-chain routes.
const express = require('express');

const ORIGINAL_GET = express.application.get;
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

function num(v) {
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

async function nse(path) {
  let c = await warm();
  let r = await fetch(NSE + path, { headers: { ...HEADERS, ...(c ? { Cookie: c } : {}), 'X-Requested-With': 'XMLHttpRequest' } });
  if ([401, 403].includes(r.status)) {
    cookies = '';
    c = await warm();
    r = await fetch(NSE + path, { headers: { ...HEADERS, ...(c ? { Cookie: c } : {}), 'X-Requested-With': 'XMLHttpRequest' } });
  }
  const text = await r.text();
  if (!r.ok) throw Error('NSE HTTP ' + r.status);
  return JSON.parse(text);
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

function marketStatus() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = day >= 1 && day <= 5 && mins >= 555 && mins < 930;
  const pre = day >= 1 && day <= 5 && mins >= 540 && mins < 555;
  return { open, preOpen: pre, session: open ? 'LIVE' : pre ? 'PRE-OPEN' : 'CLOSED', ist: now.toISOString() };
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

async function intelligence() {
  const status = marketStatus();
  if (last && Date.now() - lastAt < 10000) return { ...last, cached: true };

  const data = {};
  try {
    const body = await nse('/api/allIndices');
    const list = Array.isArray(body?.data) ? body.data : [];
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
    breadth = { advances, declines, unchanged, total: advances + declines + unchanged };
  } catch (e) {}

  const regime = buildRegime(data);
  const signals = [];
  if (regime.label === 'BULLISH') signals.push('Index momentum is broadly positive');
  if (regime.label === 'BEARISH') signals.push('Index momentum is broadly negative');
  if (regime.label === 'MIXED') signals.push('Major indices are giving mixed signals');
  if (breadth && breadth.advances > breadth.declines) signals.push('NIFTY 50 breadth is positive');
  if (breadth && breadth.declines > breadth.advances) signals.push('NIFTY 50 breadth is negative');
  if (data.vix?.change != null && data.vix.change > 3) signals.push('India VIX is rising; volatility is elevated');
  if (data.vix?.change != null && data.vix.change < -3) signals.push('India VIX is falling; volatility pressure is easing');

  last = { success: true, source: 'strike-pulse-market-intelligence', market: status, regime, breadth, indices: data, signals, generatedAt: new Date().toISOString(), cached: false };
  lastAt = Date.now();
  return last;
}

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
