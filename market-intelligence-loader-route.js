'use strict';

// Isolated static loader route for Market Intelligence.
// This adds only /market-intelligence-loader.js and leaves existing API/option-chain routes untouched.
const express = require('express');
const ORIGINAL_GET = express.application.get;

const LOADER = `(function(){'use strict';if(window.__SP_MARKET_INTELLIGENCE_LOADER__)return;window.__SP_MARKET_INTELLIGENCE_LOADER__=true;const base='https://strike-pulse-relay.onrender.com/';function loadCss(){if(document.querySelector('link[data-sp-market-intelligence-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=base+'market-cards.css?v=1';l.dataset.spMarketIntelligenceCss='1';document.head.appendChild(l)}function loadJs(){if(document.querySelector('script[data-sp-market-intelligence-js]'))return;const s=document.createElement('script');s.src=base+'market-intelligence.js?v=1';s.defer=true;s.dataset.spMarketIntelligenceJs='1';document.head.appendChild(s)}function start(){loadCss();loadJs()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()})();`;

express.application.get = function(path, ...handlers) {
  if (path === '/market-intelligence-loader.js') {
    return ORIGINAL_GET.call(this, path, (req, res) => {
      res.type('application/javascript').set('Cache-Control', 'no-store').send(LOADER);
    });
  }
  return ORIGINAL_GET.call(this, path, ...handlers);
};

console.log('[MARKET INTELLIGENCE] loader route loaded — /market-intelligence-loader.js');
