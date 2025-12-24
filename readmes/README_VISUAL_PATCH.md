# Visual Screener patch (v0.4)

This patch adds:
- Technical indicators into the pipeline (RSI14, ATR%, vol, returns, max drawdown, 52w high/low, SMA distances, liquidity, beta vs ^AXJO).
- Cloudflare-ready web exports: public/data/latest.* + manifest.json
- A visual screener UI (Tabulator table + Chart.js charts) served from Cloudflare Pages.

## Apply
Unzip this patch into the **root** of your repo (overwrite when prompted), then commit + push.

## Run locally
pip install -r requirements.txt
python asx_intrinsic_valuations_export.py --resume

## Run via GitHub Actions
Actions → Monthly ASX refresh → Run workflow

## Cloudflare Pages
- Output directory: public
- Your site will have:
  - / (home)
  - /screener.html (visual screener)
  - /data/latest.json etc
