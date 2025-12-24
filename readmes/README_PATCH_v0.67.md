# Patch v0.67 – Row selection highlight toggle + remove left grey band + stable table scrolling

Fixes:
1) Selected row stays highlighted until clicked again (toggle on/off). Selecting a different row moves the highlight.
2) Removes the left grey band by disabling Tabulator responsive collapse (responsiveLayout) which adds a left “row header” column.
3) Cleans up conflicting Tabulator CSS from earlier patches (removes max-content wrapper hacks) and enforces a single, normal scroll inside the table.

Apply:
- Unzip into repo root (overwrite), commit + push.
- Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R).
