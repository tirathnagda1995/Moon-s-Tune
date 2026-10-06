# Deploy World V2

## Release boundary

Development branch: `codex/v2-world-pulse`. V1 rollback: `1104ea10c33c50aa4d720c4ff4412a68168a7f8a` on `master`. V2 is a local verified commit, not a hosted deployment or primary-branch push. Review this branch before selecting it for deployment.

## Exact owner steps

1. Create a dedicated Supabase project or use the existing dedicated V1 project. Back up existing data before schema changes. Never re-run migration 001 on an existing V1 database.
2. For a fresh project, execute `supabase/migrations/001_moon_pattern.sql`, then `002_world_moments.sql`, then `003_media_bucket.sql` in the Supabase SQL Editor. For an existing V1 project, execute only 002 and 003, in that order. These are ordered one-time migrations, not idempotent reset scripts.
3. Verify Storage bucket `moment-quarantine` is **private**, accepts only `image/webp`, and has no client read/write policies. It is deliberately used for pending and approved media; only the server proxy can serve approved, unexpired rows.
4. Configure Supabase email authentication, production SMTP, email rate limits and bot protection. Add the deployment origin to the redirect allowlist and set the Site URL. Use a staging project for test users.
5. Import the repository into a Node-compatible Next.js host (Vercel supported). Select `codex/v2-world-pulse` as the preview branch; keep the existing production branch unchanged. Node 24, install `pnpm install --frozen-lockfile`, build `pnpm build`; use the Next.js framework preset. No static-export setting.
6. In the host's secret settings configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` and a random `CRON_SECRET`. Public variables are build-time values. Rebuild after changing them. Do not commit local environment files.
7. Configure a vetted HTTPS moderation webhook using `MODERATION_URL` and `MODERATION_API_KEY`, or operate manual review as described in [CONTENT_MODERATION.md](CONTENT_MODERATION.md). Without moderation credentials submissions stay pending. Missing credentials never auto-approve content.
8. `vercel.json` schedules authenticated `GET /api/maintenance` daily at 03:00 UTC. Vercel supplies the configured `CRON_SECRET` bearer. On another host schedule the same request with `Authorization: Bearer <server secret>` using its secret manager; do not put the literal secret in source. Run more frequently as volume grows. Each call expires rows, drains up to 100 object deletions, and stores versioned pulse snapshots. Monitor non-200 responses and queue age; run again to drain a backlog.
9. Complete the hosted smoke checklist below, then invite real beta contributors. Publish no seeded contributors, artificial engagement or fabricated atmosphere labels.

Optional private AI: use the existing `LLM_PROVIDER=openai-compatible`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` configuration after reviewing provider retention. This is independent of public moderation. Guest/private use requires none of these services.

## Hosted smoke checklist (requires owner credentials)

- Guest reads approved live content without logging in; empty cities show empty states.
- Sign in to two staging accounts. Submit feeling-only, photo and caption contributions with explicit city/global consent. Check pending isolation before review.
- Review one sanitized photo and approve it; verify global/city routing, no identity in public JSON, WebP response, no metadata and no direct bucket access.
- Confirm original-language captions remain untouched. A malicious SVG/executable and oversized media are rejected.
- Create three distinct reports and confirm quarantine; manually re-review. Verify Same Tide toggles and quotas.
- Verify an owner can delete their Moment and another account cannot; verify account deletion removes owned public rows and enqueues media cleanup.
- Backdate a staging Moment beyond 48 hours using the SQL Editor, confirm feed/media denial, invoke maintenance and confirm physical object removal.
- Repeat V1 cloud privacy/RLS/consent/export/AI checks from the original deployment document with staging accounts. Hosted Auth email delivery, storage policies and cron delivery were not exercised by local tests.

## Rollback and retention

Redeploy V1 commit `1104ea10c33c50aa4d720c4ff4412a68168a7f8a` if necessary. Leave additive public tables intact; do not drop user data. Keep the V2 cleanup worker running (or an equivalent trusted job) while public media exists. RLS expiry remains effective independently of the UI and scheduler. A rollback cannot revoke copies people already downloaded. Establish and disclose backup/provider retention; active deletion is not a promise of immediate deletion from backups.

## Verification commands

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm typecheck
pnpm test:e2e
node scripts/check-client-secrets.mjs
```

Use HTTPS in production. The image processor requires the Node runtime with Sharp; do not move it to an Edge runtime. Keep body limits at least 4 MB and request timeouts sufficient for the 15-second moderation timeout. Do not enable request-body logging or session replay.
