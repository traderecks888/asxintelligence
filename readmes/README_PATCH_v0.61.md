# Patch v0.61 – Table readability + replace unused chart

1) Table readability:
- Switch Tabulator layout from fitColumns -> fitDataFill
  (prevents columns being squished into 1-letter headers; enables horizontal scrolling)
- Adds responsiveLayout:"hide" for narrow screens
- Adds columnDefaults (minWidth + header wrap)
- Freezes key columns: Ticker, Company, Score

2) Chart replacement:
- Replaces "Undervalued methods count distribution" with "Sector median screener score"
  (bar chart of top sectors by median Screener Score; tooltip shows median + count)

Apply:
- Unzip into repo root (overwrite), commit + push
- Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R)
