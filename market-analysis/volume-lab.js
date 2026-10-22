'use strict';
const { fetchCandles, cleanSymbol, boundedInt } = require('./shared');
async function volumeLab(q) {
  const symbol = cleanSymbol(q.symbol || 'TCS');
  const lookback = boundedInt(q.lookback || q.sessions, 20, 10, 120);
  const data = await fetchCandles(symbol, '1y', '1d');
  const rows = data.rows.filter(x => x.volume != null && x.volume >= 0);
  if (rows.length < lookback + 2) throw new Error('Insufficient historical volume data');
  const latest = rows[rows.length - 1], prior = rows[rows.length - 2], history = rows.slice(-lookback - 1, -1);
  const avg = a => a.length ? a.reduce((sum, x) => sum + x.volume, 0) / a.length : null;
  const avgVolume = avg(history), up = history.filter((x, i) => i > 0 && x.close > history[i - 1].close), down = history.filter((x, i) => i > 0 && x.close < history[i - 1].close);
  return { success: true, symbol, lookback, sessions: rows.length, latest: { timestamp: latest.t, close: latest.close, volume: latest.volume, priceChangePct: prior.close ? (latest.close / prior.close - 1) * 100 : null }, averageVolume: avgVolume, relativeVolume: avgVolume > 0 ? latest.volume / avgVolume : null, highestVolume: Math.max.apply(null, history.map(x => x.volume)), averageUpDayVolume: avg(up), averageDownDayVolume: avg(down), points: rows.slice(-60).map(x => ({ timestamp: x.t, volume: x.volume, close: x.close })), source: data.source, updated: data.updated, note: 'Historical daily volume; the latest candle may be incomplete. No real-time volume is fabricated.' };
}
module.exports = { '/api/analysis/volume-lab': volumeLab, '/api/analysis/volume': volumeLab };
