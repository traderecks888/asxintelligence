# Patch v0.58 – Show dividend/ownership fields (without clutter) + richer score breakdown

What you get:
1) Dividend/ownership fields are now visible in the table by default (key set):
   - Dividend Yield (Current)
   - Dividend Yield Δ%
   - Held % Insiders
   - Held % Institutions

2) "Columns" controls (details dropdown) lets users toggle:
   - Key income/ownership columns (on by default)
   - All dividend columns
   - All holdings columns

3) Selected stock score breakdown:
   - Expanded base score explanation (what goes into Value/Quality/Risk)
   - Shows the raw inputs used for each component (DCF disc, FCF yield, MOS upside, P/B, ROE, margins, leverage, vol, ATR%, drawdown)
   - Keeps existing breakdown UI intact.

Apply:
- Unzip into repo root (overwrite), commit + push.
- Hard refresh /screener.html (Ctrl+F5 / Cmd+Shift+R).
