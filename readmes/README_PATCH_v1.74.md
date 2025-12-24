# Patch v1.74 – Fix 'Error loading dataset' regression from v1.73

Root cause:
- v1.73 introduced new UI wiring, but `bootUI()` still had a few unguarded DOM writes
  (kpiRows/kpiDCF/kpiFCF/kpiScore). If the template differs even slightly, it can throw
  and the loader reports a dataset error even when `/data/latest_web.json` is fine.

Fix:
- Make KPI updates null-safe via `setText()`
- Add a clear early guard for missing `#table` (template mismatch)
- Keep the v1.73 table view + FA/TA strength features intact

Apply:
- Unzip into repo root, overwrite `public/screener.html` and `public/screener.js`, commit & push.
