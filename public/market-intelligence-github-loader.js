// Market loader v20260924-r3
(() => {
  'use strict';

  // Separate guard so an older WordPress-cached loader cannot block this version.
  if (window.__SP_MARKET_LOADER_20260924_R3__) return;
  window.__SP_MARKET_LOADER_20260924_R3__ = true;

  const API = 'https://strike-pulse-relay.onrender.com/api/market-intelligence';
  window.__SP_MI_RENDER_CONTROLLER__ = true;
  document.documentElement.dataset.spMiReady = '1';

  const $ = id => document.getElementById(id);
  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? '—' : value;
  };
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const price = v => {
    const x = num(v);
    return x == null ? '—' : x.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
  };
  const change = v => {
    const x = num(v);
    return x == null ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
  };

  function clock() {
    const now = new Date();
    set('spmi-clock', now.toLocaleTimeString('en-IN', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}));
    set('spmi-date', now.toLocaleDateString('en-IN', {timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric'}));
  }

  function render(data) {
    const i = data.indices || {}, regime = data.regime || {}, vix = i.vix || {};
    set('spmi-market-status', String(data.market?.session || 'CLOSED').toUpperCase());
    set('spmi-nifty', price(i.nifty?.price)); set('spmi-nifty-change', change(i.nifty?.change)); set('spmi-nifty-state', i.nifty?.direction || 'NEUTRAL');
    set('spmi-banknifty', price(i.banknifty?.price)); set('spmi-banknifty-change', change(i.banknifty?.change)); set('spmi-banknifty-state', i.banknifty?.direction || 'NEUTRAL');
    set('spmi-finnifty', price(i.finnifty?.price)); set('spmi-finnifty-change', change(i.finnifty?.change)); set('spmi-finnifty-state', i.finnifty?.direction || 'NEUTRAL');
    set('spmi-sensex', price(i.sensex?.price)); set('spmi-sensex-change', change(i.sensex?.change)); set('spmi-sensex-state', i.sensex?.direction || 'NEUTRAL');
    set('spmi-vix', price(vix.price)); set('spmi-vix-large', price(vix.price)); set('spmi-vix-change', change(vix.change));
    set('spmi-vix-condition', num(vix.price) == null ? 'Loading…' : vix.price < 12 ? 'LOW' : vix.price < 20 ? 'NORMAL' : 'HIGH');

    const raw = num(regime.score), score = raw == null ? null : Math.round(Math.max(0, Math.min(100, 50 + raw / 2)));
    set('spmi-regime-score', score); set('spmi-regime-label', regime.label || 'MIXED');

    const b = data.breadth;
    set('spmi-advances', b && num(b.advances) != null ? Number(b.advances).toLocaleString('en-IN') : 'N/A');
    set('spmi-declines', b && num(b.declines) != null ? Number(b.declines).toLocaleString('en-IN') : 'N/A');
    set('spmi-ad-ratio', b && num(b.advances) != null && num(b.declines) != null ? (num(b.declines) > 0 ? (num(b.advances) / num(b.declines)).toFixed(2) : '∞') : 'N/A');

    const drivers = i.drivers || data.drivers || {};
    set('spmi-driver-strongest', drivers.strongest?.name || drivers.strongest || 'N/A');
    set('spmi-driver-weakest', drivers.weakest?.name || drivers.weakest || 'N/A');

    const sectors = i.sectors || data.sectors || {};
    const vals = Object.values(sectors).map(x => num(x?.change)).filter(x => x != null);
    const avg = vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : null;
    set('spmi-pressure', avg == null ? 'N/A' : avg > .25 ? 'BUYING' : avg < -.25 ? 'SELLING' : 'BALANCED');

    const label = String(regime.label || 'MIXED').toUpperCase();
    set('spmi-final-bias', label); set('spmi-final-score', score);
    set('spmi-final-message', 'Market regime is ' + label.toLowerCase() + '; ' + (b ? 'breadth data available' : 'breadth data unavailable') + ', ' + (num(vix.price) == null ? 'VIX unavailable' : 'India VIX ' + price(vix.price)) + '.');
    console.log('[STRIKE PULSE] LIVE MARKET DATA UPDATED', data);
  }

  async function load() {
    try {
      const response = await fetch(API + '?t=' + Date.now(), {cache:'no-store'});
      if (!response.ok) throw new Error('API HTTP ' + response.status);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API success=false');
      render(data);
    } catch (e) {
      console.error('[STRIKE PULSE] MARKET API ERROR:', e);
      set('spmi-market-status', 'DATA ERROR');
      set('spmi-final-message', 'Live data error: ' + e.message);
    }
  }

  function init() {
    // WordPress can execute this loader before the Market HTML exists.
    // Wait until the DOM is parsed, then render immediately and refresh every 15s.
    clock();
    load();
    setInterval(clock, 1000);
    setInterval(load, 15000);
    console.log('[StrikePulse] MARKET LOADER READY v20260924-r3');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
