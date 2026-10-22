'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function statistics(q) {
  const symbol = cleanSymbol(q.symbol || 'TCS'), requested = boundedInt(q.sessions, 60, 20, 240);
  const data = await fetchCandles(symbol, '2y', '1d'), selected = data.rows.slice(-requested - 1);
  if (selected.length < 21) throw new Error('Insufficient daily historical sessions');
  const points = selected.slice(1).map((x, i) => ({ timestamp: x.t, close: x.close, returnPct: (x.close / selected[i].close - 1) * 100 })).filter(x => Number.isFinite(x.returnPct));
  const values = points.map(x => x.returnPct), n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n, sorted = values.slice().sort((a, b) => a - b);
  const percentile = p => { const idx = (n - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx); return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); };
  const wins = values.filter(x => x > 0).length, losses = values.filter(x => x < 0).length, flats = n - wins - losses;
  let streak = 0, bestUp = 0, bestDown = 0;
  for (const x of values) { streak = x > 0 ? Math.max(0, streak) + 1 : x < 0 ? Math.min(0, streak) - 1 : 0; bestUp = Math.max(bestUp, streak); bestDown = Math.max(bestDown, -streak); }
  return { success: true, symbol, sessions: n, meanDailyReturnPct: mean, medianDailyReturnPct: percentile(0.5), dailyVolatilityPct: Math.sqrt(variance), annualizedVolatilityPct: Math.sqrt(variance) * Math.sqrt(252), positiveSessions: wins, negativeSessions: losses, flatSessions: flats, positiveRatePct: wins / n * 100, bestDayPct: Math.max.apply(null, values), worstDayPct: Math.min.apply(null, values), p10Pct: percentile(0.1), p90Pct: percentile(0.9), periodReturnPct: (selected[selected.length - 1].close / selected[0].close - 1) * 100, longestUpStreak: bestUp, longestDownStreak: bestDown, points: points.slice(-120), source: data.source, updated: new Date().toISOString(), note: 'Descriptive historical close-to-close returns, not a forecast. Provider data may not be adjusted for all corporate actions.' };
}
module.exports = { '/api/analysis/statistics': statistics, '/api/analysis/statistics-lab': statistics };
