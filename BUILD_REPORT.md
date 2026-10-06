# Moon Pattern — build report

Delivered 5 October 2026. The repository contains a working V1 application and a deployable Next.js package. **No production deployment or third-party accounts were created.**

## What works

The complete guest journey works without credentials: privacy onboarding, independent emotional check-ins, optional encrypted journals, concise reflections, day cards, corrections, calendar history, weekly/monthly summaries, lunar context, exploratory patterns, feedback, export, and note/day/history deletion. The app opens and saves guest check-ins offline after initial loading. Original procedural Moon visuals, responsive desktop/mobile layouts and RTL are included.

Configured integrations are implemented: Supabase email-link authentication and isolated account storage; atomic versioned writes; encrypted cloud vault; consent-aware AI interpretation through a provider interface; server-validated account deletion. Guest and cloud spaces remain separate. Live provider calls and hosted authentication cannot be verified without owner credentials.

The schema includes independent canonical signals, immutable provenance/revisions, identity separation, purpose-specific consent, privacy retention fields, flexible temporal windows, weather/event/health interfaces and future plan capabilities. It does not reduce a person to a universal mood or health score.

## Verification

- ESLint and strict TypeScript checks pass.
- Optimized Next.js production build passes.
- 24 unit/integration tests pass, including the actual PostgreSQL migration, two-user RLS, anonymous rejection, encrypted-vault isolation, immutable revisions, consent withdrawal, durable quotas and account cascades.
- Four production-browser scenarios pass in Chromium: guest lifecycle/export; encrypted notes/wrong passphrase/deletion; unavailable AI/mobile 320px/RTL; offline saving and browser-error checks.
- Desktop and mobile screenshots were visually inspected. Screenshots are in `artifacts/`.
- Production dependency audit reports no known vulnerabilities at verification time.
- Client bundle inspection checks for server secret references and a synthetic server-secret canary.

See [TEST_REPORT.md](TEST_REPORT.md) for scope and evidence limits.

## Deliberate limits

English is complete; Hindi/Arabic are preview translations with English fallback. Other languages have a straightforward extension path, not fabricated complete translations. AI language/code-switching quality depends on the selected model and needs release evaluation. Keyboard dictation is the voice fallback.

Environmental data, wearable ingestion, news, traditional variables, population research, Ask My Patterns, payments and deep 100-day narratives are interfaces/roadmap, not active integrations. There are no fake controls or invented analytics. JSON import and automatic guest migration are deferred.

Notes use a passphrase the user must retain. The service cannot recover it, and the app is not advertised as zero-knowledge. Structured signals are not client-encrypted. Exploratory patterns are not causal conclusions or significance-tested discoveries.

Real iOS/Android installation, hosted email delivery, cross-device cloud use and live LLM behavior need credential/device checks. The product has not been independently security-audited or load-tested to millions of users. The privacy page is a readable technical summary; add the operator's identity, contact and applicable legal notices before public enrollment.

## Exact owner actions

For guest-only deployment: import the repository into Vercel, select Node 24, deploy and connect the domain. No API credentials are needed.

For account/AI launch:

1. Create a dedicated Supabase project and execute `supabase/migrations/001_moon_pattern.sql`.
2. Add the Supabase URL, public anon key and **server-only service-role key** to the deployment.
3. Configure Supabase email login, SMTP, Site URL and redirect allow-list.
4. Optionally provide the compatible LLM API key/model/base URL; AI requires authenticated accounts.
5. Set `APP_URL` to the canonical HTTPS origin and deploy. Connect the domain using Vercel's DNS instructions.
6. Run the short two-account/AI/deletion checklist in [DEPLOYMENT.md](DEPLOYMENT.md).

The hands-on setup target is under 30 minutes when accounts and DNS access are ready; account provisioning, domain propagation and legal/provider review can take longer.
