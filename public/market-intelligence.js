/* Strike Pulse — Market page live-data layer
   Only updates elements that already exist on the Market Intelligence page. */
(function () {
  'use strict';

  const API = 'https://strike-pulse-relay.onrender.com/api/market-intelligence';

  const $ = id => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el && value != null) el.textContent = value; };
  const pct = value => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : '—';

  function setMeter(score) {
    const value = Math.max(0, Math.min(100, Number(score) || 50));
    text('spmi-score', String(value));
    text('spmi-final-score', `${value}/100`);
    const pointer = $('spmi-meter-pointer');
    const fill = $('spmi-meter-fill');
    if (pointer) pointer.style.left = `${value}%`;
    if (fill) fill.style.width = `${value}%`;
  }

  function setBias(data) {
    text('spmi-bias', data.bias);
    text('spmi-final-bias', data.bias);
    text('spmi-momentum', data.momentum);
    text('spmi-breadth-state', data.breadth && data.breadth.advances > data.breadth.declines ? 'Healthy' : 'Weak');
    const bias = $('spmi-bias');
    if (bias) {
      bias.style.color = data.bias === 'BULLISH' ? '#16a34a' : data.bias === 'BEARISH' ? '#dc2626' : '#64748b';
      bias.style.background = data.bias === 'BULLISH' ? 'rgba(22,163,74,.09)' : data.bias === 'BEARISH' ? 'rgba(220,38,38,.09)' : 'rgba(100,116,139,.10)';
    }
  }

  function setBreadth(breadth) {
    if (!breadth) return;
    text('spmi-advances', Number(breadth.advances || 0).toLocaleString('en-IN'));
    text('spmi-declines', Number(breadth.declines || 0).toLocaleString('en-IN'));
    text('spmi-unchanged', Number(breadth.unchanged || 0).toLocaleString('en-IN'));

    const total = (breadth.advances || 0) + (breadth.declines || 0) + (breadth.unchanged || 0) || 1;
    const bars = document.querySelectorAll('.spmi-breadth .spmi-progress span');
    if (bars[0]) bars[0].style.width = `${(breadth.advances / total) * 100}%`;
    if (bars[1]) bars[1].style.width = `${(breadth.declines / total) * 100}%`;
    if (bars[2]) bars[2].style.width = `${(breadth.unchanged / total) * 100}%`;
  }

  function setVix(value) {
    if (!Number.isFinite(Number(value))) return;
    const vix = Number(value);
    text('spmi-vix', vix.toFixed(2));
    text('spmi-vix-big', vix.toFixed(2));
    const state = vix >= 20 ? 'HIGH' : vix >= 13 ? 'MODERATE' : 'LOW';
    const badge = document.querySelector('.spmi-vol-badge');
    if (badge) badge.textContent = state;
    text('spmi-vol-state', state.charAt(0) + state.slice(1).toLowerCase());

    const marker = document.querySelector('.spmi-vix-track span');
    if (marker) marker.style.width = `${Math.max(4, Math.min(96, (vix / 35) * 100))}%`;
  }

  function setHeatmap(sectors) {
    if (!Array.isArray(sectors)) return;
    const cards = [...document.querySelectorAll('.spmi-heat')];
    sectors.forEach((sector, index) => {
      const card = cards[index];
      if (!card) return;
      const strong = card.querySelector('strong');
      const status = card.querySelector('span');
      const small = card.querySelector('small');
      if (small) small.textContent = sector.name;
      if (strong) strong.textContent = pct(sector.value);
      if (status) status.textContent = sector.status;

      card.classList.remove('spmi-positive-strong','spmi-positive','spmi-neutral','spmi-negative');
      const value = Number(sector.value);
      if (!Number.isFinite(value)) card.classList.add('spmi-neutral');
      else if (value >= 1) card.classList.add('spmi-positive-strong');
      else if (value > 0.15) card.classList.add('spmi-positive');
      else if (value <= -0.15) card.classList.add('spmi-negative');
      else card.classList.add('spmi-neutral');
    });
  }

  function session() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const h = Number(parts.find(x => x.type === 'hour')?.value || 0);
    const m = Number(parts.find(x => x.type === 'minute')?.value || 0);
    const minutes = h * 60 + m;
    const points = [555, 660, 780, 870, 930];
    document.querySelectorAll('.spmi-time-item').forEach((item, index) => item.classList.toggle('active', minutes >= points[index]));
    const status = $('spmi-session-status');
    if (status) status.textContent = minutes >= 555 && minutes < 930 && h >= 9 && h <= 15 ? 'LIVE SESSION' : 'MARKET CLOSED';
  }

  async function load() {
    try {
      const response = await fetch(`${API}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Market intelligence unavailable');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Market intelligence unavailable');
      setMeter(data.score);
      setBias(data);
      setBreadth(data.breadth);
      setVix(data.vix);
      setHeatmap(data.sectors);
    } catch (error) {
      console.warn('[StrikePulse] Market Intelligence:', error.message);
    }
  }

  function boot() {
    session();
    load();
    setInterval(load, 15000);
    setInterval(session, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
