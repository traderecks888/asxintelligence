# Patch v0.65 – Revert external slider; use single horizontal scrollbar inside table container + header alignment fix

What this patch does:
- Removes the separate range-slider scroll control added in v0.64
- Wraps the Tabulator table in #tableWrap and uses ONE horizontal scrollbar (native) in that container
- Prevents double horizontal scrollbars by disabling horizontal overflow on Tabulator's internal tableholder
- Adds small redraw hooks (dataLoaded / columnVisibilityChanged / resize) to keep header and rows aligned

Apply:
1) Unzip into repo root (overwrite), commit + push
2) Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R)
