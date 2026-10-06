# Public content moderation

## State machine

Every submission is created `pending`. Only the service-role `review_world_moment` function can change it to `approved`, `rejected` or `pending`. A successful trusted provider review can approve it; missing configuration, timeout, malformed response or a failed approval write leaves it pending. Pending/rejected content is invisible to other users and media readers. Authors can see submission status and delete it in Me → Memories.

Three distinct authenticated reports quarantine a currently approved Moment. Duplicate reporters do not count twice. Reporting and Same Tide have account quotas. No comments, DMs, followers, popularity counts or open messaging exist. Public authors are anonymous to readers, but the operator retains an account mapping for moderation/deletion; this is not anonymity from the operator.

## Provider contract

Configure an operator-controlled, vetted HTTPS endpoint in `MODERATION_URL` and its bearer credential in `MODERATION_API_KEY`. The server POSTs JSON with `schemaVersion: 1`, `caption`, nullable `feeling`, nullable `image: {mime: "image/webp", base64: "..."}` and a policy instruction. The image is the stripped, resized derivative, never the original upload. Treat all content as untrusted data; do not let it issue provider instructions.

The exact accepted response schema is:

```json
{ "decision": "pending", "version": "policy-1" }
```

`decision` must be `approved`, `rejected` or `pending`; version must be a nonempty string up to 50 characters; extra keys are rejected. Timeout: 15 seconds. Response limit: 3,000 characters. The provider must review the complete caption AND image for sexual exploitation, sexual content involving minors, explicit violence, hateful abuse, identifying information, exact location, private health disclosure and spam. Uncertain content remains pending. A language model returning the right JSON shape is not evidence of reliable moderation: evaluate policy performance, languages and privacy/retention before launch.

Deterministic protections independently enforce authentication, explicit public intent, strict payload fields, bounded captions, city catalog membership, input/body limits, image signatures, decode limits and rate limits. These do not replace semantic moderation. Faces/addresses visible in pixels are not removed by EXIF stripping.

## Manual moderation without a provider

Use the Supabase dashboard with an authorized operator account. Review pending rows from `public_moments`, their related reports and the sanitized object in the private bucket. Do not publish the bucket or distribute permanent object URLs. Keep review access limited and audited. Never download real-user material into this repository.

After reviewing a specific row, run this in the privileged SQL Editor, substituting its UUID and the reviewed decision:

```sql
select public.review_world_moment(
  '<moment UUID>'::uuid,
  'approved',
  'manual-operator',
  'policy-1'
);
```

Use `rejected` for disallowed material, `pending` to quarantine. Unreviewed, expired or uncertain content must not be approved. The function refuses missing/expired rows and adds a moderation record. Do not give the service-role key to browser users. No public admin UI is exposed.

## Retention, removal and operations

Public visibility lasts at most 48 hours from submission, including time spent pending. Moderation does not reset the clock. RLS and the media proxy deny expired/deleted content without waiting for cron. Account deletion removes public content; media paths enter a durable deletion queue. Maintenance drains 100 objects per call; failed batches remain retryable. Monitor pending review age, deletion queue age and report volume. Increase cleanup frequency/capacity before growth.

The daily account limits are 5 submissions, 20 reports and 100 reaction operations, reset at UTC midnight. Rejected/invalid media after a valid submission quota claim still consumes an attempt. Account-farm and network attacks need host edge limits and Supabase abuse controls; this implementation does not claim comprehensive abuse prevention.

Before public beta, appoint an operator, establish escalation and appeal/contact procedures appropriate to the markets served, vet the provider, test removal and define provider/backup retention. Face blurring and automated PII redaction are future work, not advertised functionality.
