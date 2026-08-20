const express = require("express");

const app = express();


// ==========================================
// STRIKE PULSE - CORS
// ==========================================

app.use(function (req, res, next) {

    res.header(
        "Access-Control-Allow-Origin",
        "https://yashjotani.free.nf"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();

});

app.use(express.json());


// ==========================================
// SYMBOLS
// ==========================================

const SYMBOLS = {

    nifty: "^NSEI",

    banknifty: "^NSEBANK",

    finnifty: "NIFTY_FIN_SERVICE.NS",

    vix: "^INDIAVIX"

};


// ==========================================
// GET YAHOO FINANCE PRICE
// ==========================================

async function getPrice(symbol) {

    const url =
        "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(symbol) +
        "?range=1d&interval=1m";

    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36"
        }
    });


    if (!response.ok) {

        throw new Error(
            "Yahoo Finance HTTP " +
            response.status +
            " for " +
            symbol
        );

    }


    const json =
        await response.json();


    const result =
        json &&
        json.chart &&
        json.chart.result &&
        json.chart.result[0];


    if (!result) {

        throw new Error(
            "No Yahoo Finance data for " +
            symbol
        );

    }


    const meta =
        result.meta || {};


    let price =
        meta.regularMarketPrice;


    /*
     * Fallback:
     * If regularMarketPrice is unavailable,
     * use the latest chart close.
     */

    if (
        price === null ||
        price === undefined
    ) {

        const closes =
            result.indicators &&
            result.indicators.quote &&
            result.indicators.quote[0] &&
            result.indicators.quote[0].close;


        if (Array.isArray(closes)) {

            for (
                let i = closes.length - 1;
                i >= 0;
                i--
            ) {

                if (
                    closes[i] !== null &&
                    closes[i] !== undefined
                ) {

                    price = closes[i];

                    break;

                }

            }

        }

    }


    if (
        price === null ||
        price === undefined ||
        !Number.isFinite(Number(price))
    ) {

        throw new Error(
            "Price unavailable for " +
            symbol
        );

    }


    return {

        price: Number(price),

        change:
            meta.regularMarketChange !== undefined
                ? Number(meta.regularMarketChange)
                : null,

        changePercent:
            meta.regularMarketChangePercent !== undefined
                ? Number(meta.regularMarketChangePercent)
                : null,

        marketTime:
            meta.regularMarketTime ||
            Math.floor(Date.now() / 1000)

    };

}


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", function (req, res) {

    res.json({

        success: true,

        message:
            "Strike Pulse Relay is running",

        endpoint:
            "/api/prices"

    });

});


// ==========================================
// LIVE MARKET API
// ==========================================

app.get("/api/prices", async function (req, res) {

    try {

        const results =
            await Promise.all([

                getPrice(SYMBOLS.nifty),

                getPrice(SYMBOLS.banknifty),

                getPrice(SYMBOLS.finnifty),

                getPrice(SYMBOLS.vix)

            ]);


        const updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            updatedAt: updatedAt,

            data: {

                nifty: results[0],

                banknifty: results[1],

                finnifty: results[2],

                vix: results[3]

            }

        });

    }


    catch (error) {

        console.error(
            "STRIKE PULSE API ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                "Unable to fetch live market data",

            message:
                error.message,

            updatedAt:
                new Date().toISOString()

        });

    }

});


// ==========================================
// START SERVER
// ==========================================

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, function () {

    console.log(
        "================================="
    );

    console.log(
        "STRIKE PULSE RELAY SERVER"
    );

    console.log(
        "Running on port " + PORT
    );

    console.log(
        "CORS enabled for WordPress"
    );

    console.log(
        "================================="
    );

});
