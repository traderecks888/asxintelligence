# Patch v0.82 – Filters under charts, collapsible charts, simplified table views, intrinsic value methods with green/red cells

## Layout
- Moves the Filters + Presets panel to sit **under the charts** and **right above the screener table**.
- Adds a **Charts** collapsible section (expand/collapse).

## Table view presets (simplified)
Replaces the noisy column selector with a simple **Table view** preset set:
- Core
- Fundamentals
- Technicals
- Score parts
- Value ($/sh)
- Value (% disc)
- All

Core columns are: Ticker, Company, Sector, Score, Price, Market Cap + compact FA/TA summaries.

## Intrinsic value methods
Adds (hidden by default; shown via Value presets):
- $/share: DCF $, RI $, Asset $, SOTP $, DDM $, EPV $, Opt $
- % premium/discount: DCF %, RI %, Asset %, SOTP %, DDM %, EPV %, Opt %

Conditional fill:
- **$ columns:** green if intrinsic >= current price, red otherwise.
- **% columns:** green if >0 (undervalued), red if <0.

Also renames **U Count → Undervalued Count** and documents what it counts (DCF, RI, Asset, SOTP, DDM).

## Apply
Unzip into repo root (overwrite), commit + push.
