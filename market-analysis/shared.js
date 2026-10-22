'use strict';

const NSE = 'https://www.nseindia.com';
const YAHOO = 'https://query1.finance.yahoo.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134 Safari/537.36';
const num = v => v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const universeCache = { at: 0, rows: [] };
const candleCache = new Map();
const INDEX_ALIASES = { NIFTY: '^NSEI', NIFTY50: '^NSEI', BANKNIFTY: '^NSEBANK', FINNIFTY: '^CNXFIN', MIDCPNIFTY: '^NSEMDCP50', NIFTYIT: '^CNXIT', NIFTY100: '^CNX100', SENSEX: '^BSESN', INDIAVIX: '^INDIAVIX' };

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(symbol)) throw new Error('Invalid NSE symbol');
  return symbol;
}
function parseCsvLine(line) {
  const out = []; let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(value.trim()); value = ''; }
    else value += ch;
  }
  out.push(value.trim());
  return out;
}
async function getUniverse() {
  if (universeCache.rows.length && Date.now() - universeCache.at < 6 * 60 * 60 * 1000) return universeCache.rows;
  const r = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
    headers: { 'User-Agent': UA, 'Accept': 'text/csv,*/*' }, signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error('NSE equity directory HTTP ' + r.status);
  const text = (await r.text()).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 500) throw new Error('NSE equity directory is incomplete');
  const headers = parseCsvLine(lines[0]).map(x => x.replace(/^"|"$/g, '').toUpperCase());
  const si = headers.indexOf('SYMBOL'), ni = headers.indexOf('NAME OF COMPANY'), se = headers.indexOf('SERIES');
  if (si < 0) throw new Error('NSE equity directory format changed');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = parseCsvLine(lines[i]);
    const symbol = String(p[si] || '').replace(/^"|"$/g, '').trim().toUpperCase();
    const name = String(p[ni] || symbol).replace(/^"|"$/g, '').trim();
    const series = se < 0 ? 'EQ' : String(p[se] || '').replace(/^"|"$/g, '').trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(symbol) && (!se || series === 'EQ')) rows.push({ symbol, name, exchange: 'NSE' });
  }
  if (rows.length < 500) throw new Error('NSE equity directory validation failed');
  universeCache.rows = rows; universeCache.at = Date.now();
  return rows;
}
async function fetchCandles(rawSymbol, range, interval) {
  const symbol = cleanSymbol(rawSymbol || 'RELIANCE');
  const allowedIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  const allowedRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'];
  interval = allowedIntervals.includes(String(interval)) ? String(interval) : '1d';
  range = allowedRanges.includes(String(range)) ? String(range) : (interval === '1d' || interval === '1wk' ? '2y' : '5d');
  const key = symbol + '|' + range + '|' + interval;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 45000) return hit.data;
  const providerSymbol = INDEX_ALIASES[symbol] || (symbol.endsWith('=F') || symbol.startsWith('^') ? symbol : symbol + '.NS');
  const url = YAHOO + '/v8/finance/chart/' + encodeURIComponent(providerSymbol) + '?range=' + encodeURIComponent(range) + '&interval=' + encodeURIComponent(interval) + '&events=history';
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('Historical data provider HTTP ' + r.status);
  const body = await r.json();
  const result = body && body.chart && body.chart.result && body.chart.result[0];
  const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!result || !quote) throw new Error('Historical candles unavailable for ' + symbol);
  const timestamps = result.timestamp || [];
  const rows = timestamps.map((t, i) => ({
    t: t * 1000,
    open: num(quote.open && quote.open[i]), high: num(quote.high && quote.high[i]),
    low: num(quote.low && quote.low[i]), close: num(quote.close && quote.close[i]),
    volume: num(quote.volume && quote.volume[i])
  })).filter(x => x.close != null && x.close > 0 && x.high != null && x.low != null && x.high >= x.low);
  if (!rows.length) throw new Error('No valid historical candles returned for ' + symbol);
  const data = { symbol, providerSymbol, currency: result.meta && result.meta.currency || null, exchange: result.meta && result.meta.exchangeName || null, rows, source: 'Yahoo Finance chart feed', interval, range, updated: new Date().toISOString() };
  candleCache.set(key, { at: Date.now(), data });
  if (candleCache.size > 120) candleCache.delete(candleCache.keys().next().value);
  return data;
}
function calcStats(rows) {
  if (!Array.isArray(rows) || rows.length < 16) throw new Error('At least 16 valid candles are required for scanner statistics');
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const closes = rows.map(x => x.close);
  const volumes = rows.slice(-21, -1).map(x => x.volume).filter(x => x != null && x >= 0);
  const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;
  let gain = 0, loss = 0;
  for (let i = rows.length - 14; i < rows.length; i++) {
    const d = closes[i] - closes[i - 1]; gain += Math.max(0, d); loss += Math.max(0, -d);
  }
  const rsi = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  const previous = rows.slice(-21, -1);
  return {
    price: last.close, changePct: prev && prev.close ? (last.close / prev.close - 1) * 100 : null,
    rsi14: rsi, volume: last.volume, averageVolume20: avgVolume,
    relativeVolume: avgVolume > 0 && last.volume != null ? last.volume / avgVolume : null,
    high20: previous.length ? Math.max.apply(null, previous.map(x => x.high)) : null,
    low20: previous.length ? Math.min.apply(null, previous.map(x => x.low)) : null,
    candleTime: last.t
  };
}
function pearson(a, b) {
  const n = Math.min(a.length, b.length); if (n < 10) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let top = 0, xx = 0, yy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; top += dx * dy; xx += dx * dx; yy += dy * dy; }
  return xx && yy ? top / Math.sqrt(xx * yy) : null;
}
function boundedInt(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
module.exports = { NSE, YAHOO, UA, num, cleanSymbol, getUniverse, fetchCandles, calcStats, pearson, boundedInt, INDEX_ALIASES };
