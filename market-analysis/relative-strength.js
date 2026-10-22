'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function relativeStrength(q) {
  const benchmark = cleanSymbol(q.benchmark || 'NIFTY');
  const symbols = String(q.symbols || q.symbol || 'RELIANCE,TCS,INFY,SBIN,HDFCBANK').toUpperCase().split(',').map(x => x.trim()).filter(Boolean).slice(0, 8).map(cleanSymbol);
  const range = String(q.range || '6mo');
  const period = boundedInt(q.sessions, 60, 10, 250);
  const loaded = await Promise.allSettled([...new Set([...symbols, benchmark])].map(async symbol => ({ symbol, data: await fetchCandles(symbol, range, '1d') })));
  const good = new Map(loaded.filter(x => x.status === 'fulfilled').map(x => [x.value.symbol, x.value.data.rows]));
  const baseRows = good.get(benchmark);
  if (!baseRows || baseRows.length < 2) throw new Error('Benchmark history unavailable for ' + benchmark);
  const baseStart = baseRows[Math.max(0, baseRows.length - period - 1)], baseEnd = baseRows[baseRows.length - 1];
  const benchmarkReturn = baseStart.close ? (baseEnd.close / baseStart.close - 1) * 100 : null;
  const results = symbols.map(symbol => {
    const rows = good.get(symbol);
    if (!rows || rows.length < 2) return { symbol, available: false, error: 'Historical data unavailable' };
    const start = rows[Math.max(0, rows.length - period - 1)], end = rows[rows.length - 1];
    const stockReturn = start.close ? (end.close / start.close - 1) * 100 : null;
    return { symbol, available: stockReturn != null, price: end.close, periodReturnPct: stockReturn, benchmark, benchmarkReturnPct: benchmarkReturn, excessReturnPct: stockReturn != null && benchmarkReturn != null ? stockReturn - benchmarkReturn : null, lastTimestamp: end.t };
  }).sort((a, b) => (b.excessReturnPct ?? -Infinity) - (a.excessReturnPct ?? -Infinity));
  return { success: true, benchmark, sessionsRequested: period, results, source: 'Historical daily closes', updated: new Date().toISOString(), note: 'Relative strength is the difference between instrument and benchmark returns over the selected recent session window; it is descriptive, not predictive.' };
}
module.exports = { '/api/analysis/relative-strength': relativeStrength, '/api/analysis/sector-rotation': relativeStrength };
