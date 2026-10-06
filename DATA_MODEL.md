# Canonical data model

The conceptual key is PERSON × TIME × PLACE × ENVIRONMENT × PHYSIOLOGY × BEHAVIOR × PUBLIC CONTEXT × ASTRONOMY × SELF-REPORTED STATE. V1 captures only intentionally supported dimensions.

| Boundary        | Storage               | Purpose                                                                                    |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Identity        | Auth + profiles       | Auth UID to random person UUID; region and preferences                                     |
| Observation     | daily_observations    | Current day snapshot; one per person/local date; optimistic revision                       |
| Audit           | observation_revisions | Append-oriented non-text snapshots; never reinterpreted silently                           |
| Private Vault   | private_journals      | AES-GCM envelope only; no historical ciphertext copies                                     |
| Signals         | derived_signals       | Immutable signal IDs, canonical value/unit, confidence, source, provenance, effective time |
| Corrections     | user_corrections      | Supersession edge; user experience is authoritative                                        |
| Lunar           | lunar_context         | Deterministic ephemeris context and calculation version                                    |
| Environment     | environment_context   | Nullable weather/air/daylight fields; unused without provider                              |
| Patterns        | pattern_results       | Future persisted results with version/evidence; V1 calculates on device                    |
| Consent         | consents              | Purpose-specific grant/withdrawal; server time/version/region                              |
| Provider ingest | health_measurements   | Authorized canonical measurements; not high-frequency raw streams                          |
| Public context  | event_context         | Future sourced public events; no synthetic events                                          |
| Commerce        | plans + entitlements  | Capabilities, no hard-coded prices; billing disabled                                       |

Canonical dimensions: emotional_valence, emotional_intensity, energy_arousal, stress_tension, calmness, cognitive_clarity, focus, physical_vitality, social_connectedness, restfulness, motivation. V1 values are **ordinal 1–5 responses**, not physiological measurements or a universal score. Missing dimensions are omitted and interpreted as unknown, not zero. Stored records include language without translating the original journal for analytics.

Source types: SELF_REPORTED, DEVICE_MEASURED, USER_CORRECTED, ENVIRONMENTAL, ASTRONOMICAL, EXTERNALLY_OBSERVED, MODEL_INFERRED, DERIVED_STATISTICAL. Effective-value reduction gives user corrections priority over later model guesses. Clearing a dimension removes it from the current snapshot but preserves the historical signal/revision; deletion erases that history too.

A signal carries stable UUID, dimension, value, unit, confidence, source type/source, measurement timestamp, local date, timezone, quality flags, schema and derivation version. AI source metadata includes configured provider, model and prompt version. Confidence 1 on a self-report records source authority, not scientific certainty. Provider model labels may point to evolving models; an immutable model revision is only possible when supported by the selected provider.

Time is not universally daily: future measurement interfaces support instantaneous, 5-minute, hourly, sleep/workout-session, daily, weekly, monthly, lunar-cycle, seasonal and yearly windows. Preserve the user's capture timezone and local date; historical records do not move when the user travels. HRV RMSSD and SDNN remain distinct measurements. Never infer a watch measures blood pressure because a platform supports that type.

AI never calculates patterns. Comparisons use one current observation per day, dimension-specific sample sizes and per-person baselines. Differences are response-scale points, not misleading percentages on an arbitrary ordinal origin. At least 7 in-group days, 14 comparison days and 3 independent weeks/cycles are required for an exploratory effect. These are product evidence gates, not significance tests. No causal or confirmed statistical claim is made. Missingness, confounders, multiple comparisons and untested replication remain explicit.
