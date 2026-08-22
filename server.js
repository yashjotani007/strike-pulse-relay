const express = require("express");
const crypto = require("crypto");
const { SmartAPI, WebSocketV2 } = require("smartapi-javascript");

const app = express();
const PORT = process.env.PORT || 10000;

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

const API_KEY = process.env.ANGEL_API_KEY;
const CLIENT_CODE = process.env.ANGEL_CLIENT_CODE;
const PIN = process.env.ANGEL_PIN;
const TOTP_SECRET = process.env.ANGEL_TOTP_SECRET;

const TOKENS = {
    nifty: "99926000",
    banknifty: "99926009",
    finnifty: "99926037",
    vix: "99926017"
};

const TOKEN_TO_MARKET = Object.fromEntries(
    Object.entries(TOKENS).map(([market, token]) => [token, market])
);

const liveData = {
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
    source: "none",
    websocket: false
};

const previous = {
    nifty: null,
    banknifty: null,
    finnifty: null,
    vix: null
};

let websocket = null;
let smartApi = null;
let reconnectTimer = null;
let loginInProgress = false;
let restTimer = null;
let nseTimer = null;

function generateTOTP(secret) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = String(secret || "").replace(/\s/g, "").replace(/=+$/g, "").toUpperCase();
    if (!clean) throw new Error("ANGEL_TOTP_SECRET is empty");

    let bits = "";
    for (const char of clean) {
        const index = alphabet.indexOf(char);
        if (index < 0) throw new Error("Invalid ANGEL_TOTP_SECRET");
        bits += index.toString(2).padStart(5, "0");
    }

    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac("sha1", Buffer.from(bytes)).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % 1000000;

    return String(code).padStart(6, "0");
}

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Strike Pulse Relay is running",
        source: liveData.source,
        websocket: liveData.websocket,
        lastUpdate: liveData.updated
    });
});

app.get("/api/prices", (req, res) => {
    res.json({
        success: true,
        nifty: liveData.nifty,
        niftyChange: liveData.niftyChange,
        banknifty: liveData.banknifty,
        bankniftyChange: liveData.bankniftyChange,
        finnifty: liveData.finnifty,
        finniftyChange: liveData.finniftyChange,
        vix: liveData.vix,
        vixChange: liveData.vixChange,
        updated: liveData.updated,
        source: liveData.source,
        websocket: liveData.websocket,
        data: {
            nifty: liveData.nifty,
            niftyChange: liveData.niftyChange,
            banknifty: liveData.banknifty,
            bankniftyChange: liveData.bankniftyChange,
            finnifty: liveData.finnifty,
            finniftyChange: liveData.finniftyChange,
            vix: liveData.vix,
            vixChange: liveData.vixChange,
            updated: liveData.updated
        }
    });
});

function updatePrice(market, price, source, changeOverride = null) {
    if (!Number.isFinite(price) || price <= 0) return;

    const old = previous[market];
    let change = changeOverride;

    if (change === null && Number.isFinite(old) && old !== 0) {
        change = ((price - old) / old) * 100;
    }

    previous[market] = price;
    liveData[market] = price;
    liveData[`${market}Change`] = Number.isFinite(change) ? change : null;
    liveData.updated = new Date().toISOString();
    liveData.source = source;

    console.log(`[${source}] ${market.toUpperCase()} ${price.toFixed(2)}${Number.isFinite(change) ? ` (${change >= 0 ? "+" : ""}${change.toFixed(4)}%)` : ""}`);
}

async function loginAngelOne() {
    if (!API_KEY || !CLIENT_CODE || !PIN || !TOTP_SECRET) {
        throw new Error("Angel One credentials are not configured in Render");
    }

    console.log("[Angel] Logging in...");

    const api = new SmartAPI({ api_key: API_KEY });
    const totp = generateTOTP(TOTP_SECRET);
    const session = await api.generateSession(CLIENT_CODE, PIN, totp);

    if (!session || session.status !== true || !session.data) {
        console.error("[Angel] Login response:", session);
        throw new Error("Angel One login failed");
    }

    smartApi = api;
    console.log("[Angel] Login successful");

    return {
        jwtToken: session.data.jwtToken,
        feedToken: session.data.feedToken
    };
}

async function updateFromAngelREST() {
    if (!smartApi) return;

    try {
        const response = await smartApi.getMarketData("LTP", {
            NSE: Object.values(TOKENS)
        });

        if (!response || response.status !== true) {
            throw new Error(response?.message || "Angel market-data request failed");
        }

        const fetched = response?.data?.fetched || [];

        for (const item of fetched) {
            const token = String(item.symbolToken ?? item.symboltoken ?? "").trim();
            const market = TOKEN_TO_MARKET[token];
            const price = Number(item.ltp);

            if (market && Number.isFinite(price) && price > 0) {
                updatePrice(market, price, "angel-rest");
            }
        }

        console.log("[Angel REST] fetched:", fetched.map(item => `${item.symbolToken}:${item.ltp}`).join(", ") || "none");
    } catch (error) {
        console.error("[Angel REST] Market data error:", error?.message || error);
    }
}

async function startAngelRESTFallback() {
    if (!smartApi) return;
    await updateFromAngelREST();
    if (restTimer) clearInterval(restTimer);
    restTimer = setInterval(updateFromAngelREST, 2000);
    console.log("[Angel REST] LTP polling enabled (2s)");
}

async function updateFromNSE() {
    try {
        const response = await fetch("https://www.nseindia.com/api/allIndices", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.nseindia.com/",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            }
        });

        if (!response.ok) throw new Error(`NSE HTTP ${response.status}`);

        const body = await response.json();
        const indices = Array.isArray(body?.data) ? body.data : [];
        const findIndex = (name) => indices.find(item => String(item.index || "").trim() === name);
        const found = {
            nifty: findIndex("NIFTY 50"),
            banknifty: findIndex("NIFTY BANK"),
            finnifty: findIndex("NIFTY FINANCIAL SERVICES"),
            vix: findIndex("INDIA VIX")
        };

        let updated = 0;
        for (const [market, item] of Object.entries(found)) {
            if (!item) continue;
            const price = Number(item.last);
            const change = Number(item.percentChange);
            if (Number.isFinite(price) && price > 0 && (!liveData.websocket || liveData[market] === null)) {
                updatePrice(market, price, "nse-last", Number.isFinite(change) ? change : null);
                updated++;
            }
        }
        console.log(`[NSE] fallback updated ${updated}/4 markets`);
    } catch (error) {
        console.error("[NSE] Fallback error:", error?.message || error);
    }
}

function startNSEFallback() {
    updateFromNSE();
    if (nseTimer) clearInterval(nseTimer);
    nseTimer = setInterval(updateFromNSE, 30000);
    console.log("[NSE] Last-price fallback enabled (30s)");
}

async function startWebSocket() {
    if (loginInProgress) return;
    loginInProgress = true;

    try {
        const session = await loginAngelOne();
        await updateFromAngelREST();
        await updateFromNSE();
        await startAngelRESTFallback();

        websocket = new WebSocketV2({
            clientcode: CLIENT_CODE,
            jwttoken: session.jwtToken,
            apikey: API_KEY,
            feedtype: session.feedToken
        });

        websocket.on("tick", (tick) => {
            try {
                const token = String(tick?.token || "").replace(/^\"|\"$/g, "").trim();
                const market = TOKEN_TO_MARKET[token];
                if (!market) return;
                const raw = Number(tick.last_traded_price);
                if (!Number.isFinite(raw) || raw <= 0) return;
                updatePrice(market, raw / 100, "angelone");
            } catch (error) {
                console.error("[Angel] Tick processing error:", error?.message || error);
            }
        });

        websocket.on("error", (error) => {
            liveData.websocket = false;
            console.error("[Angel] WebSocket error:", error?.message || error);
            scheduleReconnect();
        });

        websocket.on("close", () => {
            liveData.websocket = false;
            console.log("[Angel] WebSocket closed; fallback remains active");
            scheduleReconnect();
        });

        console.log("[Angel] Connecting WebSocket V2...");
        await websocket.connect();
        liveData.websocket = true;
        console.log("[Angel] WebSocket connected");

        const subscription = {
            correlationID: "strikepulse01",
            action: 1,
            mode: 1,
            exchangeType: 1,
            tokens: Object.values(TOKENS)
        };

        console.log("[Angel] Subscribing:", subscription);
        websocket.fetchData(subscription);
    } catch (error) {
        liveData.websocket = false;
        console.error("[Angel] Startup error:", error?.message || error);
        scheduleReconnect();
    } finally {
        loginInProgress = false;
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startWebSocket();
    }, 10000);
}

// =====================================================
// LIVE NIFTY OPTION CHAIN
// Uses Angel One's official daily instrument master to
// resolve current NIFTY option tokens, then FULL market
// data for LTP + OI. Angel documents FULL mode as providing
// open interest and the master file as the token source.
// =====================================================

let optionMasterCache = null;
let optionMasterCacheTime = 0;
let optionChainBusy = false;

async function getOptionMaster() {
    const now = Date.now();
    if (optionMasterCache && now - optionMasterCacheTime < 5 * 60 * 1000) {
        return optionMasterCache;
    }

    const response = await fetch("https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json", {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Angel scrip master HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid Angel scrip master");

    optionMasterCache = data;
    optionMasterCacheTime = now;
    return data;
}

function parseExpiry(value) {
    const m = String(value || "").match(/^(\d{2})([A-Z]{3})(\d{4})$/i);
    if (!m) return null;
    const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
    const month = months[m[2].toUpperCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}

function strikeFromMaster(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n / 100;
}

app.get("/api/nifty-option-chain", async (req, res) => {
    if (optionChainBusy) {
        return res.status(429).json({ success: false, error: "Option chain request already running" });
    }

    optionChainBusy = true;

    try {
        if (!smartApi) {
            await loginAngelOne();
        }

        const master = await getOptionMaster();
        const today = new Date();
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

        const contracts = master
            .filter(x => String(x.exch_seg || "").toUpperCase() === "NFO")
            .filter(x => String(x.instrumenttype || "").toUpperCase() === "OPTIDX")
            .filter(x => String(x.name || "").toUpperCase() === "NIFTY")
            .map(x => ({ ...x, expiryDate: parseExpiry(x.expiry), strikePrice: strikeFromMaster(x.strike) }))
            .filter(x => x.expiryDate && x.expiryDate.getTime() >= todayUtc && Number.isFinite(x.strikePrice))
            .sort((a, b) => a.expiryDate - b.expiryDate || a.strikePrice - b.strikePrice);

        if (!contracts.length) throw new Error("No current NIFTY option contracts found");

        const expiry = contracts[0].expiry;
        const currentExpiry = contracts.filter(x => x.expiry === expiry);
        const spot = Number(liveData.nifty);
        if (!Number.isFinite(spot)) throw new Error("NIFTY live price is not available yet");

        const strikes = [...new Set(currentExpiry.map(x => x.strikePrice))].sort((a, b) => a - b);
        let atmIndex = 0;
        let bestDistance = Infinity;
        strikes.forEach((strike, i) => {
            const distance = Math.abs(strike - spot);
            if (distance < bestDistance) { bestDistance = distance; atmIndex = i; }
        });

        // 5 strikes above and 5 below ATM = 11 strikes total.
        const selectedStrikes = strikes.slice(Math.max(0, atmIndex - 5), Math.min(strikes.length, atmIndex + 6));
        const selected = currentExpiry.filter(x => selectedStrikes.includes(x.strikePrice) && /(?:CE|PE)$/.test(String(x.symbol || "")));
        const tokens = selected.map(x => String(x.token));

        if (tokens.length > 50) throw new Error("Too many option tokens selected");

        const marketResponse = await smartApi.getMarketData("FULL", { NFO: tokens });
        if (!marketResponse || marketResponse.status !== true) {
            throw new Error(marketResponse?.message || "Angel option market-data request failed");
        }

        const fetched = marketResponse?.data?.fetched || [];
        const byToken = new Map(fetched.map(x => [String(x.symbolToken), x]));

        const rows = selectedStrikes.map(strike => {
            const ce = selected.find(x => x.strikePrice === strike && /CE$/.test(String(x.symbol)));
            const pe = selected.find(x => x.strikePrice === strike && /PE$/.test(String(x.symbol)));
            const ceData = ce ? byToken.get(String(ce.token)) : null;
            const peData = pe ? byToken.get(String(pe.token)) : null;
            return {
                strike,
                ce: {
                    symbol: ce?.symbol || null,
                    token: ce?.token || null,
                    ltp: ceData?.ltp ?? null,
                    oi: ceData?.opnInterest ?? null
                },
                pe: {
                    symbol: pe?.symbol || null,
                    token: pe?.token || null,
                    ltp: peData?.ltp ?? null,
                    oi: peData?.opnInterest ?? null
                }
            };
        });

        const callOI = rows.reduce((sum, r) => sum + (Number(r.ce.oi) || 0), 0);
        const putOI = rows.reduce((sum, r) => sum + (Number(r.pe.oi) || 0), 0);

        res.json({
            success: true,
            source: "angelone",
            spot,
            expiry,
            atmStrike: strikes[atmIndex],
            callOI,
            putOI,
            pcr: callOI > 0 ? putOI / callOI : null,
            rows
        });
    } catch (error) {
        console.error("[Option Chain] Error:", error?.message || error);
        res.status(500).json({ success: false, error: error?.message || String(error) });
    } finally {
        optionChainBusy = false;
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Strike Pulse Relay running on port ${PORT}`);
    startNSEFallback();

    if (API_KEY && CLIENT_CODE && PIN && TOTP_SECRET) {
        console.log("[Angel] Credentials detected. Starting Angel One live feed...");
        startWebSocket();
    } else {
        console.error("[Angel] Credentials missing. Add ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_PIN and ANGEL_TOTP_SECRET in Render.");
    }
});
