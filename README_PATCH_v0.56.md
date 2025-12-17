# Patch v0.56 – Liquidity tooltip clarity + Dividend/Ownership fields

Fixes / Enhancements:
1) Score tooltip now explains Liquidity Bonus clearly:
   - Avg $Vol 20d = mean over ~20 trading days of (Close × Volume) in AUD
   - LiquidityBonus = 10 × percentile_rank(Avg $Vol 20d) across the universe (0..10)

2) Row-click Score Breakdown panel:
   - Expanded Liquidity Bonus explanation
   - Added Income & ownership card:
     - Last dividend/share + date
     - Yield at announcement vs current implied yield
     - Yield change %
     - Held % insiders / institutions

3) Pipeline additions (exporter):
   - Dividend Rate (Yahoo), Dividend Yield (Yahoo)
   - Last Dividend / Share, Last Dividend Date
   - Dividend Yield (Announced), Dividend Yield (Current), Dividend Yield Δ%
   - Ensures these are included in WEB_COLS for latest_web.json

Apply:
- Unzip into repo root (overwrite), commit + push.
- Re-run the pipeline once to regenerate public/data.
- Hard refresh /screener.html.
