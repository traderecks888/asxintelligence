# Patch v0.75 – Fix JS syntax error in column controls (workflow Node --check)

Fixes a broken `wireColumnControls()` section that had the `keyIncome` array commented out,
leaving stray string literals and a leading `]` which caused:

`SyntaxError: Unexpected token ']'`

This patch restores valid JS:

- `// Column groups`
- `const keyIncome = [...]`
- `const allDividend = [...]`

Apply:
Unzip into repo root (overwrite), commit + push.
Then re-run the workflow.
