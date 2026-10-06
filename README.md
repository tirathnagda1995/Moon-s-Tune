# Moon Pattern · World V2

See how the world feels today. Discover what moves you.

World is the new home: browse cities, see the shared daily question, explore ordinary anonymous Moments, then optionally contribute or enter your private space. V1's private check-ins, encrypted journals, corrections, history and Patterns remain underneath.

Start with [BUILD_REPORT_V2.md](BUILD_REPORT_V2.md), [TEST_REPORT_V2.md](TEST_REPORT_V2.md) and [DEPLOYMENT_V2.md](DEPLOYMENT_V2.md). The V1 reports remain as historical records.

## Run locally

Requires Node.js 24 and pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. All values can remain empty. World then shows honest live empty states, with an explicit **Product preview** switch for fictional illustrations and example captions. Nothing is presented as real community activity. Private guest check-ins and Moments work locally without credentials. Private Moment photos/captions require a user-held vault passphrase. Losing it loses access.

```sh
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
node scripts/check-client-secrets.mjs
```

Browser tests start their own production server on port 3100 after a build. Stop any process on that port first. `pnpm start` serves the application on port 3000.

## Working product

- World, Me, Patterns and Add Moment; guest exploration needs no onboarding.
- 66 searchable cities, local clocks, city pages, coarse city identity and accurate lunar context.
- 64 curated prompts, one shared UTC daily rotation; Same Moment, Different World.
- Private-by-default feeling/photo/caption contribution. Public city/global visibility is explicit and requires an authenticated account and separate consent.
- Public backend: moderated, cursor-paginated, anonymous reader access; 48-hour expiry; reporting; Same Tide; author deletion and account cascades.
- Safe static WebP processing with metadata removal; private object storage and approved/unexpired media proxy.
- Conservative contributor-only city atmosphere with 20 distinct contributors and 20 responses per disclosed dimension.
- PNG share cards for World, city, prompt and collection. Personal Pattern sharing requires an additional explicit checkbox and preview.
- V1 private workflows, encrypted local private Moments, export/deletion, optional account/AI connections and offline guest support.
- English resources, Hindi/Arabic preview fallbacks, RTL, keyboard dialogs and 320px layouts.

No public contributions or accounts were created in a hosted service during development. Configure Supabase, run the additive migrations and establish moderation before collecting public content. Weather, trusted events, translation, wearables and body-cycle collection are interfaces only; none is fabricated.

## Code and documentation

`src/components/world` holds the consumer experience. `src/lib/world` holds city/prompt/media/moderation/sharing boundaries. `src/locales/world` contains copy. Existing private modules remain in `src/lib`. `supabase/migrations/001_moon_pattern.sql` is unchanged; 002/003 add public entities and private media storage.

See [PRIVACY_ARCHITECTURE.md](PRIVACY_ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [DATA_MODEL.md](DATA_MODEL.md), [CONTENT_MODERATION.md](CONTENT_MODERATION.md), [PRODUCT_DECISIONS_V2.md](PRODUCT_DECISIONS_V2.md), [SCALE_ARCHITECTURE.md](SCALE_ARCHITECTURE.md), [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) and [V2_ROADMAP.md](V2_ROADMAP.md).

Original AI-generated fictional city illustrations and their generation brief are documented in [public/world/ASSETS.md](public/world/ASSETS.md). No competitor interface or assets were copied.
