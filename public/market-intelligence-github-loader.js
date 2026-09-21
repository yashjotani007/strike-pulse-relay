(function () {
  'use strict';

  if (window.__SP_GITHUB_MARKET_LOADER__) return;
  window.__SP_GITHUB_MARKET_LOADER__ = true;

  var BASE = 'https://raw.githubusercontent.com/yashjotani007/strike-pulse-relay/main/public/';
  var COMMON = BASE + 'strike-pulse.js?v=20260921';
  var MARKET = BASE + 'market-intelligence-page.js?v=20260921';

  function load(src, done) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () {
      console.log('[StrikePulse] GitHub loaded:', src);
      if (done) done();
    };
    s.onerror = function (e) {
      console.error('[StrikePulse] GitHub script failed:', src, e);
      if (done) done();
    };
    (document.head || document.documentElement).appendChild(s);
  }

  load(COMMON, function () {
    load(MARKET);
  });
})();