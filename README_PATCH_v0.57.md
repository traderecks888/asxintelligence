# Patch v0.57 – Fix screener stuck on 'Loading'

Root cause:
- JavaScript syntax error in public/screener.js: the Score column headerTooltip string ended with a doubled quote (`...bonus 0.''`).
- Because this was a parse error, the script never executed, so the page stayed on 'Loading…'.

Fix:
- Removes the extra quote so screener.js parses and runs.

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R).
