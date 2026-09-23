(function () {
  'use strict';

  if (window.__SP_GITHUB_MARKET_LOADER__) return;
  window.__SP_GITHUB_MARKET_LOADER__ = true;

  // Source remains GitHub. jsDelivr only serves the GitHub files to the browser.
  var BASE = 'https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  var COMMON = BASE + 'strike-pulse.js?v=20260921';
  var MARKET = BASE + 'market-intelligence-page.js?v=20260923';

  function load(src, done) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () {
      console.log('[StrikePulse] GitHub CDN loaded:', src);
      if (done) done();
    };
    s.onerror = function (e) {
      console.error('[StrikePulse] GitHub CDN script failed:', src, e);
      if (done) done();
    };
    (document.head || document.documentElement).appendChild(s);
  }

  function startClockAndTimeline() {
    function updateClock() {
      var now = new Date();

      var time = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      var date = now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      var clock = document.getElementById('spmi-clock');
      var dateBox = document.getElementById('spmi-date');

      if (clock) clock.textContent = time;
      if (dateBox) dateBox.textContent = date;
    }

    function updateTimeline() {
      var now = new Date();
      var istText = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      var ist = new Date(istText);
      var minutes = ist.getHours() * 60 + ist.getMinutes();

      var points = [555, 660, 780, 870, 930];
      var items = document.querySelectorAll('.spmi-time-item');

      items.forEach(function (item, index) {
        item.classList.toggle('active', minutes >= points[index]);
      });
    }

    updateClock();
    updateTimeline();
    setInterval(updateClock, 1000);
    setInterval(updateTimeline, 30000);
  }

  load(COMMON, function () {
    load(MARKET, function () {
      startClockAndTimeline();
    });
  });
})();