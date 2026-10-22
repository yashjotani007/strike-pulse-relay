'use strict';
const { fetchCandles, calcStats, cleanSymbol } = require('./shared');
async function watchlist(q) {
  const symbols = String(q.symbols || q.symbol || '').toUpperCase().split(',').map(x => x.trim()).filter(Boolean).slice(0, 8).map(cleanSymbol);
  if (!symbols.length) throw new Error('Pass one or more symbols using ?symbols=RELIANCE,TCS');
  const settled = await Promise.allSettled(symbols.map(async symbol => Object.assign({ symbol }, calcStats((await fetchCandles(symbol, '1mo', '1d')).rows))));
  const results = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const errors = settled.filter(x => x.status === 'rejected').map((x, i) => ({ error: x.reason && x.reason.message || 'Data unavailable' }));
  return { success: results.length > 0, results, errors, requested: symbols.length, source: 'Historical market candles', updated: new Date().toISOString(), note: 'Snapshot endpoint only; it does not persist a watchlist or send notifications. Save watchlist preferences in the frontend if needed.' };
}
module.exports = { '/api/analysis/watchlist': watchlist, '/api/analysis/research-alerts': watchlist };
