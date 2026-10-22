'use strict';
const { fetchCandles, cleanSymbol, pearson, boundedInt } = require('./shared');
async function correlation(q) {
  const symbols = String(q.symbols || [q.symbolA || 'RELIANCE', q.symbolB || 'TCS', q.benchmark || 'NIFTY'].join(',')).toUpperCase().split(',').map(x => x.trim()).filter(Boolean).slice(0, 5).map(cleanSymbol);
  if (symbols.length < 2) throw new Error('Select at least two instruments');
  const window = boundedInt(q.window || q.sessions, 60, 20, 252);
  const loaded = await Promise.all(symbols.map(async symbol => ({ symbol, data: await fetchCandles(symbol, '2y', '1d') })));
  const maps = loaded.map(item => { const map = new Map(); for (let i = 1; i < item.data.rows.length; i++) { const a = item.data.rows[i - 1], b = item.data.rows[i]; if (a.close && b.close) map.set(b.t, b.close / a.close - 1); } return map; });
  const times = [...maps[0].keys()].filter(t => maps.every(m => m.has(t))).sort((a, b) => a - b).slice(-window);
  if (times.length < Math.min(window, 20)) throw new Error('Insufficient overlapping historical sessions');
  const series = loaded.map((item, i) => ({ symbol: item.symbol, points: times.map(t => ({ timestamp: t, return: maps[i].get(t) })) }));
  const matrix = loaded.map((item, i) => ({ symbol: item.symbol, correlations: loaded.map((other, j) => ({ symbol: other.symbol, value: pearson(times.map(t => maps[i].get(t)), times.map(t => maps[j].get(t))) })) }));
  return { success: true, symbols, window: times.length, series, matrix, source: 'Historical daily closes', updated: new Date().toISOString(), note: 'Pearson correlations use aligned daily close-to-close returns; correlation is descriptive and does not imply causation.' };
}
module.exports = { '/api/analysis/correlation': correlation, '/api/analysis/correlation-lab': correlation };
