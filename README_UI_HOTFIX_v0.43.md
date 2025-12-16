# UI Hotfix v0.43

Fixes the screener being stuck on "Loading..." due to a JavaScript syntax error in the prior screener.js.
Also adds:
- Cache-busting query param on the screener.js script tag
- Better on-page error messages (instead of silent failure)
- Chart sampling (top 900 by market cap) for snappier rendering

Apply:
1) Unzip into your repo root (overwrite), commit + push.
2) Hard refresh the page (Ctrl+F5) once deployed.
