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
    nifty: "26000",
    banknifty: "26009",
    finnifty: "26037",
    vix: "26017"
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
    websocket: false
};

const previous = {
    nifty: null,
    banknifty: null,
    finnifty: null,
    vix: null
};

let websocket = null;
let reconnectTimer = null;
let loginInProgress = false;

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
        websocket: liveData.websocket,
        lastUpdate: liveData.updated
    });
});

app.get("/api/prices", (req, res) => {
    const payload = {
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
        websocket: liveData.websocket
    };

    // Keep both formats so old and new WordPress JS work.
    res.json({ ...payload, data: payload });
});

async function loginAngelOne() {
    if (!API_KEY || !CLIENT_CODE || !PIN || !TOTP_SECRET) {
        throw new Error("Missing Angel One environment variables");
    }

    console.log("[Angel] Logging in...");
    const smartApi = new SmartAPI({ api_key: API_KEY });
    const totp = generateTOTP(TOTP_SECRET);
    const session = await smartApi.generateSession(CLIENT_CODE, PIN, totp);

    if (!session || session.status !== true || !session.data) {
        console.error("[Angel] Login response:", session);
        throw new Error("Angel One login failed");
    }

    console.log("[Angel] Login successful");
    return {
        jwtToken: session.data.jwtToken,
        feedToken: session.data.feedToken
    };
}

function updatePrice(market, price) {
    if (!Number.isFinite(price) || price <= 0) return;

    const old = previous[market];
    let change = null;

    if (Number.isFinite(old) && old !== 0) {
        change = ((price - old) / old) * 100;
    }

    previous[market] = price;
    liveData[market] = price;
    liveData[`${market}Change`] = change;
    liveData.updated = new Date().toISOString();

    console.log(`[LIVE] ${market.toUpperCase()} ${price.toFixed(2)}${change === null ? "" : ` (${change >= 0 ? "+" : ""}${change.toFixed(4)}%)`}`);
}

async function startWebSocket() {
    if (loginInProgress) return;
    loginInProgress = true;

    try {
        const session = await loginAngelOne();

        websocket = new WebSocketV2({
            clientcode: CLIENT_CODE,
            jwttoken: session.jwtToken,
            apikey: API_KEY,
            feedtype: session.feedToken
        });

        websocket.on("tick", (tick) => {
            try {
                console.log("[Angel] RAW TICK:", tick);

                const token = String(tick?.token || "")
                    .replace(/^\"|\"$/g, "")
                    .trim();

                const market = TOKEN_TO_MARKET[token];
                if (!market) return;

                const raw = Number(tick.last_traded_price);
                if (!Number.isFinite(raw) || raw <= 0) return;

                // SmartAPI LTP is sent in paise.
                updatePrice(market, raw / 100);
            } catch (error) {
                console.error("[Angel] Tick processing error:", error.message);
            }
        });

        websocket.on("error", (error) => {
            liveData.websocket = false;
            console.error("[Angel] WebSocket error:", error?.message || error);
        });

        websocket.on("close", () => {
            liveData.websocket = false;
            console.log("[Angel] WebSocket closed");
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

        console.log("[Angel] Subscribing:", subscription.tokens.join(", "));
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
    startWebSocket();
});
