# Test report

Verification date: 5 October 2026. Tests use synthetic data only. Current suite: **24 unit/integration tests and 4 browser scenarios**.

## Automated checks

| Check               | Scope                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint              | App, server routes, tests and scripts                                                                                                                                                                                                                                                                                |
| TypeScript          | Strict app/API/domain/test type checks                                                                                                                                                                                                                                                                               |
| Production build    | Next.js optimized static pages and server routes; no external credentials needed                                                                                                                                                                                                                                     |
| Core unit tests     | AES-GCM/Unicode, fresh salts/IVs, incorrect password and observation binding; known new/full Moon fixtures; multi-year age/phase bounds; correction precedence; unknown fields; sample gates; effect magnitudes; duplicate days; date/timezone boundaries; locale fallback/RTL; conservative urgent-language routing |
| API tests           | Cross-origin rejection, no-credential AI fallback, deletion auth requirement, invalid provider responses, multilingual minimal extraction, bounded request bodies, proxy origin handling                                                                                                                             |
| Embedded PostgreSQL | Executes the actual migration; two-user read/write/delete isolation; anonymous rejection; vault access; append-only revisions; deleting note/history and cascades; consent grant/withdrawal; 20/day quota; Auth-account removal cascades                                                                             |
| Playwright Chromium | Onboarding → mood/energy → save → reload → correction → calendar → patterns → export JSON with revision ledger → history deletion                                                                                                                                                                                    |
| Playwright vault    | Private text absent from stored plaintext, wrong key error, successful unlock and note-only deletion retaining feelings                                                                                                                                                                                              |
| Playwright mobile   | Missing-AI state; 320px viewport; no horizontal overflow; Arabic RTL selection and controls                                                                                                                                                                                                                          |
| Playwright offline  | Production shell cached, offline reload, guest check-in saved; no page JavaScript errors                                                                                                                                                                                                                             |
| Dependency audit    | `pnpm audit --prod`: no known vulnerabilities returned at test time                                                                                                                                                                                                                                                  |
| Bundle check        | `node scripts/check-client-secrets.mjs`: no server key references or synthetic canary in static client artifacts                                                                                                                                                                                                     |

## Commands

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
node scripts/check-client-secrets.mjs
pnpm audit --prod
```

The secret-leak check also used a production build with a synthetic `moon-pattern-server-secret-canary` value for both server key variables. No real credentials were used.

## Visual review

`artifacts/desktop.png`, `artifacts/mobile-320.png` and `artifacts/rtl-320.png` were inspected. The desktop layout has a procedural phase-lit Moon and focused check-in; small screens use a vertical composition and fixed bottom navigation. Full-page screenshots capture the fixed navigation at its current viewport position; that is not a gap in page content. Reduced-motion CSS disables entry animation and transitions. Controls use labels, fieldsets and pressed state; exhaustive assistive-technology/contrast certification was not performed.

## Bugs found and fixed

- Proxy-origin mismatch rejected legitimate API requests: compare the configured public origin (or public Host fallback).
- Decorative energy marks polluted accessible button names: hide decorative glyphs from accessibility APIs.
- Next.js route announcer made broad alert test selectors ambiguous: target the app's visible error alerts.
- Clearing/changing AI input could leave stale suggestions: clear unaccepted suggestions while preserving user-entered/existing values.
- Guest revisions and exports needed explicit audit retention: add atomic observation/revision writes and export the ledger.
- Guest same-day writes from separate tabs needed collision protection: serialized IndexedDB transactions check the local date and revision.
- Export table limits could truncate historical ledgers: paginate to exhaustion, including projects with lower configured limits.
- Feedback could leave stale local revisions: refresh history after persistence.
- A successful save followed by failed refresh could appear unsaved: update the local view after confirmed persistence and report refresh failure separately.

## What these tests do not prove

PGlite executes PostgreSQL semantics with an auth.uid shim, not hosted Supabase's entire Auth/email/gateway stack. No real LLM call or real SMTP delivery was made. Model safety, multilingual extraction and code-switching need evaluation with the chosen provider. Provider mocks validate application contracts, not model intelligence. No Safari/Firefox/physical-device, large load, restore drill or independent penetration test is claimed. Credential-dependent release checks are in DEPLOYMENT.md.
