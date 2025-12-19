# Patch v0.70 – Kill the left grey gutter for real + stable row toggle selection + stable scrolling

Changes:
- Stops relying on Tabulator's selection module (removes `selectable` + row.select/deselect calls)
  and implements persistent selection highlight via CSS class `asx-row-active`.
- Row click behavior now matches your spec exactly:
  - click row => highlight + expand score breakdown for that stock
  - click same row again => unhighlight + collapse breakdown
  - click different row => move highlight + update breakdown
- Cleans conflicting CSS overflow rules and sets canonical `overflow:auto` on tableholder.
- Aggressively hides/removes any left gutter/row header/responsive-collapse elements via CSS.
- Re-highlights active row after filtering/sorting/paging and collapses if the active row disappears.

Apply:
Unzip into repo root (overwrite), commit + push. Hard refresh /screener.html.
