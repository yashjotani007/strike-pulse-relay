/* Strike Pulse — Market Intelligence API preload
   Adds a lightweight /api/market-intelligence endpoint without changing server.js. */
'use strict';

const express = require('express');
const originalListen = express.application.listen;

const NSE = 'https://www.nseindia.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Chrome/134 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  'Accept': 'application/json,text/plain,*/*',
  'Referer': 'https://www.nseindia.com/',
  'Origin': 'https://www.nseindia.com',
  'X-Requested-With': 'XMLHttpRequest'
};

let cookies = '';
let cookieAt = 0;
let cached = null;
let cachedAt = 0;
let installed = false;

function mergeCookies(a, b) {
  const map = new Map();
  for (const part of String(a || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) map.set(part.slice(0, i).trim(), part.trim());
  }
  for (const part of String(b || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) map.set(part.slice(0, i).trim(), part.trim());
  }
  return [...map.values()].join('; ');
}

function getSetCookie(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie().map(x => x.split(';')[0]).filter(Boolean).join('; ');
  }
  const raw = response.headers.get('set-cookie') || '';
  return raw
    ? raw.split(/,(?=[^;,=]+=[^;,=]+)/).map(x => x.split(';')[0].trim()).filter(Boolean).join('; ')
    : '';
}

async function warm() {
  if (cookies && Date.now() - cookieAt < 240000) return cookies;

  const home = await fetch(NSE + '/', { headers: HEADERS, redirect: 'follow' });
  cookies = mergeCookies(cookies, getSetCookie(home));

  try {
    const option = await fetch(NSE + '/option-chain?symbol=NIFTY', {
      headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow'
    });
    cookies = mergeCookies(cookies, getSetCookie(option));
  } catch (_) {}

  cookieAt = Date.now();
  return cookies;
}

async function nse(path) {
  try {
    const c = await warm();
    const response = await fetch(NSE + path, {
      headers: { ...HEADERS, ...(c ? { Cookie: c } : {}) }
    });
    const text = await response.text();

    if ([401, 403, 404].includes(response.status)) {
      cookies = '';
      const fresh = await warm();
      const retry = await fetch(NSE + path, {
        headers: { ...HEADERS, ...(fresh ? { Cookie: fresh } : {}) }
      });
      const retryText = await retry.text();
      if (!retry.ok) throw new Error(`NSE HTTP ${retry.status}`);
      return JSON.parse(retryText);
    }

    if (!response.ok) throw new Error(`NSE HTTP ${response.status}`);
    return JSON.parse(text);
  } catch (error) {
    cookies = '';
    throw error;
  }
}

const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const sectorMap = [
  ['BANKING', ['NIFTY BANK', 'NIFTY BANK 50']],
  ['IT', ['NIFTY IT']],
  ['AUTO', ['NIFTY AUTO']],
  ['PHARMA', ['NIFTY PHARMA']],
  ['METAL', ['NIFTY METAL']],
  ['FMCG', ['NIFTY FMCG']],
  ['REALTY', ['NIFTY REALTY']],
  ['MEDIA', ['NIFTY MEDIA']],
  ['ENERGY', ['NIFTY ENERGY']],
  ['FINANCE', ['NIFTY FINANCIAL SERVICES', 'NIFTY FIN SERVICE']]
];

function findIndex(list, names) {
  return list.find(item => {
    const name = String(item?.index || '').trim().toUpperCase();
    return names.some(target => name === target) || names.some(target => name.includes(target));
  });
}

function marketScore(indices, breadth, vix) {
  const values = [];

  const add = (change, weight) => {
    if (Number.isFinite(change)) values.push({ change, weight });
  };

  add(num(findIndex(indices, ['NIFTY 50'])?.percentChange), 0.30);
  add(num(findIndex(indices, ['NIFTY BANK'])?.percentChange), 0.25);
  add(num(findIndex(indices, ['NIFTY FINANCIAL SERVICES'])?.percentChange), 0.15);

  const sectorChanges = sectorMap
    .map(([, names]) => num(findIndex(indices, names)?.percentChange))
    .filter(Number.isFinite);

  if (sectorChanges.length) {
    const average = sectorChanges.reduce((a, b) => a + b, 0) / sectorChanges.length;
    add(average, 0.15);
  }

  if (breadth && Number.isFinite(breadth.advances) && Number.isFinite(breadth.declines)) {
    const total = breadth.advances + breadth.declines + (breadth.unchanged || 0);
    if (total > 0) add(((breadth.advances - breadth.declines) / total) * 2, 0.15);
  }

  const totalWeight = values.reduce((a, x) => a + x.weight, 0) || 1;
  let composite = values.reduce((a, x) => a + x.change * x.weight, 0) / totalWeight;

  if (Number.isFinite(vix)) {
    if (vix >= 22) composite -= 0.8;
    else if (vix >= 18) composite -= 0.4;
    else if (vix < 13) composite += 0.15;
  }

  return Math.max(0, Math.min(100, Math.round(50 + composite * 18)));
}

async function buildData() {
  const [indicesBody, breadthBody] = await Promise.all([
    nse('/api/allIndices'),
    nse('/api/equity-stockIndices?index=NIFTY%20500')
  ]);

  const indices = Array.isArray(indicesBody?.data) ? indicesBody.data : [];
  const advance = breadthBody?.advance || {};

  const breadth = {
    advances: num(advance.advances),
    declines: num(advance.declines),
    unchanged: num(advance.unchanged)
  };

  const vixItem = findIndex(indices, ['INDIA VIX']);
  const vix = num(vixItem?.last ?? vixItem?.lastPrice ?? vixItem?.value);

  const sectors = sectorMap.map(([name, aliases]) => {
    const item = findIndex(indices, aliases);
    const change = num(item?.percentChange ?? item?.pChange ?? item?.change);
    return {
      name,
      value: change,
      status: change == null ? 'Unavailable' : change >= 1 ? 'Strong' : change > 0.15 ? 'Positive' : change <= -0.75 ? 'Weak' : change < -0.15 ? 'Negative' : 'Neutral'
    };
  });

  const score = marketScore(indices, breadth, vix);

  return {
    success: true,
    source: 'nse',
    score,
    bias: score >= 60 ? 'BULLISH' : score <= 40 ? 'BEARISH' : 'NEUTRAL',
    momentum: score >= 55 ? 'Positive' : score <= 45 ? 'Negative' : 'Mixed',
    breadth,
    vix,
    sectors,
    updated: new Date().toISOString()
  };
}

express.application.listen = function (...args) {
  if (!installed) {
    installed = true;

    this.get('/api/market-intelligence', async (req, res) => {
      try {
        if (cached && Date.now() - cachedAt < 12000) return res.json(cached);
        cached = await buildData();
        cachedAt = Date.now();
        return res.json(cached);
      } catch (error) {
        console.log('[StrikePulse] market intelligence:', error.message);
        return res.status(503).json({
          success: false,
          source: 'nse',
          error: 'Market intelligence temporarily unavailable'
        });
      }
    });

    console.log('[StrikePulse] market intelligence endpoint enabled');
  }

  return originalListen.apply(this, args);
};
