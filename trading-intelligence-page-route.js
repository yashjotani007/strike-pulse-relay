'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');

const FILES = {
  '/trading-intelligence-page.js': ['public/trading-intelligence-page.js', 'application/javascript'],
  '/trading-intelligence-page.css': ['public/trading-intelligence-page.css', 'text/css']
};
const LOADER = String.raw`(function(){
'use strict';
if(window.__SP_TRADING_INTELLIGENCE_LOADER_V1__)return;
var root=document.getElementById('sp-ti-page');
if(!root){console.warn('[Strike Pulse] Trading Intelligence embed root is missing.');return;}
window.__SP_TRADING_INTELLIGENCE_LOADER_V1__=true;
var base='https://strike-pulse-relay.onrender.com/';
if(!document.querySelector('link[data-sp-ti-page-css]')){
 var l=document.createElement('link');l.rel='stylesheet';l.href=base+'trading-intelligence-page.css?v=1';l.dataset.spTiPageCss='1';document.head.appendChild(l);
}
if(!document.querySelector('script[data-sp-ti-page-js]')){
 var s=document.createElement('script');s.src=base+'trading-intelligence-page.js?v=1';s.defer=true;s.dataset.spTiPageJs='1';s.onerror=function(){console.error('[Strike Pulse] Trading Intelligence page script failed to load');};document.head.appendChild(s);
}
})();`;

const ORIGINAL_USE = express.application.use;
let installed = false;
express.application.use = function(...args) {
  if (!installed) {
    installed = true;
    ORIGINAL_USE.call(this, function(req, res, next) {
      if (req.method === 'GET' && (req.path === '/trading-intelligence' || req.path === '/trading-intelligence/')) {
        return res.status(200).type('html').set('Cache-Control', 'no-store').send(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trading Intelligence · Strike Pulse</title></head><body style="margin:0;background:#f6f8fb;font-family:Arial,sans-serif"><div id="sp-ti-page"></div><script defer src="https://strike-pulse-relay.onrender.com/trading-intelligence-loader.js?v=1"></script></body></html>'
        );
      }
      if (req.method === 'GET' && req.path === '/trading-intelligence-loader.js') {
        return res.status(200).type('application/javascript')
          .set('Access-Control-Allow-Origin', '*')
          .set('Cache-Control', 'no-store').send(LOADER);
      }
      const file = FILES[req.path];
      if (req.method === 'GET' && file) {
        try {
          return res.status(200).type(file[1])
            .set('Access-Control-Allow-Origin', '*')
            .set('Cache-Control', 'no-store')
            .send(fs.readFileSync(path.join(__dirname, file[0]), 'utf8'));
        } catch (e) {
          return res.status(500).type('text/plain').send('Trading Intelligence asset unavailable: ' + e.message);
        }
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this, ...args);
};
console.log('[TRADING INTELLIGENCE] standalone page routes ready');
