'use strict';
const { getUniverse, fetchCandles, calcStats, cleanSymbol, boundedInt } = require('./shared');

async function universe(q) {
  const rows = await getUniverse();
  const term = String(q.q || q.query || '').trim().toUpperCase();
  const offset = boundedInt(q.offset, 0, 0, 10000), limit = boundedInt(q.limit, 30, 1, 100);
  let matches = term ? rows.filter(x => x.symbol.includes(term) || x.name.toUpperCase().includes(term)) : rows;
  if (term && !matches.length && term.length >= 4) {
    const distance = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let diagonal = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const previous = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = previous; } } return d[b.length]; };
    const cutoff = term.length >= 7 ? 2 : 1;
    matches = rows.map(x => ({ x, distance: distance(term, x.symbol) })).filter(x => x.distance <= cutoff).sort((a, b) => a.distance - b.distance).slice(0, 10).map(x => Object.assign({}, x.x, { matchType: 'fuzzy', distance: x.distance, matchedQuery: term }));
  }
  return { success: true, total: matches.length, offset, limit, results: matches.slice(offset, offset + limit), source: 'NSE equity directory', updated: new Date().toISOString() };
}
async function scanBatch(q) {
  const rows = await getUniverse();
  const offset = boundedInt(q.offset, 0, 0, rows.length), limit = boundedInt(q.limit, 5, 1, 8);
  let symbols = String(q.symbols || '').trim() ? String(q.symbols).toUpperCase().split(',').map(s => s.trim()).filter(Boolean).slice(0, 8) : rows.slice(offset, offset + limit).map(x => x.symbol);
  symbols = symbols.filter(s => rows.some(x => x.symbol === s));
  const settled = await Promise.allSettled(symbols.map(async symbol => {
    const history = await fetchCandles(symbol, '1mo', '1d');
    return Object.assign({ symbol }, calcStats(history.rows));
  }));
  const results = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const failed = settled.filter(x => x.status === 'rejected').map((x, i) => ({ error: x.reason && x.reason.message || 'Provider unavailable' }));
  return { success: results.length > 0, results, requested: symbols.length, failed, nextOffset: offset + limit, total: rows.length, hasMore: offset + limit < rows.length, source: 'NSE directory / historical market candles', updated: new Date().toISOString(), note: 'Scanner results use the latest available provider candle and may not be real-time.' };
}
function ema(rows, period) {
  if (!Array.isArray(rows) || rows.length < period) return null;
  const k = 2 / (period + 1);
  let value = rows.slice(0, period).reduce((sum, row) => sum + row.close, 0) / period;
  for (let i = period; i < rows.length; i++) value = rows[i].close * k + value * (1 - k);
  return Number.isFinite(value) ? value : null;
}
function addIndicators(rows, interval) {
  const stats = calcStats(rows);
  const intraday = /^(1m|2m|5m|15m|30m|60m|90m|1h)$/.test(interval);
  let vwap = null;
  if (intraday && rows.length) {
    const dayKey = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
    const lastDay = dayKey(rows[rows.length - 1].t);
    const dayRows = rows.filter(x => dayKey(x.t) === lastDay && x.volume != null && x.volume > 0);
    const volume = dayRows.reduce((sum, x) => sum + x.volume, 0);
    if (volume > 0) vwap = dayRows.reduce((sum, x) => sum + ((x.high + x.low + x.close) / 3) * x.volume, 0) / volume;
  }
  return Object.assign({}, stats, { ema20: ema(rows, 20), ema50: ema(rows, 50), ema200: ema(rows, 200), vwap });
}
async function stockScanner(q) {
  const symbols = String(q.symbols || q.symbol || 'RELIANCE,TCS,INFY,SBIN,HDFCBANK').toUpperCase().split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
  const intervalRaw = String(q.interval || '1d');
  const interval = ['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo'].includes(intervalRaw) ? intervalRaw : '1d';
  const defaultRange = ['1d','1wk'].includes(interval) ? '1y' : '5d';
  const range = String(q.range || defaultRange);
  const rows = await getUniverse();
  const known = new Set(rows.map(x => x.symbol));
  const minPrice = q.minPrice === undefined || q.minPrice === '' ? null : Number(q.minPrice);
  const maxPrice = q.maxPrice === undefined || q.maxPrice === '' ? null : Number(q.maxPrice);
  const minVolume = q.minVolume === undefined || q.minVolume === '' ? null : Number(q.minVolume);
  const minRvol = q.minRvol === undefined && q.relativeVolume === undefined && q.rvol === undefined ? null : Number(q.minRvol ?? q.relativeVolume ?? q.rvol);
  const rsiMin = Number(q.rsiMin ?? q.rsiMinimum ?? 0);
  const rsiMax = Number(q.rsiMax ?? q.rsiMaximum ?? 100);
  const minChange = q.minChange === undefined || q.minChange === '' ? null : Number(q.minChange);
  const settled = await Promise.allSettled(symbols.filter(s => known.has(s) || s.startsWith('NIFTY') || ['BANKNIFTY','FINNIFTY','MIDCPNIFTY','SENSEX','INDIAVIX'].includes(s)).map(async symbol => Object.assign({ symbol }, addIndicators((await fetchCandles(symbol, range, interval)).rows, interval))));
  const all = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const results = all.filter(x => (minPrice == null || x.price >= minPrice) && (maxPrice == null || x.price <= maxPrice) && (minVolume == null || x.volume != null && x.volume >= minVolume) && (minRvol == null || x.relativeVolume != null && x.relativeVolume >= minRvol) && x.rsi14 >= rsiMin && x.rsi14 <= rsiMax && (minChange == null || x.changePct != null && x.changePct >= minChange));
  return { success: true, results, totalChecked: symbols.length, matched: results.length, coverage: `${all.length}/${symbols.length} symbol(s) returned valid candles`, failed: settled.filter(x => x.status === 'rejected').map(x => x.reason && x.reason.message || 'Data unavailable'), filters: { minPrice, maxPrice, minVolume, minRvol, rsiMin, rsiMax, minChange, interval, range }, source: 'Yahoo Finance historical candles; NSE equity directory for symbol validation', updated: new Date().toISOString(), note: 'Scanner results use the latest available provider candle and may be delayed; not a guaranteed real-time feed.' };
}
module.exports = { '/api/analysis/universe': universe, '/api/analysis/scan-batch': scanBatch, '/api/analysis/stock-scanner': stockScanner };
