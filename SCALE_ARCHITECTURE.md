# Scale architecture

This V1 has not been load-tested to 10 million users. The schema and provider boundaries support evolution; they do not make one Supabase instance an unlimited platform.

## V1

One Next.js deployment, one regional Supabase/Postgres project, browser guest IndexedDB and client-side personal analytics. Stable UUIDs, person/date and measurement indexes, immutable signal provenance, encrypted private vault, purpose-specific consent and independent identity mapping. AI is a bounded synchronous request with timeout and atomic daily quota. No Kafka, warehouse or unnecessary microservices.

Likely first bottlenecks: unpaginated per-person observation RPC, revision volume, JSON payload duplication, client analytics CPU, provider latency/quotas and database connections. The current observation RPC returns a per-person JSON aggregate without a row-page cap. Ledger and consent exports paginate until exhausted, including when the project's API limit is below 1,000 rows. Large longitudinal histories still need streaming exports and cursor-based observation loading to bound memory. Exports should be taken while no other device is editing; they are not a cross-table database snapshot.

## 100K users

Measure actual active-user write/read rates before scaling. Add keyset pagination by `(person_id, local_date, id)`, background deterministic summaries, connection pooling and cursor-based full exports. Move derived pattern recalculation off the interactive write path through an outbox table and idempotent workers. Cache only non-sensitive public ephemeris/weather; personal cache keys include person and revision with short TTL and explicit invalidation. Do not cache decrypted journals. Separate background workloads from login/check-in availability.

## 1M users

Partition large append signal/revision tables by measured/created month, with composite partition-safe identifiers and person/time indexes. Existing logical stable IDs remain; introduce new physical tables via additive migration and dual-write/backfill validation rather than destructive redesign. Consider tenant hash subpartitioning after measuring skew. Keep the private vault out of analytical replicas. Use queues with per-provider quotas, retry/backoff, idempotency keys and dead-letter handling. Normalize wearable input in short-retention raw storage, aggregate before canonical insertion, then expire raw streams.

Replicate approved structured signals via CDC/outbox into a columnar analytical store (selection based on actual queries, residency and cost). Keep transactional truth in Postgres; derived stores must obey deletion/tombstones and consent changes. Materialize per-person baselines and versioned candidate statistics. Audit population access separately.

## 10M users

Regional routing, regional identity mappings and consent-aware ingestion; keep journals, keys and sensitive signal data in permitted regions. Shard transactional ownership by stable person routing with explicit migration orchestration. Warehouses/time-series infrastructure handle analytical volume; ordinary app tables do not retain billions of high-frequency watch samples. Aggregate 5-minute/hourly/daily windows as justified by product need. Strong tenant isolation, least-privilege service roles, audited support access and per-region restore capacity become operational requirements.

## Observability and recovery

Measure error code/rate, route latency, queue lag, row/partition growth, job outcomes, cache hit rates and provider spend without journal text or full signal payloads. Use pseudonymous operational correlation IDs with short retention. Never enable session replay on the journal/vault.

Start with managed encrypted backups and PITR. Establish recovery point/time objectives based on paid service capabilities, then prove them in restore drills. At larger scale use isolated regional snapshots, tested failover and explicit replay watermarks. Apply erasure tombstones after restoring backups so deleted users are not resurrected. Record retention class, legal purpose and regional transfer decisions. Runbooks, on-call coverage and exercised disaster recovery matter as much as schema choices.

## V2 public feed and media

World/city reads use keyset pagination with 20 returned rows plus one lookahead, indexed by submission time/ID and city. Static catalog pages and labelled cover illustrations can use the host CDN. Original uploads are never retained; browser preprocessing and Sharp produce a single bounded WebP derivative. Public image responses deliberately use no-store through an RLS-gated private-storage proxy so expiry and moderation removals cannot be bypassed by a stale image cache. This prioritizes correct access over maximal CDN caching; tokenized CDN delivery needs tested purge/expiry semantics before adoption.

Pulse reads currently aggregate approved recent rows in Postgres and run on each feed request. Maintenance stores versioned snapshots, but reads do not yet use a materialized cache. At beta volume this is simple and auditable; profile before growth, move to scheduled/outbox-maintained snapshots and bound abuse at the edge. Same-prompt discovery currently displays up to six recent matching answers, with city/world feeds providing broader pagination; a diversity-ranked per-city selection is a next step.

The cleanup queue processes 100 objects per call and runs daily by default. Increase scheduling frequency or use an idempotent worker before that throughput is inadequate. Monitor queue age, pending age, failed batches, row counts and storage object orphans. RLS denies expired content even when physical cleanup is delayed. Operator/manual removal and fail-closed approval remain required during provider outages.

Analytics accepts an enumerated event name and increments in-memory diagnostic counters, without content, user ID, city ID, network transmission or persistence. `worldMetricSnapshot()` is a developer diagnostic. `product_daily_metrics` is a reserved service-only aggregate table; there is no active warehouse/retention collector or admin dashboard. Activation, D1/D7/D30 retention and cross-session metrics are intentionally not claimed. A reviewed consent-aware adapter can later populate a lightweight dashboard; do not infer metrics from the fictional preview.
