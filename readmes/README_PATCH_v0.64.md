# Patch v0.64 – Always-visible horizontal slider for the table

Why this patch:
- Native horizontal scrollbars can be hidden by OS/browser settings and Tabulator layout/CSS.
- This adds a visible range slider under the table that controls horizontal scrollLeft.

What changed:
- public/screener.html: adds #hscrollRange slider + CSS to ensure overflow works
- public/screener.js: adds wireHorizontalSlider() to sync slider <-> table scroll

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R).
