const express = require("express");
const crypto = require("crypto");

const {
    SmartAPI,
    WebSocketV2
} = require("smartapi-javascript");

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

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});


// =====================================================
// VARIABLES
// =====================================================

let liveData = {

    success: true,

    nifty: null,
    niftyChange: null,

    banknifty: null,
    bankniftyChange: null,

    finnifty: null,
    finniftyChange: null,

    vix: null,
    vixChange: null,

    updated: null
};


// Previous prices
const previous = {
    nifty: null,
    banknifty: null,
    finnifty: null,
    vix: null
};


// =====================================================
// ENVIRONMENT CHECK
// =====================================================

const API_KEY =
    process.env.ANGEL_API_KEY;

const CLIENT_CODE =
    process.env.ANGEL_CLIENT_CODE;

const PIN =
    process.env.ANGEL_PIN;

const TOTP_SECRET =
    process.env.ANGEL_TOTP_SECRET;


if (
    !API_KEY ||
    !CLIENT_CODE ||
    !PIN ||
    !TOTP_SECRET
) {

    console.error(
        "ERROR: Angel One environment variables missing."
    );

    console.error(
        "Required:"
    );

    console.error(
        "ANGEL_API_KEY"
    );

    console.error(
        "ANGEL_CLIENT_CODE"
    );

    console.error(
        "ANGEL_PIN"
    );

    console.error(
        "ANGEL_TOTP_SECRET"
    );
}


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Strike Pulse Relay is running",
        websocket: wsConnected,
        lastUpdate: liveData.updated
    });

});


// =====================================================
// LIVE PRICE API
// =====================================================

app.get("/api/prices", (req, res) => {

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader(
        "Pragma",
        "no-cache"
    );

    res.setHeader(
        "Expires",
        "0"
    );

    res.json(liveData);

});


// =====================================================
// WEBSOCKET STATE
// =====================================================

let wsConnected = false;
let websocket = null;


// =====================================================
// TOTP
// =====================================================

function generateTOTP(secret) {

    const base32chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let bits = "";

    let value = "";

    secret =
        secret
            .replace(/\s/g, "")
            .replace(/=+$/, "")
            .toUpperCase();


    for (const char of secret) {

        const index =
            base32chars.indexOf(char);

        if (index === -1) {
            throw new Error(
                "Invalid TOTP secret"
            );
        }

        bits += index
            .toString(2)
            .padStart(5, "0");
    }


    for (
        let i = 0;
        i + 8 <= bits.length;
        i += 8
    ) {

        value += String.fromCharCode(
            parseInt(
                bits.substring(i, i + 8),
                2
            )
        );
    }


    const counter =
        Math.floor(
            Date.now() / 1000 / 30
        );


    const counterBuffer =
        Buffer.alloc(8);

    counterBuffer.writeBigUInt64BE(
        BigInt(counter)
    );


    const keyBuffer =
        Buffer.from(value, "binary");


    const hmac =
        crypto
            .createHmac(
                "sha1",
                keyBuffer
            )
            .update(counterBuffer)
            .digest();


    const offset =
        hmac[hmac.length - 1] & 0x0f;


    const code =
        (
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)
        ) % 1000000;


    return String(code).padStart(6, "0");
}


// =====================================================
// LOGIN
// =====================================================

async function loginAngelOne() {

    console.log(
        "Connecting to Angel One..."
    );


    const smartApi =
        new SmartAPI({
            api_key: API_KEY
        });


    const totp =
        generateTOTP(
            TOTP_SECRET
        );


    console.log(
        "Generating Angel One session..."
    );


    const session =
        await smartApi.generateSession(
            CLIENT_CODE,
            PIN,
            totp
        );


    if (
        !session ||
        session.status !== true ||
        !session.data
    ) {

        console.error(
            "Angel One login failed:"
        );

        console.error(session);

        throw new Error(
            "Angel One login failed"
        );
    }


    console.log(
        "Angel One login SUCCESS"
    );


    return {
        smartApi: smartApi,

        jwtToken:
            session.data.jwtToken,

        feedToken:
            session.data.feedToken
    };
}


// =====================================================
// START WEBSOCKET
// =====================================================

async function startWebSocket() {

    try {

        const login =
            await loginAngelOne();


        websocket =
            new WebSocketV2({

                jwttoken:
                    login.jwtToken,

                apikey:
                    API_KEY,

                clientcode:
                    CLIENT_CODE,

                feedtype:
                    login.feedToken

            });


        websocket.connect()
            .then(() => {

                console.log(
                    "Angel One WebSocket CONNECTED"
                );

                wsConnected = true;


                // =====================================
                // SUBSCRIBE
                // =====================================

                const request = {

                    correlationID:
                        "strikepulse01",

                    action: 1,

                    mode: 1,

                    exchangeType: 1,

                    tokens: [

                        // NIFTY 50
                        "26000",

                        // BANK NIFTY
                        "26009",

                        // FIN NIFTY
                        "26037",

                        // INDIA VIX
                        "26017"

                    ]

                };


                console.log(
                    "Subscribing to live tokens..."
                );

                console.log(
                    request
                );


                websocket.fetchData(
                    request
                );


            })
            .catch(error => {

                console.error(
                    "WebSocket connect error:",
                    error
                );

                wsConnected = false;

            });


        // =====================================
        // LIVE TICKS
        // =====================================

        websocket.on(
            "tick",
            (tick) => {

                try {

                    console.log(
                        "LIVE TICK:",
                        tick
                    );


                    const token =
                        String(
                            tick.token
                        );


                    const rawPrice =
                        Number(
                            tick.last_traded_price
                        );


                    if (
                        !Number.isFinite(
                            rawPrice
                        )
                    ) {

                        return;
                    }


                    /*
                     * Angel One WebSocket LTP
                     * is returned in paise.
                     */

                    const price =
                        rawPrice / 100;


                    // =================================
                    // NIFTY
                    // =================================

                    if (
                        token === "26000"
                    ) {

                        updateLivePrice(
                            "nifty",
                            price
                        );

                    }


                    // =================================
                    // BANK NIFTY
                    // =================================

                    else if (
                        token === "26009"
                    ) {

                        updateLivePrice(
                            "banknifty",
                            price
                        );

                    }


                    // =================================
                    // FIN NIFTY
                    // =================================

                    else if (
                        token === "26037"
                    ) {

                        updateLivePrice(
                            "finnifty",
                            price
                        );

                    }


                    // =================================
                    // INDIA VIX
                    // =================================

                    else if (
                        token === "26017"
                    ) {

                        updateLivePrice(
                            "vix",
                            price
                        );

                    }

                }
                catch (error) {

                    console.error(
                        "Tick processing error:",
                        error
                    );

                }

            }
        );


        // =====================================
        // ERROR
        // =====================================

        websocket.on(
            "error",
            (error) => {

                console.error(
                    "Angel WebSocket ERROR:",
                    error
                );

                wsConnected = false;

            }
        );


        // =====================================
        // CLOSE
        // =====================================

        websocket.on(
            "close",
            () => {

                console.log(
                    "Angel WebSocket CLOSED"
                );

                wsConnected = false;


                // Reconnect after 10 sec

                setTimeout(
                    startWebSocket,
                    10000
                );

            }
        );


    }
    catch (error) {

        console.error(
            "Angel WebSocket startup failed:",
            error
        );


        wsConnected = false;


        setTimeout(
            startWebSocket,
            15000
        );

    }

}


// =====================================================
// UPDATE PRICE
// =====================================================

function updateLivePrice(
    market,
    price
) {

    const oldPrice =
        previous[market];


    let percentChange = null;


    /*
     * This is the change between
     * the previous received tick and
     * the current tick.
     */

    if (
        oldPrice !== null &&
        oldPrice !== 0
    ) {

        percentChange =
            (
                (price - oldPrice) /
                oldPrice
            ) * 100;

    }


    previous[market] =
        price;


    liveData[market] =
        price;


    /*
     * Current tick percentage.
     */

    liveData[
        market + "Change"
    ] =
        percentChange;


    liveData.updated =
        new Date().toISOString();


    console.log(
        "UPDATED:",
        market,
        price,
        percentChange
    );

}


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


        startWebSocket();

    }
);
