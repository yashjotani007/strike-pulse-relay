# Strike Pulse Market Analysis

Modular, research-only Market Analysis package.

- `index.js`: installs routes before the Express server starts.
- `routes.js`: registers the single JS loader and API endpoints.
- `overview/`: existing Market Intelligence integration.
- `scanners/`: stock and option scanners.
- `options/`: validated option-chain integration.
- `charts/`: chart data and indicators.
- `research/`: correlation and relative-strength calculations.
- `backtesting/`: EMA crossover research simulation.
- `risk/`: performance and risk statistics.
- `watchlist/`: watchlist input validation.
- `data/`: market provider and data validation helpers.
- `public/market-analysis.js`: single WordPress frontend loader.

Existing relay feeds are reused: Market Intelligence, stock search/candles, and the existing option-chain loader. No order placement or broker trade execution is implemented. Missing data remains unavailable, never fabricated.
