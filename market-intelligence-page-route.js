'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const ORIGINAL_USE = express.application.use;
let installed = false;

express.application.use = function(...args) {
  if (!installed) {
    installed = true;
    ORIGINAL_USE.call(this, function(req, res, next) {
      if (req.method === 'GET' && req.path === '/market-intelligence-page.js') {
        try {
          const file = path.join(__dirname, 'public', 'market-intelligence-page.js');
          return res
            .status(200)
            .type('application/javascript')
            .set('Access-Control-Allow-Origin', '*')
            .set('Cache-Control', 'no-store')
            .send(fs.readFileSync(file, 'utf8'));
        } catch (e) {
          return res.status(500).type('text/plain').send(
            'Market Intelligence page JS unavailable: ' + e.message
          );
        }
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this, ...args);
};

console.log('[MARKET INTELLIGENCE PAGE] middleware ready — /market-intelligence-page.js');
