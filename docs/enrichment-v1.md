# Attorney enrichment agent — safe foundation

This branch contains a **read-only audit function** and a **midnight Eastern GitHub Actions schedule**. It is not yet a connected research agent. It does not read production data, browse attorney websites, change photos, or publish anything.

## Architecture inspection
- `db/schema.ts`: `attorneys` table contains identity, status, contact and official source fields; `attorneyProfiles` contains bio, practice areas, website and photo key.
- `app/admin/page.tsx`: owner admin navigation includes existing approval workflows.
- `package.json`: Next.js/React, Drizzle SQLite, Cloudflare/Vinext; node:test is already used.

## Next integration steps (require review)
1. Add dedicated enrichment proposals and scan-run tables via a reviewed migration, with immutable source URLs, observed timestamps, original values, candidate values, confidence, and image license evidence.
2. Add owner-only, authenticated proposal queue and approve/reject endpoints. Approval must re-check the current row version, never overwrite claimed/owner-edited fields silently, and audit every decision.
3. Add bounded, read-only database scan with credentials restricted to SELECT; no secrets in GitHub logs or artifacts.
4. Implement source-specific research adapters only for permitted sources, honoring terms, robots directives, rate limits and privacy preferences. Never bypass CAPTCHAs.
5. Image pipeline must verify attorney identity and reproduction rights. Crop, resize, sharpen gently without altering identity; stage privately and never publish before approval.
6. Add retry/backoff, idempotency keys, scan limits (pilot 25 records), observability and tests before enabling any production connections.

## Scheduling
GitHub Actions cron runs in UTC and may be delayed. Two UTC triggers plus a timezone gate target 00:00 America/New_York across DST. Only the default branch schedule is active after merge; this feature branch does not trigger production scheduling. No deployment has occurred.

## Safety
No production credentials, no DB mutations, no automated publication, no live site changes. All proposed future enrichment requires explicit owner approval.
