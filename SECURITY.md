# Security review

## Implemented and tested

- Client-side authenticated encryption, random IV/salt, entry-ID binding, wrong-passphrase rejection and Unicode round trips.
- Supabase Auth bearer validation using `getUser`; account deletion never takes a user-supplied account ID.
- RLS on all public tables. No anonymous private-table privileges. Clients have read-own grants and delete-own observations; validated SECURITY DEFINER RPCs perform atomic writes. Functions use explicit search paths, check auth.uid and ownership, and are not executable by PUBLIC.
- Embedded PostgreSQL tests execute the actual migration with two authenticated roles and an anonymous role. Cross-user reads, vault access, overwrites and deletions are exercised. Correction/revision retention and cascades are tested.
- Durable database AI rate limit (20/day/user), current optional-AI consent, bounded input, strict Zod schema, enum-only canonical dimensions, integer 1–5 values, confidence bounds, duplicate rejection, provider timeout and output-size limits.
- Journal content is an untrusted user message, never concatenated into system instructions. No tools are exposed to the LLM. Invalid output is rejected. Human correction wins.
- Origin validation on mutating routes. Set APP_URL to the canonical HTTPS origin behind proxies. Auth is an explicit Authorization header, not a cross-site ambient cookie.
- React text rendering; no `dangerouslySetInnerHTML`, raw SQL interpolation of user data, prompt logging or third-party analytics.
- Security headers: no framing, no sniffing, no referrer, no camera/geolocation/microphone access; CSP restricts connections to same-origin and Supabase. Browser keyboard dictation remains an OS feature.
- Service worker bypasses APIs and external origins. Encrypted notes and account responses are not put in HTTP caches.

## Deliberate limitations

This is an internal engineering review, not an independent penetration test or a compliance certificate. RLS is tested with PostgreSQL semantics and a Supabase-compatible auth shim; hosted Supabase Auth email delivery and deployed roles still need the credential-dependent smoke test.

CSP permits inline scripts/styles required by the static Next.js shell; a nonce/hash policy is a future defense-in-depth improvement. It disallows unsafe-eval in production. No server-side HTML is generated from user text. A malicious deployed client script could still steal a vault passphrase: no zero-knowledge claim is made.

Account email abuse is controlled by Supabase configuration; the deployment owner must enable production SMTP, rate limits and appropriate bot protection. AI quotas limit authenticated users, not account-farm abuse. Add edge-level abuse controls before large public acquisition campaigns. No wearable or research ingestion is active.

The local conservative urgent-language rule recognizes specific explicit English phrases. The optional model may support more languages, but neither is a comprehensive risk detector or emergency service. Never market the product as medical monitoring.

Use a dedicated database project. The initial migration revokes broad public-schema table grants to prevent accidental client write access. Do not apply it indiscriminately to a shared application database.

## Secrets and operations

Only Supabase public URL/anon key reach client bundles. LLM and service-role keys are referenced in server modules only. `.env*` is ignored except the empty example. Do not add session-replay tools, request-body logging or prompt traces. Never publish real-user browser test traces.

Rotate a leaked provider/service key, revoke sessions if warranted, inspect metadata-only access logs, notify affected users according to the incident plan, and restore only after understanding the breach. Enable managed backups/PITR, test restore into an isolated environment, and document retention. Deletion from active tables does not guarantee immediate removal from backups.
