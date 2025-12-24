# Patch v0.66 – Fix table scrolling + header/body alignment + toggle score breakdown

## Table fixes
- Removes the external wrapper/slider experiments.
- Restores a standard Tabulator layout where scrolling happens INSIDE the table:
  - vertical + horizontal scrollbars in the table body
- Removes frozen columns to avoid grey side bars and reduce alignment edge cases.
- Forces `.tabulator-tableholder` overflow to auto and triggers redraws after render/data/resize.

## Score breakdown toggle
- Clicking a row opens the breakdown.
- Clicking the SAME row again closes it and clears the details.

Apply:
1) Unzip into repo root (overwrite), commit + push
2) Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R)
