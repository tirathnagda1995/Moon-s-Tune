# Deployment

## Minimal launch: guest mode

1. Put this directory in your own Git repository and import it into Vercel as a Next.js project. No remote repository was supplied and no deployment was published during this build.
2. Select Node.js 24. Use `pnpm install --frozen-lockfile` as the install command and `pnpm build` as the build command. If the host does not recognize pnpm 11, enable Corepack or use `corepack pnpm install --frozen-lockfile` / `corepack pnpm build`.
3. Deploy. No service credentials are needed for guest mode. Set `APP_URL` to your exact HTTPS production origin, e.g. `https://moon.example`, then redeploy.
4. Add your domain in Vercel, apply the displayed DNS records and wait for HTTPS provisioning. HTTPS is required for Web Crypto and service workers.

## Accounts and optional AI (usually 15–30 minutes excluding account/DNS provisioning)

1. Create a Supabase project in the intended data region. Save its database password securely outside this repository.
2. Run **all of** `supabase/migrations/001_moon_pattern.sql` once in its SQL editor. It expects a fresh application schema with Supabase Auth available. Do not run this migration in a shared project: it deliberately revokes broad public-table client grants.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel. The service-role key is needed for the account deletion button. Never launch account mode without it.
4. In Supabase Auth, enable email sign-in, configure a production SMTP service, set the Site URL and allow-list the exact deployed origin as a redirect. Built-in email delivery is suitable for initial validation, not assumed sufficient for consumer launch. Protect sign-in with Supabase's rate limits and abuse controls.
5. For AI, set `LLM_PROVIDER=openai-compatible`, `LLM_MODEL`, `LLM_API_KEY`, and, if needed, `LLM_BASE_URL`. Use a provider with a documented JSON mode and chat-completions-compatible endpoint supporting `max_completion_tokens`. Choose a multilingual model after evaluating the intended launch languages. Review that provider's retention contract. No paid provider calls were made in development.
6. Redeploy after changing public environment variables: these are compiled into the client. Use the public origin, not a preview URL, for `APP_URL`; preview environments need their own origin.
7. Open Settings → email a sign-in link. Open the link in the same browser. Confirm core permission for the cloud space. Guest and cloud spaces are separate; guest data is never silently uploaded.

## Credential-dependent release verification

These checks require your accounts and were not represented as live-tested:

- Sign in with two different emails. Save distinct entries. Confirm isolation via the app and Supabase JWT clients. Embedded PostgreSQL isolation tests already pass, but this validates deployed roles/configuration.
- Save an encrypted note, sign out, sign in on another device, and unlock using the same passphrase.
- Opt into one AI entry; review/correct values; try Hindi, Gujarati and mixed-language inputs with the selected model. Check server logs contain no journal text. Confirm denied consent prevents processing.
- Download the export. Delete a note, a day, history, then a disposable test account. Verify cascading deletion and expired session behavior.
- Test iOS Safari and Android install flows on real devices. Chromium desktop, 320px and RTL are automated locally.
- Confirm region, backups, recovery policy, SMTP, billing limits and uptime alerts. Publish operator identity/contact and applicable terms/privacy notices before accepting public users; the bundled privacy page is a technical summary, not legal certification.

## Operation

No weather, payment, wearable, news or analytics keys are required. Those integrations are intentionally inactive. The service worker only caches the static application shell and hashed static assets, not APIs, account responses or journal records. Guest exports are backups; there is no import UI in V1. Preserve exports and passphrases before clearing browser storage.

Deploy database migrations before app code. Keep the prior app deployment available for rollback; do not roll back by deleting user tables. Use reviewed additive follow-up migrations. Hosted backups may retain deleted data until their retention period expires; never promise instant erasure from backups.
