# Patch v0.77 – Fix JS syntax error in dividend columns (remove malformed legacy columns)

Fixes workflow failure:
- Removes the legacy dividend columns that were left in an invalid state:
  - Div/Share
  - Div Yld Ann
  - Div Yld Now
  - Div Yld Δ%
  - Frank%

Your revamped Yahoo dividend columns block (Div Rate / Div Yld (Y!) / Div Yld (Calc) / etc.) remains intact.

Apply:
Unzip into repo root (overwrite), commit + push, re-run workflow.
