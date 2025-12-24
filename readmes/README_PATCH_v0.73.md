# Patch v0.73 – Fix “stuck on Loading” permanently + add guardrails

## Root cause fixed
- `await` was used inside `function load()` (missing `async`), which is a JavaScript **syntax error**.
  When this happens the browser can’t parse `screener.js`, so the page stays stuck on “Loading”.

## What this patch does
1) UI robustness
- Makes `load()` explicitly `async` again.
- Sets `window.__ASX_UI_READY = true` only after the dataset has loaded and UI booted.
- Adds an inline watchdog in `screener.html`:
  - Captures JS errors + promise rejections
  - Shows a visible error message instead of silent “Loading”
  - After 7s without success, displays a helpful “still loading” message with next steps.
- Bumps `screener.js` cache-buster to `?v=0.73`.

2) CI guardrail (prevents this class of bug forever)
- Adds `node --check public/screener.js` to both workflows so any future JS syntax error fails the run immediately.

## Apply
Unzip into repo root (overwrite), commit + push, then reload `/screener.html`.
