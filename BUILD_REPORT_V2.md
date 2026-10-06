# V2 build report

World is now the primary consumer experience. The existing V1 repository was extended on `codex/v2-world-pulse`; it was not rebuilt from scratch. V1 rollback remains `1104ea10c33c50aa4d720c4ff4412a68168a7f8a` on `master`.

## Delivered

- A warm editorial World home, 66 searchable cities, local city clocks, city headers and live/preview modes.
- 64 curated daily prompts rotating at UTC midnight, and the shared-question discovery module.
- Private-by-default Add Moment with feeling, optional photo/caption, explicit city/global visibility and authenticated public posting.
- Separate encrypted local private Moments with unlock/export/deletion, integrated into Me → Memories. V1 check-ins, notes, consents, revisions, history, account architecture, offline guest behavior and Patterns are preserved.
- Public backend with strict validation, pending/approved/rejected moderation, anonymous approved reads, cursor pagination, account quotas, reporting, Same Tide, author removal, account cascades and 48-hour expiry.
- Metadata-free optimized WebP uploads in a private bucket; an approved/unexpired media proxy; queued physical deletion and authenticated scheduled maintenance.
- Conservative 24-hour city atmosphere: one latest contribution per account/city, minimum 20 contributors, suppression below 20 values in each dimension, transparent coverage and versioned snapshots. No unsupported city-wide or causal claims.
- Story-format share cards for World/city/prompt/collection; separately consented personal Pattern downloads.
- English resources, labelled Hindi/Arabic preview fallbacks, original-language captions, RTL, keyboard dialogs, mobile navigation, 320px overflow checks and reduced-motion styling.
- Updated required architecture/security/product/deployment documents, isolated additive migrations and source-controlled visual evidence.

## Verification

| Check                                       | Result                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ESLint                                      | Pass, zero errors/warnings                                                               |
| TypeScript (`next typegen`, `tsc --noEmit`) | Pass                                                                                     |
| Unit/API/PostgreSQL tests                   | 53 passed in 6 files                                                                     |
| Chromium production browser journeys        | 9 passed, including all 4 preserved V1 scenarios                                         |
| Production build                            | Pass; 79 static pages generated, 66 city paths plus dynamic APIs                         |
| Client secret-canary scan                   | Pass; service/AI/moderation/cron references and canary absent from client static bundles |
| Repository secret-signature scan            | No candidate credentials found; `.env.example` values empty; no local env files included |
| V1 foundation preservation                  | Migration 001, crypto, storage, domain and provider modules unchanged                    |

See [TEST_REPORT_V2.md](TEST_REPORT_V2.md) for coverage and its limits. A local review is not an independent security audit or proof of hosted provider behavior.

## What works now versus hosted dependencies

**Works without credentials:** World/city browsing, search, local clocks and lunar context, deterministic daily prompts, clearly labelled fictional preview, private guest check-ins, local encrypted private Moments, private history/export/deletion, supported offline guest flows, public-context share downloads and consent-gated personal insight downloads when sufficient history exists.

**Implemented and locally tested, requires hosted configuration:** real public feeds/submissions, Supabase sign-in and cloud private check-ins, private object storage, moderation, report/reaction persistence, account deletion and scheduled cleanup. No real accounts, private journals or public posts were imported into a live backend during development.

**Future interfaces/foundations only:** trusted weather/news/events, caption translation, body-cycle collection, wearables, durable cross-session analytics/retention dashboard and billing. No fake provider data is shown. Event diagnostics currently count names in memory only, without content or identity. The shared-prompt module shows up to six recent matching answers; more advanced diversity ranking is deferred. Private Moments are device-local; they do not claim cloud sync.

## Visual evidence

All screenshots use empty or explicitly fictional/sample test data. Existing V1 screenshots remain untouched.

- [World live empty state](artifacts/v2-world-live.png)
- [World product preview](artifacts/v2-world-preview.png)
- [Tokyo city preview](artifacts/v2-city-tokyo.png)
- [Add Moment, private default](artifacts/v2-add-moment.png)
- [320px World](artifacts/v2-world-mobile.png)
- [320px Arabic RTL preview](artifacts/v2-world-rtl.png)
- [Private desktop](artifacts/v2-private-desktop.png)
- [Private mobile](artifacts/v2-private-mobile-320.png)
- [Private RTL](artifacts/v2-private-rtl-320.png)
- [Generated share PNG](artifacts/v2-share-card.png)

City illustrations were generated with the built-in ImageGen tool. The asset, disclosures and generation brief are in [public/world/ASSETS.md](public/world/ASSETS.md); these are fictional illustrations, never current city photographs or real contributors.

## Owner/deployment handoff

Follow [DEPLOYMENT_V2.md](DEPLOYMENT_V2.md) in order: dedicated Supabase project → additive migrations 002/003 (001 only on a fresh project) → private bucket → Auth/SMTP → host environment → moderation/manual review → authenticated cleanup → hosted smoke test → real beta contributors.

Required hosted values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET`. Optional automated review: `MODERATION_URL`, `MODERATION_API_KEY`. Existing optional private AI variables remain independent. All example values are blank.

This delivery creates a local V2 commit. It does not merge, push to `master`, deploy a site or claim a populated live community. The final response records the exact resulting commit SHA; `git rev-parse HEAD` on this branch retrieves it. The deployment guide includes the V1 rollback procedure without dropping V2 user data.
