# Patch v0.69 – Remove left grey gutter (row-header) and align columns

Fixes:
- Disables Tabulator responsive layout (which can create a left 'row header' gutter)
- Adds CSS to hide any row-header / responsive-collapse gutter if still created
- Forces table holder margin-left to 0 so data aligns under header

Apply:
Unzip into repo root (overwrite), commit + push. Hard refresh /screener.html.
