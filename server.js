const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

/* ==============================
   NSE REQUEST HELPER
============================== */

async function nseRequest(url) {
    const homepage = await fetch("https://www.nseindia.com/", {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        }
    });

    const cookies = homepage.headers.get("set-cookie") || "";

    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/",
            "Cookie": cookies
        }
    });

    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            "NSE HTTP " + response.status + ": " + text.substring(0, 200)
        );
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(
            "NSE returned invalid JSON: " + text.substring(0, 200)
        );
    }
}


/* ==============================
   MARKET DATA
============================== */

app.get("/api/market", async (req, res) => {

    try {

        const data = await nseRequest(
            "https://www.nseindia.com/api/marketStatus"
        );

        res.json({
            success: true,
            data: data
        });

    } catch (error) {

        console.error("MARKET ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


/* ==============================
   NIFTY OPTION CHAIN
============================== */

app.get("/api/option-chain", async (req, res) => {

    try {

        const symbol = req.query.symbol || "NIFTY";

        const url =
            "https://www.nseindia.com/api/option-chain-indices?symbol=" +
            encodeURIComponent(symbol);

        const data = await nseRequest(url);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {

        console.error("OPTION CHAIN ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


/* ==============================
   HEALTH CHECK
============================== */

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Strike Pulse Live Relay is running"
    });

});


/* ==============================
   START SERVER
============================== */

app.listen(PORT, () => {

    console.log(
        "Strike Pulse Relay running on port " + PORT
    );

});
