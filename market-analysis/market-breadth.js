'use strict';
async function marketBreadth() {
  if (typeof global.__SP_MARKET_INTELLIGENCE_HANDLER__ !== 'function') throw new Error('Market Intelligence data provider is unavailable');
  const intelligence = await global.__SP_MARKET_INTELLIGENCE_HANDLER__();
  const breadth = intelligence && intelligence.breadth;
  const indices = intelligence && intelligence.indices;
  if (!breadth && !(indices && indices.sectors)) throw new Error('Verified market breadth data is unavailable from the current provider');
  return { success: true, breadth: breadth || null, sectors: indices && indices.sectors || {}, drivers: indices && indices.drivers || null, market: intelligence && intelligence.market || null, source: 'Strike Pulse Market Intelligence provider', updated: intelligence && intelligence.generatedAt || new Date().toISOString(), note: 'Only breadth and sector values returned by the configured provider are included.' };
}
module.exports = { '/api/analysis/market-breadth': marketBreadth, '/api/analysis/breadth': marketBreadth };
