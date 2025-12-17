# Cloudflare Access (Invite-only) setup

Goal: keep `https://<project>.pages.dev` private to you + a short allowlist.

1) Cloudflare Dashboard → Zero Trust
2) Access → Applications → Add an application
3) Choose Self-hosted
4) Application domain:
   - Domain: `<project>.pages.dev`
   - Path: `/*` (recommended)
5) Identity provider:
   - Easiest: One-time PIN via email (or Google/Microsoft)
6) Policies:
   - Allow policy with your email(s)
   - Optional: add an email domain rule if you trust it
7) Create app.

Test:
- Open your Pages URL in an incognito window.
- You should be prompted to log in.
