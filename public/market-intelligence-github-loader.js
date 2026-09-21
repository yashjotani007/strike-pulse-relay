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

      var istText = now.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
      });

      var ist = new Date(istText);
      var minutes = ist.getHours() * 60 + ist.getMinutes();

      var points = [
        9 * 60 + 15,
        11 * 60,
        13 * 60,
        14 * 60 + 30,
        15 * 60 + 30
      ];

      var items = document.querySelectorAll('.spmi-time-item');

      items.forEach(function (item, index) {
        if (minutes >= points[index]) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
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