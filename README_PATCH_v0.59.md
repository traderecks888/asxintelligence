# Patch v0.59 – Dividend zeros fix + Franking column + table header readability

What changed:
1) Fixes "all dividend values show 0":
   - JS num() no longer coerces null/"" into 0 (Number(null) == 0 in JS).
   - Missing values now display as “–”.

2) Adds dividend franking column:
   - Adds hidden column: "Dividend Franking % (Latest)".
   - Included in Columns toggle controls. (Will show “–” until the pipeline supplies it.)

3) Improves table readability:
   - Smaller header font, wrapped titles, tighter row/cell padding.

Apply:
- Unzip into repo root (overwrite), commit + push.
- Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R).
