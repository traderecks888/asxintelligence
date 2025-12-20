# Patch v0.80 – Macro tiles tooltips + Dividend map axis controls + Reset

## Macro regime tiles tooltips
- Adds hover tooltips for each macro tile (Regime, Breadth, Median Vol, Value pocket, Income, Leading sector)
- Explains what the metric means and exactly how it is derived from the *currently filtered* dataset.

## Dividend sustainability map improvements
- Adds axis controls (sliders) to cap:
  - Yield max (X)
  - Payout max (Y)
- Prevents single outliers from flattening the whole chart by:
  - Computing robust default caps (99th percentile) and applying them automatically
  - Filtering displayed dividend points to the current axis window
- Adds a **Reset view** button to restore the robust defaults.

## Apply
Unzip into repo root (overwrite), commit + push.
The workflow's `node --check public/screener.js` will validate syntax automatically.
