# Security Re-scan

## Overview

A targeted security re-scan runs automatically on every migration change to verify the database remains hardened against known vulnerability classes. The scan queries the live database and fails the build if any new finding is detected.

## GitHub Actions Workflow

The workflow is defined in `.github/workflows/security-scan.yml`.

**Triggers:**

- Push or pull request that touches:
  - `supabase/migrations/**`
  - `scripts/security-scan.mjs`
  - `.github/workflows/security-scan.yml`
- Weekly schedule: every Monday at 06:00 UTC
- Manual trigger via `workflow_dispatch`

**Steps:**

1. Checkout code
2. Set up Node 20
3. Verify the `SUPABASE_DB_URL` repository secret is configured
4. Run the targeted security re-scan: `node scripts/security-scan.mjs`

## Required Secrets

Add the following secret to your repository:

| Secret            | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL` | Postgres connection string for the project's database. Used by the scan script to run live database checks. |

**How to add:**

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `SUPABASE_DB_URL`
4. Value: your Postgres connection string (e.g., `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`)

## Running Locally

```bash
# With a direct connection string
SUPABASE_DB_URL="postgresql://..." npm run security:scan

# Or using standard Postgres env vars
PGHOST=db.[project-ref].supabase.co \
PGUSER=postgres \
PGPASSWORD=... \
PGDATABASE=postgres \
npm run security:scan
```

## Checks Performed

The scan validates three targeted checks:

1. **SECURITY DEFINER functions in public schema** — ensures no `SECURITY DEFINER` function in the `public` schema is executable by `anon` or `authenticated`.
2. **profile-photos storage block bypass** — ensures `storage.objects` SELECT policies for `profile-photos` enforce the `is_blocked` relationship.
3. **Public tables without RLS** — ensures every table in the `public` schema has Row Level Security enabled.

If any check returns an offending row, the process exits non-zero and CI fails the build.
