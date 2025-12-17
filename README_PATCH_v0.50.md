# Patch v0.50 (A + B)

Includes:
A) Reliability automation
- GitHub Actions: smoke-check outputs, upload artifacts, and auto-create a GitHub Issue on failure.

B) Better screening power
- Adds Value/Quality/Risk/Screener scores to the pipeline.
- Adds Book Value and Book Value per share into the web dataset + UI table.
- Friendlier "Last update" time formatting.
- Chart sliders for zooming the DCF vs FCF bubble view.
- Presets + advanced filters.

Apply:
1) Unzip into repo root (overwrite), commit + push.
2) Run GitHub Action once to regenerate public/data.
3) Visit /screener.html and try presets + sliders.

Lockdown:
- Follow docs/CLOUDFLARE_ACCESS_SETUP.md to restrict access to invited emails.
