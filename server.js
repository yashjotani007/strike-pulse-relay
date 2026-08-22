const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;
const NSE_BASE = "https://www.nseindia.com";
const JINA_BASE = "https://r.jina.ai/";
const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const liveData = {
  success: true,
  nifty: null, niftyChange: null,
  banknifty: null, bankniftyChange: null,
  finnifty: null, finniftyChange: null,
  vix: null, vixChange: null,
  updated: null,
  source: "none"
};

let nseCookies = "";
let nseCookieTime = 0;
let optionBusy = false;
let optionCache = null;
let optionCacheTime = 0;

function cookieHeader(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie()
      .map(x => x.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  }
  const raw = response.headers.get("set-cookie") || "";
  if (!raw) return "";
  return raw.split(/,(?=[^;,=]+=[^;,]+)/)
    .map(x => x.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function getNSECookies(force = false) {
  if (!force && nseCookies && Date.now() - nseCookieTime < 5 * 60 * 1000) return nseCookies;
  const home = await fetch(`${NSE_BASE}/`, { headers: NSE_HEADERS, redirect: "follow" });
  const first = cookieHeader(home);
  let cookies = first;
  try {
    const page = await fetch(`${NSE_BASE}/option-chain?symbol=NIFTY`, {
      headers: { ...NSE_HEADERS, Accept: "text/html,application/xhtml+xml", Referer: `${NSE_BASE}/` },
      redirect: "follow"
    });
    const second = cookieHeader(page);
    if (second) {
      const map = new Map();
      for (const item of `${first}; ${second}`.split(";")) {
        const i = item.indexOf("=");
        if (i > 0) map.set(item.slice(0, i).trim(), item.slice(i + 1).trim());
      }
      cookies = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
  } catch (e) {
    console.log("[NSE] cookie warmup:", e?.message || e);
  }
  nseCookies = cookies;
  nseCookieTime = Date.now();
  return cookies;
}

function parseJsonFromText(text) {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch (_) {}
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch (_) {}
  }
  throw new Error(`Invalid JSON: ${raw.slice(0, 160)}`);
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function proxyJson(path) {
  const target = `${NSE_BASE}${path}`;
  const encoded = encodeURIComponent(target);
  const attempts = [
    {
      name: "allorigins",
      url: `https://api.allorigins.win/raw?url=${encoded}`,
      headers: { Accept: "application/json, text/plain, */*" }
    },
    {
      name: "corsproxy",
      url: `https://corsproxy.io/?url=${encoded}`,
      headers: { Accept: "application/json, text/plain, */*" }
    },
    {
      name: "codetabs",
      url: `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
      headers: { Accept: "application/json, text/plain, */*" }
    },
    {
      name: "jina",
      url: `${JINA_BASE}${target}`,
      headers: { Accept: "text/plain", "X-No-Cache": "true", "X-Engine": "curl" }
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      console.log(`[NSE] trying ${attempt.name} proxy for ${path}`);
      const text = await fetchText(attempt.url, attempt.headers);
      try {
        const wrapper = JSON.parse(text);
        if (wrapper && typeof wrapper.content === "string") {
          const parsed = parseJsonFromText(wrapper.content);
          console.log(`[NSE] ${attempt.name} proxy succeeded`);
          return parsed;
        }
        if (wrapper && (wrapper.records || wrapper.data || wrapper.filtered || wrapper.optionChain)) {
          console.log(`[NSE] ${attempt.name} proxy succeeded`);
          return wrapper;
        }
      } catch (_) {}
      const parsed = parseJsonFromText(text);
      console.log(`[NSE] ${attempt.name} proxy succeeded`);
      return parsed;
    } catch (e) {
      lastError = e;
      console.log(`[NSE] ${attempt.name} proxy failed:`, e?.message || e);
    }
  }
  throw new Error(`All NSE proxy fallbacks failed: ${lastError?.message || "unknown error"}`);
}

async function nseJson(path, retry = true) {
  try {
    const cookies = await getNSECookies(false);
    const response = await fetch(`${NSE_BASE}${path}`, {
      headers: {
        ...NSE_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: `${NSE_BASE}/option-chain`,
        ...(cookies ? { Cookie: cookies } : {})
      },
      redirect: "follow"
    });

    if ([401, 403, 404].includes(response.status) && retry) {
      nseCookies = "";
      await getNSECookies(true);
      return nseJson(path, false);
    }

    const text = await response.text();
    if (!response.ok) throw new Error(`NSE HTTP ${response.status}: ${text.slice(0, 120)}`);
    return parseJsonFromText(text);
  } catch (directError) {
    console.log(`[NSE] direct failed for ${path}:`, directError?.message || directError);
    return proxyJson(path);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function updatePrice(market, price, change) {
  const p = num(price);
  if (!p || p <= 0) return;
  liveData[market] = p;
  liveData[`${market}Change`] = num(change);
  liveData.updated = new Date().toISOString();
  liveData.source = "nse";
}

async function updatePrices() {
  try {
    const body = await nseJson("/api/allIndices");
    const indices = Array.isArray(body?.data) ? body.data : [];
    const find = (...names) => indices.find(x => names.includes(String(x?.index || "").trim()));
    const values = {
      nifty: find("NIFTY 50"),
      banknifty: find("NIFTY BANK"),
      finnifty: find("NIFTY FINANCIAL SERVICES"),
      vix: find("INDIA VIX")
    };
    for (const [market, item] of Object.entries(values)) {
      if (item) updatePrice(market, item.last, item.percentChange);
    }
    console.log("[NSE] prices updated", liveData.nifty, liveData.banknifty, liveData.finnifty, liveData.vix);
  } catch (error) {
    console.error("[NSE] price error:", error?.message || error);
  }
}

app.get("/", (req, res) => res.json({
  success: true,
  message: "Strike Pulse Relay is running",
  source: liveData.source,
  lastUpdate: liveData.updated
}));

app.get("/api/prices", async (req, res) => {
  if (!liveData.nifty) await updatePrices();
  res.json({
    success: true,
    nifty: liveData.nifty, niftyChange: liveData.niftyChange,
    banknifty: liveData.banknifty, bankniftyChange: liveData.bankniftyChange,
    finnifty: liveData.finnifty, finniftyChange: liveData.finniftyChange,
    vix: liveData.vix, vixChange: liveData.vixChange,
    updated: liveData.updated, source: liveData.source,
    data: {
      nifty: liveData.nifty, niftyChange: liveData.niftyChange,
      banknifty: liveData.banknifty, bankniftyChange: liveData.bankniftyChange,
      finnifty: liveData.finnifty, finniftyChange: liveData.finniftyChange,
      vix: liveData.vix, vixChange: liveData.vixChange, updated: liveData.updated
    }
  });
});

function normalize(records) {
  const data = Array.isArray(records?.data) ? records.data : [];
  const expiries = Array.isArray(records?.expiryDates) ? records.expiryDates : [];
  const expiry = expiries[0];
  const current = data.filter(x => !expiry || x?.expiryDate === expiry);
  const map = new Map();

  for (const item of current) {
    const strike = num(item?.strikePrice);
    if (strike === null) continue;
    if (!map.has(strike)) map.set(strike, { strike, ce: null, pe: null });
    if (item.CE) map.get(strike).ce = item.CE;
    if (item.PE) map.get(strike).pe = item.PE;
  }

  return {
    expiry,
    underlying: num(records?.underlyingValue),
    rows: [...map.values()].sort((a, b) => a.strike - b.strike)
  };
}

function buildOptionResponse(body) {
  const normalized = normalize(body?.records || body?.filtered || body);
  if (!normalized.rows.length) throw new Error("NIFTY option chain data not available");

  const spot = normalized.underlying || liveData.nifty;
  if (!Number.isFinite(spot)) throw new Error("NIFTY price not available");

  let atm = 0;
  let distance = Infinity;
  normalized.rows.forEach((row, i) => {
    const d = Math.abs(row.strike - spot);
    if (d < distance) { distance = d; atm = i; }
  });

  const rows = normalized.rows.slice(Math.max(0, atm - 5), atm + 6).map(row => ({
    strike: row.strike,
    ce: {
      symbol: row.ce?.identifier || null,
      ltp: num(row.ce?.lastPrice),
      oi: num(row.ce?.openInterest),
      oiChange: num(row.ce?.changeinOpenInterest),
      volume: num(row.ce?.totalTradedVolume)
    },
    pe: {
      symbol: row.pe?.identifier || null,
      ltp: num(row.pe?.lastPrice),
      oi: num(row.pe?.openInterest),
      oiChange: num(row.pe?.changeinOpenInterest),
      volume: num(row.pe?.totalTradedVolume)
    }
  }));

  const callOI = rows.reduce((s, r) => s + (r.ce.oi || 0), 0);
  const putOI = rows.reduce((s, r) => s + (r.pe.oi || 0), 0);
  const callOIChange = rows.reduce((s, r) => s + (r.ce.oiChange || 0), 0);
  const putOIChange = rows.reduce((s, r) => s + (r.pe.oiChange || 0), 0);

  return {
    success: true,
    source: "nse",
    spot,
    expiry: normalized.expiry,
    atmStrike: normalized.rows[atm]?.strike ?? null,
    callOI, putOI, callOIChange, putOIChange,
    pcr: callOI > 0 ? putOI / callOI : null,
    rows,
    updated: new Date().toISOString()
  };
}

app.get("/api/nifty-option-chain", async (req, res) => {
  if (optionCache && Date.now() - optionCacheTime < 12000) {
    return res.json(optionCache);
  }
  if (optionBusy) {
    if (optionCache) return res.json(optionCache);
    return res.status(429).json({ success: false, error: "Option chain request already running" });
  }

  optionBusy = true;
  try {
    let body;
    try {
      body = await nseJson("/api/option-chain-v3?type=Indices&symbol=NIFTY");
    } catch (firstError) {
      console.log("[NSE] v3 option endpoint failed, trying legacy:", firstError?.message || firstError);
      body = await nseJson("/api/option-chain-indices?symbol=NIFTY");
    }

    const result = buildOptionResponse(body);
    optionCache = result;
    optionCacheTime = Date.now();
    res.json(result);
  } catch (error) {
    console.error("[Option Chain] Error:", error?.message || error);
    res.status(500).json({ success: false, error: error?.message || String(error) });
  } finally {
    optionBusy = false;
  }
});

updatePrices();
setInterval(updatePrices, 15000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Strike Pulse Relay running on port ${PORT}`);
  console.log("[NSE] Prices + option chain enabled. Broker credentials are not required.");
});