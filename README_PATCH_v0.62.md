# Patch v0.62 – Twice-daily GitHub schedule + horizontal table scroll bar

## GitHub Actions schedule (UTC cron)
Adds `.github/workflows/asxintelligence_twice_daily.yml` to run weekdays:
- 02:00 UTC and 05:25 UTC (aligns to ~13:00 and ~16:25 Sydney during AEDT summer)
- Winter AEST alternatives are included as comments.

Important: If you already have another scheduled workflow, disable/remove its `on.schedule` block to avoid double runs.

## Horizontal slider bar
Adds a dedicated horizontal scrollbar under the table and syncs it with the table’s internal scroll.

## Apply
Unzip into repo root (overwrite), commit + push. Hard refresh `/screener.html`.
