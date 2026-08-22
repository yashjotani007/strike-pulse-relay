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

// Angel One index tokens.
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

    console.log(
        `[${source}] ${market.toUpperCase()} ${price.toFixed(2)}${
            Number.isFinite(change) ? ` (${change >= 0 ? "+" : ""}${change.toFixed(4)}%)` : ""
        }`
    );
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

// Angel One REST LTP fallback.
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

        console.log(
            "[Angel REST] fetched:",
            fetched.map(item => `${item.symbolToken}:${item.ltp}`).join(", ") || "none"
        );
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

// -----------------------------------------------------
// NSE FALLBACK / LAST CLOSED PRICE
// -----------------------------------------------------
// This is intentionally independent of the Angel WebSocket.
// When the market is closed, there may be no WebSocket tick at all.
// NSE still exposes the latest published index value, so the site
// can show Friday's/last-session closing value instead of Loading...
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

        if (!response.ok) {
            throw new Error(`NSE HTTP ${response.status}`);
        }

        const body = await response.json();
        const indices = Array.isArray(body?.data) ? body.data : [];

        const findIndex = (name) =>
            indices.find(item => String(item.index || "").trim() === name);

        const found = {
            nifty: findIndex("NIFTY 50"),
            banknifty: findIndex("NIFTY BANK"),
            finnifty: findIndex("NIFTY FINANCIAL SERVICES"),
            vix: findIndex("INDIA VIX")
        };

        let updated = 0;

        for (const [market, item] of Object.entries(found)) {
            if (!item) {
                console.warn(`[NSE] ${market} not found`);
                continue;
            }

            const price = Number(item.last);
            const change = Number(item.percentChange);

            if (Number.isFinite(price) && price > 0) {
                // Do not overwrite a working Angel WebSocket tick.
                // NSE is primarily the closed-market/startup fallback.
                if (!liveData.websocket || liveData[market] === null) {
                    updatePrice(
                        market,
                        price,
                        "nse-last",
                        Number.isFinite(change) ? change : null
                    );
                    updated++;
                }
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
    // Keeps closed-market values available after Render restarts/sleeps.
    nseTimer = setInterval(updateFromNSE, 30000);
    console.log("[NSE] Last-price fallback enabled (30s)");
}

async function startWebSocket() {
    if (loginInProgress) return;
    loginInProgress = true;

    try {
        const session = await loginAngelOne();

        // Get a value immediately, even before the first WebSocket tick.
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
                const token = String(tick?.token || "")
                    .replace(/^\"|\"$/g, "")
                    .trim();

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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Strike Pulse Relay running on port ${PORT}`);

    // Start this independently so closed-market prices are available
    // even if Angel login/WebSocket is unavailable.
    startNSEFallback();

    if (API_KEY && CLIENT_CODE && PIN && TOTP_SECRET) {
        console.log("[Angel] Credentials detected. Starting Angel One live feed...");
        startWebSocket();
    } else {
        console.error("[Angel] Credentials missing. Add ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_PIN and ANGEL_TOTP_SECRET in Render.");
    }
});
