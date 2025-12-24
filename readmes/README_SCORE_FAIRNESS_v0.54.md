# Score Fairness Patch v0.54

Opinionated but unbiased behavior:
- Zero values (e.g., 0 FCF yield) are treated as real values, not missing.
- Missing values (NaN) no longer collapse the entire score.

What changed:
- Screener Score now:
  1) Computes the weighted average of available Value/Quality/Risk components
     (weights 45%/30%/25% re-normalized if a component is missing)
  2) Applies a small completeness penalty (up to 10 points)
  3) Adds Liquidity Bonus (0–10), with missing liquidity treated as 0.

Also adds:
- Liquidity Bonus (explicit)
- Score Coverage (%)
- Missing Component Penalty

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Run the pipeline once to regenerate public/data.
3) Hard refresh screener.html (Ctrl+F5 / Cmd+Shift+R).
