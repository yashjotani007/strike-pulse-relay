# Market Analysis — Seven-Section Development

This branch is isolated from `main`. Do not deploy or merge it until each module has been tested against the original WordPress HTML.

## Original HTML contract
Keep the existing `.sp-analysis` markup and CSS unchanged. Integrate via `public/market-analysis.js` and the Render API.

## Modules and acceptance criteria

1. **Stock Scanner** — All universe/timeframe/pattern/direction selections and numeric/checkbox filters must either work with real provider data or display an explicit unsupported/insufficient-data state. Run, Reset, Save, CSV and chart links must work. Never leave illustrative rows labeled as live.
2. **Option Scanner** — Underlying, expiry, type, moneyness, pattern, OI, volume, IV, spread and advanced conditions must be honored. Contract Analyze must load the selected contract and real observation history. Do not fabricate bid/ask, IV or OHLC candles.
3. **Chart Lab** — Symbol search, all advertised timeframes and chart styles, overlays, RSI/MACD and four comparison charts. Cache/dedupe identical candle requests and indicate unsupported intervals.
4. **Volume Research** — Symbol/period, RVOL, candle-estimated profile POC/VAH/VAL with explicit estimate label, profile and historical volume charts. Do not claim tick-level volume from OHLCV.
5. **Correlation** — Both symbols, rolling window, benchmark, correlation/beta/Z-score/tracking error and four graphs, aligned by actual common sessions.
6. **Backtesting** — All advertised strategies, selected dates/timeframe, fees/slippage/hold; sample size, win rate, profit factor, expectancy, max drawdown, Sharpe and curves. Disclose look-ahead, survivorship and data limitations.
7. **Statistics** — All advertised patterns, symbols, periods and forward windows, occurrences, positive-return frequency, median, defined false-breakout rate, distribution and time-of-day graph where timestamped intraday data exists.

## Initial repository audit
- `market-analysis-api.js` stock scanner currently covers 20 hardcoded stocks or one selected symbol and filters only min price/RVOL/RSI. It does not implement the HTML's complete universe/pattern/direction/checkbox semantics.
- Option scanner supports symbol/type/OI/volume/IV/spread but not all advertised expiry/moneyness/pattern/advanced conditions.
- `market-analysis-extended.js` correlation currently returns a fixed six-month correlation matrix; backtest is a fixed daily SMA crossover, not the HTML's six configurable strategies.
- The extended volume endpoint provides daily volume metrics but not genuine price-level volume profile.
- Existing `public/market-analysis.js` contains multiple independent initialization blocks; dedupe and test all listeners.
- WordPress HTML has illustrative stock/option rows and chart placeholders. Only replace these with verified rendered data or explicit empty states.

## Rollout gates
- Work on this branch only. No direct commits to `main`, no Render deploy, no WordPress edits.
- Add automated tests for numerical calculations and query validation, plus a browser-based end-to-end test for every HTML control.
- Confirm provider coverage before implementing claims that require tick-level data or multi-year intraday history.
- Deploy only after explicit approval and passing verification.
