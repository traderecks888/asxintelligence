# Patch v0.74 – Fix workflow YAML + keep best of both (reliability + JS syntax guard)

Why you saw big differences:
- Some previous patches accidentally introduced YAML truncation markers ("...") which can break GitHub Actions parsing.
- Newer workflows added a Node `--check` syntax guard so the screener can't ship a broken `screener.js` that gets stuck on "Loading".

This patch:
- Replaces both workflow files with clean, full YAML (no "..." markers)
- Keeps all the reliability plumbing (smoke check, failure artifacts, failure issue)
- Adds `node --check public/screener.js` as a guardrail
- Enables pip caching via `actions/setup-python` `cache: pip` to reduce runtime minutes

Apply:
Unzip into repo root (overwrite), commit + push.
