# Liquidity Tooltip Patch v0.55

Updates the Score column header tooltip to explain Liquidity Bonus:
- Based on Avg $Vol 20d percentile rank across universe
- LiquidityBonus = 10 × percentile_rank (0..10)
- Avg $Vol 20d ≈ average(close × volume) over ~20 trading days (AUD)
- Missing liquidity → bonus 0

Apply:
1) Unzip into repo root (overwrite), commit + push
2) Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R)
