const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Strike Pulse Relay is running"
    });
});


// =====================================================
// LIVE PRICES
// =====================================================

app.get("/api/prices", async (req, res) => {

    try {

        const response = await fetch(
            "https://www.nseindia.com/api/allIndices",
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

                    "Accept":
                        "application/json,text/plain,*/*",

                    "Accept-Language":
                        "en-US,en;q=0.9",

                    "Referer":
                        "https://www.nseindia.com/"
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "NSE HTTP " + response.status
            );
        }

        const data = await response.json();

        const indices = data.data || [];

        function findIndex(name) {
            return indices.find(
                item => item.index === name
            );
        }

        const nifty = findIndex("NIFTY 50");
        const banknifty = findIndex("NIFTY BANK");
        const finnifty = findIndex("NIFTY FINANCIAL SERVICES");
        const vix = findIndex("INDIA VIX");

        res.json({
            success: true,

            nifty: nifty ? nifty.last : null,

            banknifty: banknifty ? banknifty.last : null,

            finnifty: finnifty ? finnifty.last : null,

            vix: vix ? vix.last : null,

            updated: new Date().toISOString()
        });

    } catch (error) {

        console.error(
            "PRICE API ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }

});


// =====================================================
// SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "Strike Pulse Relay running on port " +
            PORT
        );

    }
);
