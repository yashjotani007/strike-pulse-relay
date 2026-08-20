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
// NSE PAGE REQUEST
// =====================================================

async function getNSEPage() {

    const response = await fetch(
        "https://www.nseindia.com/option-chain",
        {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                "Accept-Language":
                    "en-US,en;q=0.9",

                "Cache-Control":
                    "no-cache"
            }
        }
    );

    const text = await response.text();

    console.log(
        "NSE PAGE STATUS:",
        response.status
    );

    console.log(
        "NSE PAGE:",
        text.substring(0, 500)
    );

    if (!response.ok) {

        throw new Error(
            "NSE page HTTP " +
            response.status
        );
    }

    return text;
}


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
// NSE OPTION PAGE TEST
// =====================================================

app.get(
    "/api/nse-page",
    async (req, res) => {

        try {

            const html =
                await getNSEPage();

            res.json({

                success: true,

                length:
                    html.length,

                message:
                    "NSE option-chain page received"

            });

        } catch (error) {

            console.error(
                "NSE PAGE ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


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
