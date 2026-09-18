(function () {
  'use strict';

  if (window.__SP_OI_ANALYSIS_LOADER__) return;
  window.__SP_OI_ANALYSIS_LOADER__ = true;

  const BASE = 'https://strike-pulse-relay.onrender.com/';

  function loadOIAnalysis() {
    if (document.querySelector('script[data-sp-oi-analysis]')) return;

    const script = document.createElement('script');
    script.src = BASE + 'oi-analysis.js?v=2';
    script.defer = true;
    script.dataset.spOiAnalysis = '1';

    script.onload = function () {
      console.log('[OI Analysis] loader: JS loaded');
    };

    script.onerror = function (err) {
      console.error('[OI Analysis] loader: JS failed', err);
    };

    (document.head || document.documentElement).appendChild(script);
  }

  function start() {
    if (document.querySelector('.sp-oi-intel')) {
      loadOIAnalysis();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
