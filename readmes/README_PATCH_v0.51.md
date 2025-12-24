# Patch v0.51

Fixes a syntax error introduced in v0.50 in WEB_COLS:

- Removes an extra comma: `"As Of",,` -> `"As Of",`

Apply:
1) Unzip into repo root (overwrite).
2) Commit + push.
3) Re-run the workflow / script.
