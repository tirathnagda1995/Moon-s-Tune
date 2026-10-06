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
