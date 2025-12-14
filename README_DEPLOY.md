# ASX Intelligence: automation + Cloudflare workflow

## Goal
- Run the pipeline monthly in GitHub Actions.
- Publish the **latest** outputs into `public/data/`.
- Deploy a simple private data portal via Cloudflare Pages.
- Restrict access to a small allowlist via Cloudflare Access.

## 1) Add files from this bootstrap patch
- `.github/workflows/monthly_refresh.yml`
- `public/index.html`
- `public/data/.gitkeep`
- `.gitignore` (recommended)
- Updated `asx_intrinsic_valuations_export.py` (adds `--public_dir` exports)

## 2) Ensure GitHub Actions can push commits
Repo → **Settings → Actions → General → Workflow permissions**
- Set to **Read and write**.

## 3) Run once manually
Repo → Actions → **Monthly ASX refresh** → Run workflow

Outputs appear in:
- `public/data/latest.xlsx`
- `public/data/latest.csv`
- `public/data/latest.json`
- `public/data/manifest.json`
(and `latest.parquet` if you enable `pyarrow`)

## 4) Cloudflare Pages
- Create a Pages project
- Connect to this GitHub repo
- Build command: (empty) or `:` (no-op)
- Output directory: `public`

## 5) Lock it down
Use Cloudflare Zero Trust / Access to require login and allowlist emails.
