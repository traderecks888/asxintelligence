# Monthly refresh workflow notes

Your existing monthly refresh workflow can be kept as-is.

Why it has "more jobs/steps":
- Smoke checks: fail fast if outputs are missing/corrupt
- Artifact upload: helps debug failures
- Issue creation: alerts you without you having to stare at Actions

The twice-daily workflow now includes the same reliability steps, but uploads artifacts ONLY on failure to avoid filling artifact storage.
