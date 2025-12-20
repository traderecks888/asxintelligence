# Patch v0.87 – Fix chart sizing + table horizontal scroll (no filename bumps)

Fixes:
1) Sector median screener score chart (hist) now uses the same responsive height as the other charts.
   - The previous CSS targeted `#chartsDetails` only, but your page uses `.charts` directly in some versions.
   - This patch applies sizing to BOTH `#chartsDetails` and `.charts`.

2) Table horizontal scrolling is contained inside the table area again (no page-wide overflow).
   - Forces the page to avoid horizontal overflow while making `#tableArea` scrollable.

3) ResizeObserver loop warnings are ignored in the UI error overlay (and charts resize is debounced).

Apply:
- Unzip into repo root (overwrite), commit, push.
