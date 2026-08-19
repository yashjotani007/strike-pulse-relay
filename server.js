const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

async function getYahooPrice(symbol) {
    const url =
        "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(symbol) +
        "?range=1d&interval=1m";

    const response = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*"
        }
    });

    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            "Yahoo HTTP " + response.status + ": " + text.substring(0, 200)
        );
    }

    let json;

    try {
        json = JSON.parse(text);
    } catch (error) {
        throw new Error("Yahoo returned invalid JSON");
    }

    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta || typeof meta.regularMarketPrice !== "number") {
        throw new Error("Live price not available for " + symbol);
    }

    return {
        price: meta.regularMarketPrice,
        change:
            typeof meta.regularMarketChange === "number"
                ? meta.regularMarketChange
                : null,
        changePercent:
            typeof meta.regularMarketChangePercent === "number"
                ? meta.regularMarketChangePercent
                : null,
        marketTime: meta.regularMarketTime || null
    };
}

/* =========================
   LIVE PRICES
========================= */

app.get("/api/prices", async (req, res) => {

    const symbols = {
        nifty: "^NSEI",
        banknifty: "^NSEBANK",
        finnifty: "NIFTY_FIN_SERVICE.NS",
        vix: "^INDIAVIX"
    };

    try {

        const entries = await Promise.all(
            Object.entries(symbols).map(async ([key, symbol]) => {

                try {
                    return [key, await getYahooPrice(symbol)];
                } catch (error) {
                    console.error(
                        key.toUpperCase() + " ERROR:",
                        error.message
                    );

                    return [key, null];
                }

            })
        );

        const data = Object.fromEntries(entries);

        res.json({
            success: Object.values(data).some(Boolean),
            updatedAt: new Date().toISOString(),
            data: data
        });

    } catch (error) {

        console.error("PRICES ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Strike Pulse Live Relay is running"
    });

});

/* =========================
   START
========================= */

app.listen(PORT, () => {

    console.log(
        "Strike Pulse Relay running on port " + PORT
    );

});
