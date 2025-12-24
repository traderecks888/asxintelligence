# Patch v0.88 – Fix charts grid sizing + table width behavior + drawer resize

Fixes:
1) Sector median screener score chart still small:
   - Root cause: `#chartsGrid` was using `.grid` which is a 4-column layout (used for macro tiles).
   - This patch explicitly defines `#chartsGrid` as a 2-column responsive grid (1 column on small screens).

2) Screener table too narrow:
   - Root cause: CSS forcing Tabulator to `width:max-content` makes it shrink to the sum of visible columns.
   - This patch forces Tabulator to fill the available width (`width:100%`) while keeping internal horizontal scroll.

3) Drawer/table resize:
   - When the right-side detail drawer opens/closes, Tabulator now redraws to match the new width.

Files changed:
- public/screener.html
- public/screener.js

Apply:
Unzip into repo root, overwrite, commit, push. Then refresh the screener page.
