# asxintelligence chart responsive patch v0.84

Fixes sector chart being too small by enforcing a consistent, responsive canvas height across all charts,
and improves Chart.js responsiveness (disable maintainAspectRatio, reduce animation thrash).

Changes:
- public/screener.html
  - adds responsive chart sizing CSS using --chartH clamp()
  - adds ResizeObserver benign warning suppression (if not already present)
- public/screener.js
  - sets Chart.js defaults (responsive + maintainAspectRatio=false)
  - adds resizeCharts() + debounced window resize handler
  - resizes charts after Charts section is expanded

Apply:
- unzip into repo root, commit, push.
