(() => {
  'use strict';

  const API = 'https://strike-pulse-relay.onrender.com/api/market-intelligence';
  const REFRESH_MS = 15000;
  let timer = null;
  let busy = false;

  const $ = id => document.getElementById(id);
  const text = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '—';
  };
  const cls = (el, name) => {
    if (!el) return;
    el.classList.remove('spmi-up', 'spmi-down', 'spmi-neutral');
    if (name) el.classList.add(name);
  };
  const n = v => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const fmt = (v, digits = 2) => {
    const x = n(v);
    return x == null ? '—' : x.toLocaleString('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  };
  const pct = v => {
    const x = n(v);
    return x == null ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
  };
  const direction = v => {
    const x = n(v);
    return x == null ? 'NEUTRAL' : x > 0.05 ? 'UP' : x < -0.05 ? 'DOWN' : 'FLAT';
  };
  const changeClass = v => {
    const x = n(v);
    return x == null || Math.abs(x) <= 0.05 ? 'spmi-neutral' : x > 0 ? 'spmi-up' : 'spmi-down';
  };

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      timeZone: 'Asia/Kolkata'
    });
    const date = now.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    });
    text('spmi-clock', time);
    text('spmi-date', date + ' • IST');
  }

  function setMarketStatus(market) {
    const session = String(market?.session || 'CLOSED').toUpperCase();
    text('spmi-market-status', session === 'LIVE' ? 'MARKET LIVE' : session);
    const dot = document.querySelector('.spmi-status-dot');
    if (dot) dot.classList.toggle('spmi-status-live', session === 'LIVE');
  }

  function setIndex(key, data) {
    const price = n(data?.price);
    const change = n(data?.change);
    text('spmi-' + key, fmt(price));
    text('spmi-' + key + '-change', pct(change));
    text('spmi-' + key + '-state', direction(change));

    const changeEl = $('spmi-' + key + '-change');
    const stateEl = $('spmi-' + key + '-state');
    cls(changeEl, changeClass(change));
    cls(stateEl, changeClass(change));

    const line = $('spmi-' + key + '-line');
    if (line) {
      line.style.width = Math.min(100, Math.max(12, 50 + (change || 0) * 18)) + '%';
      cls(line, changeClass(change));
    }
  }

  function setBreadth(b) {
    const advances = n(b?.advances) || 0;
    const declines = n(b?.declines) || 0;
    const unchanged = n(b?.unchanged) || 0;
    const total = advances + declines + unchanged;
    const ad = declines ? advances / declines : advances ? advances : 0;

    text('spmi-advances', advances.toLocaleString('en-IN'));
    text('spmi-declines', declines.toLocaleString('en-IN'));
    text('spmi-unchanged', unchanged.toLocaleString('en-IN'));
    text('spmi-ad-ratio', total ? ad.toFixed(2) : '—');
    text('spmi-advance-pct', total ? (advances / total * 100).toFixed(1) + '%' : '—');
    text('spmi-decline-pct', total ? (declines / total * 100).toFixed(1) + '%' : '—');

    const setBar = (id, value) => {
      const el = $(id);
      if (el) el.style.width = total ? (value / total * 100) + '%' : '0%';
    };
    setBar('spmi-advances-bar', advances);
    setBar('spmi-declines-bar', declines);
    setBar('spmi-unchanged-bar', unchanged);

    const state = advances > declines * 1.15 ? 'POSITIVE' :
      declines > advances * 1.15 ? 'NEGATIVE' : 'BALANCED';
    text('spmi-breadth-state', state);
    return { advances, declines, unchanged, total, state };
  }

  function setVix(vix) {
    const value = n(vix?.price);
    const change = n(vix?.change);
    const condition = value == null ? '—' : value < 12 ? 'LOW' : value < 20 ? 'MODERATE' : 'HIGH';
    const dir = direction(change);

    text('spmi-vix', fmt(value));
    text('spmi-vix-big', fmt(value));
    text('spmi-vix-change', pct(change));
    text('spmi-vix-change-big', pct(change));
    text('spmi-vix-state', dir);
    text('spmi-vix-badge', condition);
    text('spmi-vix-condition', condition);
    text('spmi-vix-direction', dir);

    const fill = $('spmi-vix-gauge-fill');
    if (fill && value != null) fill.style.width = Math.min(100, Math.max(5, value / 30 * 100)) + '%';

    cls($('spmi-vix-change'), changeClass(change));
    cls($('spmi-vix-change-big'), changeClass(change));
    cls($('spmi-vix-state'), changeClass(change));
    return { value, change, condition, dir };
  }

  function setRegime(regime, breadthState, vix) {
    const rawScore = n(regime?.score);
    const score100 = rawScore == null ? 50 : Math.min(100, Math.max(0, 50 + rawScore / 2));
    const label = String(regime?.label || 'MIXED').toUpperCase();
    const avg = n(regime?.averageChange);

    text('spmi-regime', label);
    text('spmi-score', Math.round(score100));
    text('spmi-momentum', avg == null ? '—' : avg > 0.25 ? 'Positive' : avg < -0.25 ? 'Negative' : 'Neutral');

    const fill = $('spmi-meter-fill');
    const pointer = $('spmi-meter-pointer');
    if (fill) fill.style.width = score100 + '%';
    if (pointer) pointer.style.left = score100 + '%';

    text('spmi-breadth-state', breadthState || 'Balanced');
    text('spmi-vol-state', vix?.condition || 'Moderate');

    return { score100, label };
  }

  function setPressure(breadth, regime) {
    let score = 50;
    if (breadth?.total) {
      score = (breadth.advances / breadth.total) * 100;
    } else if (n(regime?.score) != null) {
      score = 50 + n(regime.score) / 2;
    }
    score = Math.min(100, Math.max(0, score));

    const state = score >= 60 ? 'BUYING' : score <= 40 ? 'SELLING' : 'BALANCED';
    text('spmi-pressure-score', Math.round(score));
    text('spmi-pressure-state', state);
    text(
      'spmi-pressure-note',
      state === 'BUYING' ? 'Buying participation is currently stronger.' :
      state === 'SELLING' ? 'Selling participation is currently stronger.' :
      'Market participation is currently balanced.'
    );

    const fill = $('spmi-pressure-fill');
    const dot = $('spmi-pressure-dot');
    if (fill) fill.style.width = score + '%';
    if (dot) dot.style.left = score + '%';
    return { score, state };
  }

  function setSignals(indices, breadth, vix, regime) {
    const changes = Object.values(indices || {})
      .map(x => n(x?.change))
      .filter(x => x != null);
    const best = changes.length ? Math.max(...changes) : null;
    const worst = changes.length ? Math.min(...changes) : null;

    const trend = n(regime?.score) > 20 ? 'BULLISH' : n(regime?.score) < -20 ? 'BEARISH' : 'MIXED';
    const participation = breadth?.state || 'BALANCED';
    const volatility = vix?.condition || 'MODERATE';
    const overall = String(regime?.label || 'MIXED').toUpperCase();

    text('spmi-signal-trend', trend);
    text('spmi-signal-participation', participation);
    text('spmi-signal-volatility', volatility);
    text('spmi-signal-overall', overall);

    const entries = [
      ['NIFTY 50', n(indices?.nifty?.change)],
      ['BANK NIFTY', n(indices?.banknifty?.change)],
      ['FIN NIFTY', n(indices?.finnifty?.change)],
      ['SENSEX', n(indices?.sensex?.change)]
    ].filter(x => x[1] != null);

    if (entries.length) {
      const strongest = entries.reduce((a, b) => b[1] > a[1] ? b : a);
      const weakest = entries.reduce((a, b) => b[1] < a[1] ? b : a);
      text('spmi-best-index', strongest[0] + ' ' + pct(strongest[1]));
      text('spmi-weakest-index', weakest[0] + ' ' + pct(weakest[1]));
    }

    // Sector API is not currently returned by /api/market-intelligence.
    // Keep these fields honest instead of inventing sector data.
    text('spmi-top-sector', 'Index-led');
    text('spmi-bottom-sector', 'Sector data unavailable');
    return { best, worst };
  }

  function setStory(data, regime, breadth, vix) {
    if (data?.signals?.length) {
      text('spmi-story', data.signals.join(' • ') + '.');
      return;
    }

    const label = regime?.label || 'MIXED';
    const breadthText = breadth?.state === 'POSITIVE' ? 'breadth is positive' :
      breadth?.state === 'NEGATIVE' ? 'breadth is negative' : 'breadth is balanced';
    const volText = vix?.condition ? 'volatility is ' + vix.condition.toLowerCase() : 'volatility is unavailable';
    text('spmi-story', 'Market regime is ' + label.toLowerCase() + ', ' + breadthText + ', and ' + volText + '.');
  }

  async function load() {
    if (busy || document.hidden) return;
    busy = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(API + '?t=' + Date.now(), {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Market Intelligence API error');

      const indices = data.indices || data.data?.indices || {};
      const regime = data.regime || {};
      const breadth = setBreadth(data.breadth || {});
      const vix = setVix(indices.vix || {});
      const finalRegime = setRegime(regime, breadth.state, vix);
      setPressure(breadth, regime);
      setSignals(indices, breadth, vix, regime);

      setIndex('nifty', indices.nifty || {});
      setIndex('banknifty', indices.banknifty || {});
      setIndex('finnifty', indices.finnifty || {});
      setIndex('sensex', indices.sensex || {});

      setMarketStatus(data.market);
      text('spmi-updated', data.generatedAt ? 'Updated ' + new Date(data.generatedAt).toLocaleTimeString('en-IN') : 'Updated just now');

      const finalBias =
        finalRegime.label === 'BULLISH' ? 'BULLISH' :
        finalRegime.label === 'BEARISH' ? 'BEARISH' : 'MIXED';

      text('spmi-final-bias', finalBias);
      text('spmi-final-score', Math.round(finalRegime.score100) + '/100');
      text('spmi-final-momentum',
        n(regime.averageChange) == null ? '—' :
        (n(regime.averageChange) > 0 ? 'Positive' : n(regime.averageChange) < 0 ? 'Negative' : 'Neutral')
      );
      text('spmi-final-volatility', vix.condition || '—');

      setStory(data, regime, breadth, vix);
      document.documentElement.dataset.spMiReady = '1';
      console.log('[STRIKE PULSE] Market Intelligence live data updated', data);
    } catch (err) {
      console.error('[STRIKE PULSE] Market Intelligence error:', err);
      text('spmi-market-status', 'DATA ERROR');
      text('spmi-updated', 'API unavailable');
    } finally {
      busy = false;
    }
  }

  function timeline() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const mins = now.getHours() * 60 + now.getMinutes();
    document.querySelectorAll('.spmi-time-item').forEach(item => {
      const t = Number(item.dataset.time);
      item.classList.toggle('active', mins >= t);
    });
  }

  function init() {
    updateClock();
    timeline();
    load();

    setInterval(updateClock, 1000);
    setInterval(timeline, 30000);
    timer = setInterval(load, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();