# Environment variables

| Variable                      | Exposure          | Purpose                                                        |
| ----------------------------- | ----------------- | -------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | Public build-time | Supabase project HTTPS URL                                     |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public build-time | Public API key; security relies on RLS, not secrecy            |
| SUPABASE_SERVICE_ROLE_KEY     | Server secret     | Delete only the verified account via Auth admin API            |
| LLM_PROVIDER                  | Server            | `openai-compatible`; other values safely disable AI            |
| LLM_MODEL                     | Server            | Explicit multilingual model identifier                         |
| LLM_API_KEY                   | Server secret     | Provider authentication                                        |
| LLM_BASE_URL                  | Server            | HTTPS compatible API root; default `https://api.openai.com/v1` |
| APP_URL                       | Server            | Canonical HTTPS origin for mutation origin checks              |

All empty: guest mode works. URL + anon key: accounts activate. Always supply the service-role key when enabling accounts so deletion works. LLM credentials without Supabase do not expose a public paid inference endpoint: AI requires an authenticated user and the database consent/quota functions.

No environment variables are included for imaginary weather, payments or wearable functionality. Those providers have interfaces and schemas only. Do not add secrets with a NEXT_PUBLIC prefix. Public variables need a new deployment to change. Private values are not included in exports or logs.
