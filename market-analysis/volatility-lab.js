'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function volatility(q) {
  const symbol = cleanSymbol(q.symbol || 'NIFTY');
  const sessions = boundedInt(q.sessions, 60, 20, 252);
  const data = await fetchCandles(symbol, '2y', '1d'), rows = data.rows.slice(-sessions - 1);
  if (rows.length < 21) throw new Error('Insufficient historical candles for volatility analysis');
  const returns = [], trueRanges = [];
  for (let i = 1; i < rows.length; i++) {
    const current = rows[i], previous = rows[i - 1];
    if (previous.close > 0) returns.push(current.close / previous.close - 1);
    trueRanges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  let peak = rows[0].close, maxDrawdown = 0;
  for (const row of rows) { peak = Math.max(peak, row.close); maxDrawdown = Math.min(maxDrawdown, row.close / peak - 1); }
  const atr14 = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trueRanges.length);
  return { success: true, symbol, sessions: returns.length, realizedDailyVolatilityPct: Math.sqrt(variance) * 100, annualizedVolatilityPct: Math.sqrt(variance * 252) * 100, atr14, atr14Pct: rows[rows.length - 1].close ? atr14 / rows[rows.length - 1].close * 100 : null, maxDrawdownPct: maxDrawdown * 100, latestClose: rows[rows.length - 1].close, source: data.source, updated: new Date().toISOString(), note: 'Historical realized volatility, ATR and drawdown calculations. Not a forecast or a risk guarantee.' };
}
module.exports = { '/api/analysis/volatility': volatility, '/api/analysis/risk-lab': volatility };
