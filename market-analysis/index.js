'use strict';

// Isolated Market Analysis API. No HTML/CSS and no modifications to existing market routes.
const express = require('express');
const ORIGINAL_USE = express.application.use;
const modules = [
  require('./stock-scanner'), require('./option-scanner'), require('./chart-lab'),
  require('./volume-lab'), require('./correlation-lab'), require('./backtesting'),
  require('./statistics'), require('./market-breadth'), require('./relative-strength'),
  require('./volatility-lab'), require('./watchlist')
];
const handlers = Object.assign({}, ...modules);
handlers['/api/analysis/status'] = async function () {
  return { success: true, service: 'Strike Pulse Market Analysis', version: '1.0.0', mode: 'research-only', features: { stockScanner: true, optionScanner: true, chartLab: true, volumeLab: true, marketBreadth: true, relativeStrength: true, unusualActivity: true, volatilityRiskLab: true, watchlistSnapshot: true, backtesting: true, statistics: true, correlation: true, universe: true }, routes: Object.keys(handlers).sort(), updated: new Date().toISOString() };
};

express.application.use = function (...args) {
  const middleware = async function (req, res, next) {
    const path = req && (req.path || String(req.originalUrl || '').split('?')[0]);
    if (!path || !Object.prototype.hasOwnProperty.call(handlers, path)) return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Only GET is supported for research endpoints' });
    try {
      const result = await handlers[path](req.query || {});
      return res.status(200).json(result);
    } catch (error) {
      return res.status(502).json({ success: false, error: String(error && error.message || 'Market analysis data unavailable'), route: path, source: 'strike-pulse-market-analysis', updated: new Date().toISOString() });
    }
  };
  return ORIGINAL_USE.call(this, middleware, ...args);
};

console.log('[MARKET ANALYSIS] isolated research routes ready:', Object.keys(handlers).length);
