# Patch v0.83 – Ignore benign ResizeObserver loop warnings

Fix:
- Some browsers (notably Chrome) can emit the warning:
  "ResizeObserver loop completed with undelivered notifications."
  when layout is rapidly changing (charts + table measurements).
- This does not usually break the screener, but our global error handler was showing it as a fatal error.

Change:
- The global `window.addEventListener("error")` and `unhandledrejection` handlers now ignore ResizeObserver loop warnings.
- Other real errors still show normally.

Apply:
- Unzip into repo root (overwrite), commit + push.
