# Patch v0.60 – Fix missing dividend fields for ASX tickers (Yahoo/yfinance)

Problem:
- Dividend columns were empty because the exporter never copied Yahoo dividend fields into the per-stock base dict.
- For AU tickers, Yahoo info fields are often missing anyway.

Fix:
1) Adds dividend fields into `base` (dividendRate, dividendYield, lastDividendValue, lastDividendDate).
2) Adds a fallback using `yfinance.Ticker(sym).dividends`:
   - last dividend per share + date
   - trailing-12-month dividend rate (sum of last 365 days)
   - derives dividendYield if missing and price is available

Apply:
- Unzip into repo root (overwrite), commit + push.
- Re-run the pipeline (GitHub Action or local) to regenerate public/data/latest_web.json
- Hard refresh screener.html
