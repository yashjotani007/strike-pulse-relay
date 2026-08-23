const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

const NSE = "https://www.nseindia.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept": "application/json,text/plain,*/*",
  "Referer": "https://www.nseindia.com/option-chain"
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

let cookies = "";
let cookieAt = 0;
const cache = new Map();
const pending = new Map();

const price = {
  success: true,
  nifty: null,
  niftyChange: null,
  banknifty: null,
  bankniftyChange: null,
  finnifty: null,
  finniftyChange: null,
  vix: null,
  vixChange: null,
  updated: null,
  source: "nse"
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function getCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie()
      .map(x => x.split(";")[0])
      .filter(Boolean)
      .join("; ");
  }

  const x = response.headers.get("set-cookie") || "";
  return x
    ? x.split(/,(?=[^;,=]+=[^;,]+)/)
        .map(v => v.split(";")[0].trim())
        .filter(Boolean)
        .join("; ")
    : "";
}

async function warm(force = false) {
  if (!force && cookies && Date.now() - cookieAt < 240000) return cookies;

  let r = await fetch(NSE + "/", { headers: HEADERS });
  cookies = getCookies(r);

  try {
    r = await fetch(NSE + "/option-chain", {
      headers: { ...HEADERS, Accept: "text/html" }
    });
    const c = getCookies(r);
    if (c) cookies = c;
  } catch (_) {}

  cookieAt = Date.now();
  return cookies;
}

async function nse(path, retry = true) {
  try {
    const c = await warm(false);
    const r = await fetch(NSE + path, {
      headers: {
        ...HEADERS,
        ...(c ? { Cookie: c } : {}),
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    const text = await r.text();

    if ([401, 403, 404].includes(r.status) && retry) {
      cookies = "";
      await warm(true);
      return nse(path, false);
    }

    if (!r.ok) throw Error(`NSE HTTP ${r.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } catch (e) {
    if (retry) {
      cookies = "";
      try {
        await warm(true);
        const r = await fetch(NSE + path, {
          headers: { ...HEADERS, Cookie: cookies, "X-Requested-With": "XMLHttpRequest" }
        });
        const text = await r.text();
        if (r.ok) return JSON.parse(text);
      } catch (_) {}
    }
    throw e;
  }
}

async function updatePrices() {
  try {
    const body = await nse("/api/allIndices");
    const list = body?.data || [];
    const find = name => list.find(v => String(v?.index || "").trim() === name);

    for (const [key, name] of Object.entries({
      nifty: "NIFTY 50",
      banknifty: "NIFTY BANK",
      finnifty: "NIFTY FINANCIAL SERVICES",
      vix: "INDIA VIX"
    })) {
      const item = find(name);
      if (item) {
        price[key] = num(item.last);
        price[key + "Change"] = num(item.percentChange);
      }
    }

    price.updated = new Date().toISOString();
  } catch (e) {
    console.log("price", e.message);
  }
}

/*
 * Normalize NSE option-chain data.
 * Supports both the current records.data format and filtered.data.
 * Every strike gets its own CE/PE object so one contract can never
 * accidentally be reused for another strike.
 */
function normalize(body, expiry) {
  const root = body?.records || body?.data || body || {};
  const data = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(root?.filtered?.data)
      ? root.filtered.data
      : Array.isArray(body?.records?.data)
        ? body.records.data
        : [];

  const map = new Map();

  for (const item of data) {
    if (!item || (expiry && item.expiryDate && item.expiryDate !== expiry)) continue;

    const strike = num(item.strikePrice);
    if (strike === null) continue;

    let row = map.get(strike);
    if (!row) {
      row = { strike, ce: null, pe: null };
      map.set(strike, row);
    }

    if (item.CE) row.ce = { ...item.CE };
    if (item.PE) row.pe = { ...item.PE };
  }

  return {
    spot: num(root?.underlyingValue ?? body?.underlyingValue),
    rows: [...map.values()].sort((a, b) => a.strike - b.strike)
  };
}

function maxPain(rows) {
  let best = null;
  let loss = Infinity;

  for (const candidate of rows) {
    let total = 0;

    for (const row of rows) {
      const ceOI = Number(row.ce?.openInterest || 0);
      const peOI = Number(row.pe?.openInterest || 0);

      if (candidate.strike > row.strike) {
        total += ceOI * (candidate.strike - row.strike);
      }
      if (candidate.strike < row.strike) {
        total += peOI * (row.strike - candidate.strike);
      }
    }

    if (total < loss) {
      loss = total;
      best = candidate.strike;
    }
  }

  return best;
}

async function contractInfo(symbol) {
  const body = await nse(`/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`);
  const root = body?.records || body?.data || body || {};
  return [...new Set(root?.expiryDates || body?.expiryDates || [])];
}

function toRows(source) {
  return source.map(x => ({
    strike: x.strike,
    ce: {
      ltp: num(x.ce?.lastPrice),
      change: num(x.ce?.change),
      oi: num(x.ce?.openInterest),
      oiChange: num(x.ce?.changeinOpenInterest),
      volume: num(x.ce?.totalTradedVolume),
      iv: num(x.ce?.impliedVolatility),
      bid: num(x.ce?.bidprice),
      ask: num(x.ce?.askPrice)
    },
    pe: {
      ltp: num(x.pe?.lastPrice),
      change: num(x.pe?.change),
      oi: num(x.pe?.openInterest),
      oiChange: num(x.pe?.changeinOpenInterest),
      volume: num(x.pe?.totalTradedVolume),
      iv: num(x.pe?.impliedVolatility),
      bid: num(x.pe?.bidprice),
      ask: num(x.pe?.askPrice)
    }
  }));
}

async function loadChain(symbol, expiry, full = true) {
  symbol = String(symbol || "NIFTY").toUpperCase();

  let expiries = [];
  try {
    expiries = await contractInfo(symbol);
  } catch (e) {
    console.log("expiry", symbol, e.message);
  }

  const exp = expiry || expiries[0] || null;
  const type = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"].includes(symbol)
    ? "Indices"
    : "Equity";

  const paths = [];

  /* Prefer NSE's standard option-chain endpoint first. */
  const standard = `/api/option-chain-${type === "Indices" ? "indices" : "equities"}?symbol=${encodeURIComponent(symbol)}`;
  if (exp) paths.push(standard + `&expiry=${encodeURIComponent(exp)}`);
  paths.push(standard);

  /* Keep V3 as fallback. */
  const v3 = `/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(symbol)}`;
  if (exp) paths.push(v3 + `&expiry=${encodeURIComponent(exp)}`);
  paths.push(v3);

  let lastError;

  for (const path of paths) {
    try {
      const body = await nse(path);
      const normalized = normalize(body, exp);

      if (!normalized.rows.length) throw Error("No option rows");

      const spot = normalized.spot || (symbol === "NIFTY" ? price.nifty : null);
      if (!spot) throw Error("Spot unavailable");

      let atmIndex = 0;
      let distance = Infinity;

      normalized.rows.forEach((row, i) => {
        const d = Math.abs(row.strike - spot);
        if (d < distance) {
          distance = d;
          atmIndex = i;
        }
      });

      /* Home endpoint gets 11 strikes around ATM; full endpoint gets all. */
      const source = full
        ? normalized.rows
        : normalized.rows.slice(Math.max(0, atmIndex - 5), atmIndex + 6);

      const rows = toRows(source);

      const callOI = rows.reduce((sum, row) => sum + (row.ce.oi || 0), 0);
      const putOI = rows.reduce((sum, row) => sum + (row.pe.oi || 0), 0);

      return {
        success: true,
        source: "nse",
        symbol,
        spot,
        expiry: exp,
        expiries,
        atm: normalized.rows[atmIndex].strike,
        atmStrike: normalized.rows[atmIndex].strike,
        callOI,
        putOI,
        callOIChange: rows.reduce((sum, row) => sum + (row.ce.oiChange || 0), 0),
        putOIChange: rows.reduce((sum, row) => sum + (row.pe.oiChange || 0), 0),
        pcr: callOI ? putOI / callOI : null,
        maxPain: maxPain(normalized.rows),
        totalStrikes: normalized.rows.length,
        rows,
        updated: new Date().toISOString()
      };
    } catch (e) {
      lastError = e;
      console.log("option", symbol, e.message);
    }
  }

  throw lastError || Error("Option chain unavailable");
}

const POPULAR = [
  "RELIANCE","HDFCBANK","ICICIBANK","SBIN","INFY","TCS","BHARTIARTL","ITC","LT","AXISBANK",
  "KOTAKBANK","M&M","BAJFINANCE","HINDUNILVR","MARUTI","SUNPHARMA","ADANIENT","ADANIPORTS",
  "NTPC","POWERGRID","TATAMOTORS","TATASTEEL","JSWSTEEL","HCLTECH","WIPRO","TECHM","COALINDIA",
  "ONGC","BEL","TRENT","ETERNAL","INDUSINDBK","BANKBARODA","PNB","CANBK","RECLTD","PFC","IRFC",
  "HAL","DLF","VBL","PIDILITIND","ASIANPAINT","ULTRACEMCO","GRASIM","NESTLEIND","TITAN","BAJAJFINSV",
  "BAJAJ-AUTO","EICHERMOT","HEROMOTOCO","TVSMOTOR","DRREDDY","CIPLA","APOLLOHOSP","DIVISLAB","BPCL",
  "IOC","GAIL","VEDL","HINDALCO","JINDALSTEL","SAIL","TATAPOWER","AMBUJACEM","ACC","ABB","SIEMENS",
  "INDIGO","IRCTC","LICI","HDFCLIFE","SBILIFE","MOTHERSON","DABUR","COLPAL","GODREJCP","ICICIPRULI",
  "CHOLAFIN","SHRIRAMFIN","OFSS","PERSISTENT","COFORGE","MPHASIS","LTIM","BHEL","NHPC","IEX","IDEA","YESBANK"
];

app.get("/", (req, res) => {
  res.json({ success: true, message: "Strike Pulse Relay is running", source: "nse", lastUpdate: price.updated });
});

app.get("/api/prices", async (req, res) => {
  if (!price.nifty) await updatePrices();
  res.json({ ...price, data: price });
});

app.get("/api/option-symbols", (req, res) => {
  const q = String(req.query.q || "").toUpperCase().trim();
  res.json({ success: true, symbols: POPULAR.filter(x => !q || x.includes(q)).slice(0, 40) });
});

app.get("/api/option-expiries", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "NIFTY").toUpperCase();
    res.json({ success: true, symbol, expiries: await contractInfo(symbol) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/option-chain", async (req, res) => {
  const symbol = String(req.query.symbol || "NIFTY").toUpperCase();
  const expiry = req.query.expiry ? String(req.query.expiry) : null;
  const full = String(req.query.full ?? "true") !== "false";
  const key = `${symbol}|${expiry || "AUTO"}|${full}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 5000) return res.json(cached.data);

  if (pending.has(key)) {
    try {
      return res.json(await pending.get(key));
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  const promise = Promise.race([
    loadChain(symbol, expiry, full),
    new Promise((_, reject) => setTimeout(() => reject(Error("Option chain upstream timeout")), 25000))
  ]);

  pending.set(key, promise);

  try {
    const data = await promise;
    cache.set(key, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    pending.delete(key);
  }
});

/* Home uses only the 11 strikes around ATM. */
app.get("/api/nifty-option-chain", async (req, res) => {
  try {
    const data = await loadChain("NIFTY", req.query.expiry ? String(req.query.expiry) : null, false);
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

updatePrices();
setInterval(updatePrices, 15000);

app.listen(PORT, "0.0.0.0", () => {
  console.log("Strike Pulse Relay running on " + PORT);
});
