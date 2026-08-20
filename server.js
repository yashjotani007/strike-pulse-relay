const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});

async function getNSEData(url) {

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept":
            "application/json, text/plain, */*",
        "Accept-Language":
            "en-US,en;q=0.9",
        "Referer":
            "https://www.nseindia.com/"
    };

    // First request to establish NSE session
    const homeResponse = await fetch(
        "https://www.nseindia.com/",
        {
            headers: headers
        }
    );

    const cookie = homeResponse.headers.get("set-cookie");

    if (cookie) {
        headers["Cookie"] = cookie;
    }

    // Actual API request
    const response = await fetch(url, {
        headers: headers
    });

    const text = await response.text();

    console.log("NSE STATUS:", response.status);
    console.log("NSE RESPONSE:", text.substring(0, 300));

    if (!response.ok) {
        throw new Error(
            "NSE HTTP " +
            response.status +
            " - " +
            text.substring(0, 200)
        );
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(
            "NSE returned invalid JSON"
        );
    }
}


/* =========================
   HOME / HEALTH CHECK
========================= */

app.get("/", (req, res) => {

    res.json({
        success: true,
        service: "Strike Pulse NSE Relay",
        status: "online"
    });

});


/* =========================
   NIFTY OPTION CHAIN
========================= */

app.get("/api/nifty-option-chain", async (req, res) => {

    try {

        const url =
            "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY";

        const result =
            await getNSEData(url);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {

        console.error(
            "OPTION CHAIN ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});


/* =========================
   SERVER
========================= */

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
