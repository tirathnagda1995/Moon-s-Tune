# V2 test report

Verified locally on 7 October 2026 (Asia/Kolkata), Node 24, Next.js 16.3.8, Chromium Playwright, embedded PostgreSQL via PGlite. External services were not configured with live credentials.

## Results

- `pnpm lint`: passed with zero warnings/errors.
- `pnpm typecheck`: passed (`next typegen` and `tsc --noEmit`).
- `pnpm test`: **53 passed across 6 files**.
- `pnpm build`: passed, with TypeScript compilation and 79 generated static pages, including 66 city paths.
- `pnpm test:e2e`: **9 passed** against the production server on port 3100.
- `node scripts/check-client-secrets.mjs`: passed after a production build with synthetic server-secret canaries for service-role, AI, moderation and cron keys.
- `git diff --check`: passed. Secret-signature scan of source-controlled candidates found no credentials. Empty `.env.example` retained; local environments/builds/dependencies/coverage excluded.

## Preserved V1 regression coverage

V1 tests continue to exercise encryption/wrong-key rejection, signal validation/provenance and corrections, consent withdrawal, canonical patterns/lunar calculations, server boundaries, actual PostgreSQL migration, private two-user RLS, anonymous private rejection, encrypted vault isolation, immutable revisions and account cascades. The original 001 migration and private crypto/storage/domain/provider modules remain unchanged.

The four browser scenarios are preserved, with only navigation updated to `/me` and the primary Patterns link, and new V2 screenshot filenames so V1 evidence remains intact. They cover save/reload/edit/history/export/erase, encrypted note unlock and note-only deletion, unavailable AI, 320px/RTL layout, browser errors and offline guest use.

## V2 domain, API and database coverage

- 64 unique curated prompts, once-per-UTC-day rotation and repeat interval.
- More than 60 searchable stable cities, accents/aliases, specified example cities and valid timezones.
- Distinct-contributor deduplication, 20-person threshold, low-dimension suppression, missing signals, stale/future observations and conservative labels.
- Strict explicit-public payloads; private-field rejection; moderation/expiry/global discovery gates; public share output has only allowed context; personal share requires explicit consent.
- Real Sharp processing: EXIF removed, maximum dimensions enforced, invalid signatures/executables/oversized inputs rejected.
- Missing/failed/malformed moderation stays pending; only a valid configured review response is accepted.
- Authenticated submission route with mocked external adapters: owner comes from verified token, pending creation, approval failure remains pending, metadata stripped before storage/moderation, no image bytes in public row payload, quota enforcement before storage, public-consent/private-field rejection and orphan cleanup on database failure.
- Real migrations 001/002 in embedded PostgreSQL: pending/ownership isolation, cross-user rejection, no client create/approve, approved guest reads, city-only global exclusion, expiry, reaction toggle, duplicate report handling, three distinct reports quarantine, aggregate sample coverage, atomic quotas, owner deletion and account/media cascades.
- Migration 003 against a storage-schema fixture: private bucket, WebP-only MIME list and 3 MB storage limit. This checks migration intent/syntax, not the hosted Storage service.

## V2 browser coverage

1. First session opens World without private onboarding, shows honest live empty state, switches to labelled preview, searches Edmonton and opens Tokyo.
2. Private feeling contribution defaults private, stays outside World, appears in Memories, exports and deletes.
3. Rejects SVG; processes a test PNG; stores caption/photo encrypted; requires explicit public consent; explains unavailable account service.
4. Share dialog discloses private exclusion and produces a valid PNG with preview labelling.
5. 320px World and Arabic RTL have no document overflow; Add Moment remains accessible by name; native dialog closes with Escape.

The final screenshot set in `artifacts/v2-*` was visually inspected for desktop/mobile city imagery, composition, cropping, private layouts, RTL and share-card output. Contrast was improved after review. Screenshots contain synthetic test text or labelled fictional content only.

## Limits and outstanding hosted checks

No production Supabase credentials, SMTP, real moderation provider, object storage endpoint or deployed scheduler was supplied. Hosted auth email delivery, Storage enforcement, real moderation accuracy, deployed cron/media removal and cloud user journeys still require the exact staging smoke procedure in DEPLOYMENT_V2.md. No external data was published during testing.

This is not a load test, formal WCAG certification, adversarial red-team exercise or independent penetration test. Browser automation uses Chromium; Safari/Firefox and assistive-technology user testing remain release-hardening work. Account farms, large deletion backlogs and arbitrary international PII require operational controls beyond these tests. Retention/activation analytics are not claimed because the current counters are session-local and content-free.
