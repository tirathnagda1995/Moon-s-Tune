# Environment variables

`.env.example` contains blank values only. Copy it to ignored `.env.local` for development, or use the deployment host's secret manager. Never commit actual credentials.

| Variable                      | Exposure          | V2 purpose                                                                                      |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | Public build-time | Project HTTPS URL; accounts and live World reads                                                |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public build-time | Public API key; RLS enforces access                                                             |
| SUPABASE_SERVICE_ROLE_KEY     | Server secret     | Verified account deletion, public Moment creation/moderation, private media storage and cleanup |
| MODERATION_URL                | Server            | Vetted HTTPS moderation webhook; optional                                                       |
| MODERATION_API_KEY            | Server secret     | Moderation webhook bearer; absent configuration leaves pending                                  |
| CRON_SECRET                   | Server secret     | Bearer for GET /api/maintenance                                                                 |
| APP_URL                       | Server            | Canonical HTTPS origin for mutation checks                                                      |
| LLM_PROVIDER                  | Server            | `openai-compatible` enables optional private AI                                                 |
| LLM_MODEL                     | Server            | Explicit private interpretation model                                                           |
| LLM_API_KEY                   | Server secret     | Private AI provider authentication                                                              |
| LLM_BASE_URL                  | Server            | HTTPS compatible API root; default https://api.openai.com/v1                                    |

All empty: World empty states, labelled preview and local private use work. URL+anon enable hosted reads/auth after migrations. Always configure the service key when enabling accounts so account deletion and public media operations work. Public moderation is independent from private AI and its consent. Do not use an LLM key as a moderation key without a reviewed adapter implementing CONTENT_MODERATION.md.

There are no pretend weather/news/payment/wearable environment settings. Those integrations are not active. Only variables prefixed NEXT_PUBLIC reach browser bundles; never prefix secrets that way. Client-bundle checks include service role, AI, moderation and cron secret references.
