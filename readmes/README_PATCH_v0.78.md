# Patch v0.78 – Fix dividend yield scaling (factor-of-100)

Issue:
- Some Yahoo yield fields appear to be stored as percents (8.08) rather than fractions (0.0808).
- The UI percent formatter multiplies by 100, causing 808%.

Fix:
- UI: adds pctSmart() and applies it to:
  - Dividend Yield (Yahoo)
  - 5Y Avg Dividend Yield (Yahoo)
  Works whether input is fraction or percent.
- Pipeline: normalizes yields to fractions via norm_yield() when exporting:
  - Dividend Yield (Yahoo)
  - 5Y Avg Dividend Yield (Yahoo)
  Also uses normalized yahoo yield in Yahoo→Calc delta.

Apply:
Unzip into repo root (overwrite), commit + push.
Re-run workflow once to regenerate latest_web.json with normalized yields.
