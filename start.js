const fs = require("fs");
const path = require("path");

// Runtime compatibility patch for FINNIFTY.
// NSE has used multiple display names for Nifty Financial Services;
// CNXFINANCE is the canonical NSE symbol and provides a reliable fallback.
const serverPath = path.join(__dirname, "server.js");
let source = fs.readFileSync(serverPath, "utf8");

source = source.replace(
  /const yahooMap=\{[^;]+\};/,
  'const yahooMap={nifty:"^NSEI",banknifty:"^NSEBANK",finnifty:"^CNXFINANCE",vix:"^INDIAVIX"};'
);

fs.writeFileSync(serverPath, source, "utf8");
require("./server.js");
