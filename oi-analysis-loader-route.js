'use strict';

const express = require('express');

if (!express.application.__strikePulseOIAnalysisLoaderRoute) {
  const originalUse = express.application.use;
  let installed = false;

  express.application.use = function (...args) {
    if (!installed) {
      installed = true;

      originalUse.call(this, function (req, res, next) {
        if (req.method === 'GET' && req.path === '/oi-analysis-loader.js') {
          const js = `(function(){'use strict';if(window.__SP_OI_ANALYSIS_LOADER__)return;window.__SP_OI_ANALYSIS_LOADER__=true;var s=document.createElement('script');s.src='https://strike-pulse-relay.onrender.com/oi-analysis.js?v=2';s.defer=true;s.dataset.spOiAnalysis='1';s.onload=function(){console.log('[OI Analysis] loader: JS loaded')};s.onerror=function(e){console.error('[OI Analysis] loader: JS failed',e)};(document.head||document.documentElement).appendChild(s)})();`;

          return res
            .status(200)
            .type('application/javascript')
            .set('Access-Control-Allow-Origin', '*')
            .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .send(js);
        }

        next();
      });
    }

    return originalUse.call(this, ...args);
  };

  express.application.__strikePulseOIAnalysisLoaderRoute = true;
  console.log('[OI Analysis] loader route loaded — /oi-analysis-loader.js');
}
