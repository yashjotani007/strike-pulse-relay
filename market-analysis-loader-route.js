'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');

const originalUse = express.application.use;
express.application.use = function (...args) {
  return originalUse.call(this, function (req, res, next) {
    const pathname = req && (req.path || String(req.originalUrl || '').split('?')[0]);
    if (req.method !== 'GET' || pathname !== '/market-analysis.js') return next();
    try {
      const file = path.join(__dirname, 'public', 'market-analysis.js');
      res.set('Access-Control-Allow-Origin', '*')
        .set('Cache-Control', 'no-store, no-cache, must-revalidate')
        .type('application/javascript');
      return res.send(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      return res.status(500).type('text/plain').send('Market Analysis frontend unavailable');
    }
  }, ...args);
};
console.log('[MARKET ANALYSIS] frontend loader route ready — /market-analysis.js');
