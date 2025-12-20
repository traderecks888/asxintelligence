# Layout restore patch v1.7 (based on your last known-good v1.6)

What this does
- Rebuilds the screener UI from your v1.6 (the last version where sizing/layout was correct)
- Adds *collapsible charts* safely (wraps the existing chart grids in <details>)
- Enforces consistent chart canvas heights (including sector median screener score)
- Keeps the table/drawer layout stable and responsive
- Keeps horizontal scrolling inside the table area
- Ignores benign "ResizeObserver loop" warnings

Files in this patch
- public/screener.html
- public/screener.js
