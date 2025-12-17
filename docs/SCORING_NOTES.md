# Screener scoring (v0.50)

Scores are 0–100 and computed across the full universe each refresh.

- Value Score (0–100)
  - DCF premium/(discount) (higher better)
  - FCF yield (higher better)
  - MOS upside (higher better)
  - P/B (lower better)

- Quality Score (0–100)
  - ROE (higher better)
  - Profit margin (higher better)
  - Net Debt/EBITDA (lower better)

- Risk Score (0–100)
  - Vol (20d, ann) (lower better)
  - ATR% (14) (lower better)
  - Max drawdown (1y) (less negative better)

- Screener Score (0–100)
  - 45% Value + 30% Quality + 25% Risk + liquidity bonus (0–10)

Notes:
- Yahoo data can be missing/inaccurate. Use Data Quality Score and sanity-check.
- Scores are relative ranks: they change as the cross-section changes.
