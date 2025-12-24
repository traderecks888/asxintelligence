# Patch v0.68 – Fix row toggle+breakdown behavior, remove grey gutter, stop scroll snap-back

Fixes:
- Row click behavior:
  - Click row => highlight + expand breakdown
  - Click same row again => unhighlight + collapse breakdown
  - Click different row => highlight moves + breakdown updates

- Removes scroll snap-back:
  - Removes redraw(true) loop on renderComplete (was constantly redrawing and resetting scroll)
  - Uses a safe redraw helper that preserves scroll positions (only on resize/column changes)

- Removes left grey vertical band:
  - Explicitly disables responsive layout
  - Hides Tabulator row-header gutter via CSS

Apply:
- Unzip into repo root (overwrite), commit + push
- Hard refresh /screener.html
