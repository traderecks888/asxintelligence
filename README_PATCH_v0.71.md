# Patch v0.71 – Right-side detail drawer + anti-regression guardrails

## What changed
- The “Selected stock score breakdown” panel no longer expands below the charts/table.
  It is now a sticky right-side drawer that opens when you click a row, and closes when
  you click the same row again (or press the × close button).

- Added guardrails so adding more columns won’t squeeze header text into single letters:
  - Forces wide tables to scroll horizontally inside the table
  - Keeps Tabulator responsive/collapse row-header gutter hidden (prevents grey band regression)
  - Keeps selection highlight working exactly as before

## Files
- public/screener.html
- public/screener.js

## Apply
Unzip into repo root (overwrite), commit + push. Hard refresh /screener.html.
