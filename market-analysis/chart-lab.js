'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function chart(q) {
  const symbol = cleanSymbol(q.symbol || q.ticker || 'RELIANCE');
  const timeframe = String(q.timeframe || q.interval || '1d').toLowerCase();
  const map = { '1m': ['1d','1m'], '5m': ['5d','5m'], '15m': ['5d','15m'], '30m': ['1mo','30m'], '1h': ['3mo','60m'], '4h': ['6mo','60m'], '1d': ['2y','1d'], '1w': ['5y','1wk'], '1mo': ['10y','1mo'] };
  const selected = map[timeframe] || map['1d'];
  const data = await fetchCandles(symbol, q.range || selected[0], selected[1]);
  const limit = boundedInt(q.limit, 300, 20, 1500);
  const rows = data.rows.slice(-limit);
  let relativeStrength = null;
  const benchmark = String(q.benchmark || 'NIFTY').toUpperCase();
  if (q.relativeStrength === 'true' || q.relativeStrength === '1') {
    try {
      const b = await fetchCandles(benchmark, data.range, selected[1]);
      const bm = new Map(b.rows.map(x => [x.t, x.close]));
      const first = rows.find(x => bm.has(x.t));
      const last = [...rows].reverse().find(x => bm.has(x.t));
      if (first && last && first.close && bm.get(first.t) && bm.get(last.t)) relativeStrength = { benchmark, stockReturnPct: (last.close / first.close - 1) * 100, benchmarkReturnPct: (bm.get(last.t) / bm.get(first.t) - 1) * 100, excessReturnPct: (last.close / first.close - bm.get(last.t) / bm.get(first.t)) * 100 };
    } catch (_) { relativeStrength = null; }
  }
  const candles = rows.map(x => ({ timestamp: x.t, t: x.t, open: x.open, high: x.high, low: x.low, close: x.close, c: x.close, h: x.high, l: x.low, volume: x.volume, v: x.volume }));
  return { success: true, symbol, timeframe, range: data.range, interval: data.interval, candles, rows: candles, count: rows.length, relativeStrength, source: data.source, updated: data.updated, note: 'Historical provider candles. The newest candle may be incomplete; this endpoint is not an exchange-certified live feed.' };
}
module.exports = { '/api/analysis/chart': chart, '/api/analysis/chart-lab': chart };
