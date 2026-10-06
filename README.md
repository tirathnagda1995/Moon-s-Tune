# Moon Pattern

Discover the patterns within. A privacy-first daily check-in app with a working credential-free guest experience and optional Supabase accounts and AI interpretation.

**Start with [BUILD_REPORT.md](BUILD_REPORT.md) for delivery status and [DEPLOYMENT.md](DEPLOYMENT.md) for launch steps.**

## Run

Requires Node.js 24 and pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. All environment values may remain empty for the guest experience. Guest data is real user data stored in this browser, not seeded or simulated data. No login is necessary. Optional notes need a user-held passphrase of at least 12 characters; losing it means losing access to the notes.

```sh
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm start
```

Production builds require no API credentials, external fonts, image services, or weather provider.

## Product

- Two-stage onboarding with separate core processing permission.
- Fast mood and energy capture, with optional stress, sleep, focus and body controls.
- Optional journal retention with AES-256-GCM; no passphrase persistence.
- Optional authenticated AI interpretation, per-entry opt-in, editable canonical signals and confidence.
- Short local reflections, explicit urgent-language routing, yesterday continuity.
- Calendar, day cards, correction history, private note unlocking, note/day/history/account deletion, JSON export.
- Weekly/monthly summaries; conservative exploratory weekday, sleep and lunar comparisons.
- Locally calculated lunar phase, illumination, age and next full/new Moon.
- English resources, Hindi/Arabic preview overrides, fallback hierarchy and RTL layout.
- Offline guest PWA shell; cloud changes require connectivity and are never queued silently.

## Code map

`src/components`: responsive UI and procedural lunar illustration. `src/lib`: domain, deterministic analytics, crypto, provider interfaces, storage and server boundaries. `src/locales`: static UI resources. `src/app/api`: authenticated AI and account deletion. `supabase/migrations`: normalized private/cloud schema, append-only revisions and RLS. `tests`: unit, embedded PostgreSQL and Playwright suites.

Research and architecture references: [Next.js App Router](https://nextjs.org/docs/app/getting-started), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Astronomy Engine](https://github.com/cosinekitty/astronomy). No third-party product assets were copied.
