'use strict';

// Route-order-independent static loader for Market Intelligence.
// It only serves /market-intelligence-loader.js and does not alter API/option-chain routes.
const express = require('express');
const ORIGINAL_USE = express.application.use;
const LOADER = `(function(){'use strict';if(window.__SP_MARKET_INTELLIGENCE_LOADER__)return;window.__SP_MARKET_INTELLIGENCE_LOADER__=true;const base='https://strike-pulse-relay.onrender.com/';function loadCss(){if(document.querySelector('link[data-sp-market-intelligence-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=base+'market-cards.css?v=1';l.dataset.spMarketIntelligenceCss='1';document.head.appendChild(l)}function loadJs(){if(document.querySelector('script[data-sp-market-intelligence-js]'))return;const s=document.createElement('script');s.src=base+'market-intelligence.js?v=1';s.defer=true;s.dataset.spMarketIntelligenceJs='1';document.head.appendChild(s)}function start(){loadCss();loadJs()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()})();`;

const installed = new WeakSet();
express.application.use = function(...args) {
  if (!installed.has(this)) {
    installed.add(this);
    ORIGINAL_USE.call(this, (req, res, next) => {
      if (req && req.path === '/market-intelligence-loader.js') {
        return res.type('application/javascript').set('Cache-Control','no-store').send(LOADER);
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this, ...args);
};

console.log('[MARKET INTELLIGENCE] route-order-independent loader middleware loaded');
