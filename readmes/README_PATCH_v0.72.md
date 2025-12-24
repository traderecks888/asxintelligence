# Patch v0.72 – Dividend fields revamped (Yahoo-only) + calculated yield + UI columns

## Pipeline changes
Removed prior custom dividend fields:
- Last Dividend / Share
- Last Dividend Date
- Dividend Yield (Announced)
- Dividend Yield (Current)
- Dividend Yield Δ%

Added Yahoo dividend fields + derived fields:
- Dividend Rate (Yahoo)
- Dividend Yield (Yahoo)
- Payout Ratio (Yahoo)
- 5Y Avg Dividend Yield (Yahoo)
- Ex-Dividend Date (Yahoo)
- Last Dividend Value (Yahoo)
- Last Dividend Date (Yahoo)
- Dividend Yield (Latest, Calc) = dividendRate ÷ latest price
- Dividend Yield Δ% (Yahoo→Calc) = (calc_yield - yahoo_yield) / yahoo_yield

## UI changes
- Screener table now supports the new dividend fields.
- Default visible dividend column: Dividend Yield (Latest, Calc)
- “Key income” toggle now uses the new calc yield + delta.
- Franking column removed (not reliably available via Yahoo for AU).

## Apply
Unzip into repo root (overwrite), commit + push.
Re-run the pipeline so latest_web.json includes the new dividend columns.
