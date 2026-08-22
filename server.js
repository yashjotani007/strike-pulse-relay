const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;


// =====================================================
// CORS
// =====================================================

app.use((req, res, next) => {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

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
// LIVE NSE PRICES
// =====================================================

app.get("/api/prices", async (req, res) => {

    try {

        console.log(
            "Fetching NSE live indices..."
        );


        // Cache-busting
        const nseUrl =
            "https://www.nseindia.com/api/allIndices?t=" +
            Date.now();


        const response = await fetch(
            nseUrl,
            {
                method: "GET",

                headers: {

                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

                    "Accept":
                        "application/json,text/plain,*/*",

                    "Accept-Language":
                        "en-US,en;q=0.9",

                    "Referer":
                        "https://www.nseindia.com/",

                    "Cache-Control":
                        "no-cache",

                    "Pragma":
                        "no-cache"
                }
            }
        );


        console.log(
            "NSE HTTP STATUS:",
            response.status
        );


        if (!response.ok) {

            throw new Error(
                "NSE HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        const indices =
            data.data || [];


        console.log(
            "NSE INDICES COUNT:",
            indices.length
        );


        // =====================================================
        // FIND INDEX
        // =====================================================

        function findIndex(name) {

            return indices.find(
                item =>
                    item.index === name
            );

        }


        const nifty =
            findIndex("NIFTY 50");


        const banknifty =
            findIndex("NIFTY BANK");


        const finnifty =
            findIndex(
                "NIFTY FINANCIAL SERVICES"
            );


        const vix =
            findIndex("INDIA VIX");


        // =====================================================
        // LOG VALUES
        // =====================================================

        console.log(
            "NIFTY:",
            nifty ? nifty.last : null
        );

        console.log(
            "BANKNIFTY:",
            banknifty ? banknifty.last : null
        );

        console.log(
            "FINNIFTY:",
            finnifty ? finnifty.last : null
        );

        console.log(
            "VIX:",
            vix ? vix.last : null
        );


        // =====================================================
        // RESPONSE
        // =====================================================

        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );


        res.json({

            success: true,

            nifty:
                nifty
                    ? nifty.last
                    : null,

            niftyChange:
                nifty
                    ? nifty.percentChange
                    : null,


            banknifty:
                banknifty
                    ? banknifty.last
                    : null,

            bankniftyChange:
                banknifty
                    ? banknifty.percentChange
                    : null,


            finnifty:
                finnifty
                    ? finnifty.last
                    : null,

            finniftyChange:
                finnifty
                    ? finnifty.percentChange
                    : null,


            vix:
                vix
                    ? vix.last
                    : null,

            vixChange:
                vix
                    ? vix.percentChange
                    : null,


            updated:
                new Date().toISOString()

        });

    }


    catch (error) {

        console.error(
            "PRICE API ERROR:",
            error.message
        );


        res.status(500).json({

            success: false,

            error:
                error.message,

            updated:
                new Date().toISOString()

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
