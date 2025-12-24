# Charts collapsible/expandable patch

What it does:
- Wraps the chart area in a <details id="chartsDetails"> block with a clickable summary.
- Keeps the same layout when open.
- When toggled open/closed, forces Chart.js charts to resize and Tabulator to redraw (prevents sizing glitches).

Install:
- Unzip into repo root (overwrite public/screener.html and public/screener.js), commit, push.
