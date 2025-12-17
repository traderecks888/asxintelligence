# Score breakdown patch v0.53

Adds max detail on the Screener Score per stock **without adding table columns**:

- Click any row → opens a collapsible breakdown panel showing:
  - Value / Quality / Risk bars (0–100)
  - Liquidity bonus bar (0–10)
  - “Value-led / Quality-led / Risk-led” and weakest component
  - A quick sanity line showing computed vs reported score (rounding/clip deltas)

- Row hover tooltip gives a compact summary (Score/V/Q/R/+Liq).

Pipeline:
- Exports `Liquidity Bonus` so the breakdown is accurate (no UI guessing).

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Re-run the pipeline once to regenerate `public/data/latest_web.json`.
3) Hard refresh screener.html.
