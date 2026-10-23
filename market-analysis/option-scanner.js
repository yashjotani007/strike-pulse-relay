'use strict';
const { num, boundedInt } = require('./shared');
async function scan(q) {
  const symbol = String(q.symbol || q.underlying || 'NIFTY').trim().toUpperCase();
  if (!/^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|NIFTYNXT50|SENSEX|[A-Z0-9&-]{1,25})$/.test(symbol)) throw new Error('Invalid option underlying');
  let chain;
  if (symbol === 'SENSEX' && typeof global.__SP_BSE_SENSEX_CHAIN__ === 'function') chain = await global.__SP_BSE_SENSEX_CHAIN__();
  else if (typeof global.__SP_LOAD_CHAIN__ === 'function') chain = await global.__SP_LOAD_CHAIN__(symbol, q.expiry ? String(q.expiry) : null, true);
  else throw new Error('Existing option-chain relay is unavailable');
  if (!chain || chain.success !== true || !Array.isArray(chain.rows) || !chain.rows.length) throw new Error('Verified option-chain rows are unavailable');
  const side = String(q.type || q.optionType || 'both').toLowerCase();
  const minOiPct = q.minOi == null || q.minOi === '' ? null : Number(q.minOi);
  const minOIChange = q.oiChange == null || q.oiChange === '' ? null : Number(q.oiChange);
  const minVolume = q.minVolume == null || q.minVolume === '' ? 0 : Number(q.minVolume);
  const ivRaw = q.minIV ?? q.minIv;
  const minIV = ivRaw == null || ivRaw === '' ? null : Number(ivRaw);
  const maxSpread = q.maxSpread == null ? null : Number(q.maxSpread);
  const rows = [];
  for (const row of chain.rows) {
    for (const key of ['ce', 'pe']) {
      if (side === 'call' && key !== 'ce' || side === 'ce' && key !== 'ce' || side === 'put' && key !== 'pe' || side === 'pe' && key !== 'pe') continue;
      const leg = row[key] || {};
      const oi = num(leg.oi), oiChange = num(leg.oiChange), volume = num(leg.volume), iv = num(leg.iv), bid = num(leg.bid), ask = num(leg.ask), ltp = num(leg.ltp);
      const spread = bid != null && ask != null && bid > 0 && ask >= bid ? ask - bid : null;
      const previousOI = oi != null && oiChange != null ? oi - oiChange : null;
      const oiPct = previousOI != null && previousOI > 0 && oiChange != null ? (oiChange / previousOI) * 100 : null;
      if (minOIChange != null && (oiChange == null || Math.abs(oiChange) < minOIChange)) continue;
      if (minOiPct != null && (oiPct == null || oiPct < minOiPct)) continue;
      if (volume == null || volume < minVolume) continue;
      if (minIV != null && (iv == null || iv < minIV)) continue;
      if (maxSpread != null && (spread == null || spread > maxSpread)) continue;
      rows.push({ symbol, strike: num(row.strike), type: key === 'ce' ? 'CE' : 'PE', expiry: chain.expiry || null, ltp, oi, oiChange, oiPct, volume, iv, bid, ask, spread, delta: num(leg.delta), gamma: num(leg.gamma), theta: num(leg.theta), vega: num(leg.vega), source: chain.source || 'option-chain relay' });
    }
  }
  rows.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const limit = boundedInt(q.limit, 50, 1, 200);
  return { success: true, symbol, spot: num(chain.spot), expiry: chain.expiry || null, totalRows: rows.length, results: rows.slice(0, limit), filters: { type: side, minOiPct, minOIChange, minVolume, minIV, maxSpread }, source: chain.source || 'existing option-chain relay', updated: chain.updated || new Date().toISOString(), note: 'Only fields supplied by the upstream chain are used. Missing bid/ask or IV values remain unavailable; no synthetic spread is calculated.' };
}
module.exports = { '/api/analysis/option-scanner': scan, '/api/analysis/options': scan, '/api/analysis/unusual-activity': scan };
