# ASX Intelligence Patch v0.79

This patch adds **three UI enhancements** without changing the data pipeline or adding any new fetches:

1. **Value vs Quality Quadrant (bubble chart)** — uses existing fields `Value Score` and `Quality Score`
2. **Dividend Sustainability Map (bubble chart)** — uses existing fields `Dividend Yield (Latest, Calc)` and `Payout Ratio (Yahoo)`
3. **Macro Regime Tiles** — derived from the currently-filtered dataset (breadth, vol, value pocket, income, leading sector)

## Files
- `public/screener.html`
- `public/screener.js`

## Notes
- Charts are **fail-soft**: if data is missing, they will render empty rather than breaking the page.
- Bubble size is scaled by market cap and capped for readability.
- Cache-buster bumped to `v=0.79` so Cloudflare Pages will load the updated JS.

## How to apply
Unzip into your repo root (overwrite files), commit, push.
