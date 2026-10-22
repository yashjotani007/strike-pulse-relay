'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function backtest(q) {
  const symbol = cleanSymbol(q.symbol || 'RELIANCE');
  const fast = boundedInt(q.fast, 10, 2, 100), slow = boundedInt(q.slow, 30, fast + 1, 200);
  const costPct = Math.max(0, Math.min(1, Number(q.cost || 0))) / 100;
  const data = await fetchCandles(symbol, '2y', '1d'), rows = data.rows;
  if (rows.length < slow + 10) throw new Error('Insufficient historical candles for the selected moving averages');
  let equity = 1, position = false, trades = 0, wins = 0, entryEquity = 1, peak = 1, maxDrawdown = 0;
  const curve = [], closedTrades = [];
  const sma = (i, n) => rows.slice(i - n + 1, i + 1).reduce((sum, x) => sum + x.close, 0) / n;
  for (let i = slow; i < rows.length; i++) {
    if (position) equity *= rows[i].close / rows[i - 1].close;
    const pf = sma(i - 1, fast), ps = sma(i - 1, slow), cf = sma(i, fast), cs = sma(i, slow);
    if (!position && pf <= ps && cf > cs) { position = true; entryEquity = equity * (1 - costPct); equity = entryEquity; trades++; }
    else if (position && pf >= ps && cf < cs) { equity *= (1 - costPct); position = false; const win = equity > entryEquity; if (win) wins++; closedTrades.push({ timestamp: rows[i].t, result: win ? 'win' : 'loss', equity: equity }); }
    peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1); curve.push({ timestamp: rows[i].t, equity: equity });
  }
  return { success: true, symbol, method: 'Long-only simple moving-average crossover; close-to-close illustrative execution', fast, slow, estimatedCostPct: costPct * 100, entries: trades, closedTrades: closedTrades.length, wins, winRatePct: closedTrades.length ? wins / closedTrades.length * 100 : null, totalReturnPct: (equity - 1) * 100, maxDrawdownPct: maxDrawdown * 100, curve: curve.slice(-300), source: data.source, updated: new Date().toISOString(), note: 'Research simulation only. Excludes taxes, slippage beyond the configured cost, liquidity limits, corporate actions and real execution. Past performance does not predict future results.' };
}
module.exports = { '/api/analysis/backtest': backtest, '/api/analysis/backtesting': backtest };
