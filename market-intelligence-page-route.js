'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const ORIGINAL_GET = express.application.get;

express.application.get = function(routePath, ...handlers) {
  if (routePath === '/market-intelligence-page.js') {
    return ORIGINAL_GET.call(this, routePath, (req, res) => {
      try {
        const file = path.join(__dirname, 'public', 'market-intelligence-page.js');
        res.type('application/javascript').set('Cache-Control', 'no-store').send(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        res.status(500).type('text/plain').send('Market Intelligence page JS unavailable: ' + e.message);
      }
    });
  }
  return ORIGINAL_GET.call(this, routePath, ...handlers);
};

console.log('[MARKET INTELLIGENCE PAGE] JS route loaded — /market-intelligence-page.js');
