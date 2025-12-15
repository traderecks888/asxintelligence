# Visual Screener patch (v0.42)

What changed:
- Keeps the visual UI fast by using `latest_web.json` for the screener.
- Also publishes a "full" Excel for download:
  - `public/data/latest_full.xlsx` if <= ~24 MiB
  - otherwise `public/data/latest_full.xlsx.zip` (contains latest_full.xlsx inside)
- Adds these to the home page download links and to manifest.json.

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Run the GitHub Action (or run locally) once to regenerate `public/data/*`.
