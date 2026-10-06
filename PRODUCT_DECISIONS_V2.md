# V2 product decisions

World earns curiosity before requesting contribution. The default route is a warm editorial city discovery page; Me retains the private system and Patterns retains its conservative exploratory analysis. The brand lives in `src/lib/world/brand.ts` for easy rebranding. No pricing or paywall was added.

## Decisions shipped

- Default live mode, honest empty states, explicit fictional preview. Four original AI illustrations are labelled as city covers, even in live mode; they never purport to show current weather or real posts. Preview cards are labelled individually and excluded from live counts/reactions.
- 66 stable launch cities across regions, accent-insensitive search and aliases, local clocks and coarse centroids. The schema is extensible; this is not a universal geocoder. Unknown searches invite another city rather than inventing a place or activity. Extend the catalog and seed it through a new migration/deploy.
- City cards and search replace a heavyweight map: curiosity and mobile speed matter more than a GIS view. Active cities sort by real contributor counts when available.
- One prompt per UTC day, 64 reviewed strings. The same ID is independently derived on server and client; PostgreSQL assigns it at submission time. Version the library; do not reorder deployed IDs casually. The UTC convention is explained in the UI rather than pretending every city has the same local date.
- Private is the default. Public city/global consent is separate and explicit. City visibility means any reader of that city's page, not a location-verified audience. City-only content stays out of global discovery but is still public and searchable through city views.
- Account creation is deferred until public posting/reaction/report or optional cloud persistence. Public posting has basic account quotas and moderation; guest exploration and local private use remain free.
- Caption/photo retention in private Moments uses V1 encryption, a separate local store and account/guest scope. Structured feeling/city metadata is readable locally. Private Moments are device-local, including while signed in; V1 private check-ins support existing cloud sync. There is no silent guest-to-account migration.
- 48-hour public lifetime; 24-hour pulse window; latest contribution per account/city; minimum 20 contributors and 20 values per disclosed dimension. Atmosphere describes participating contributors only. It cannot assert city-wide happiness, abnormal conditions, weather causes or trends without evidence.
- No generated city narrative that invents causes. Instead, show the supported atmosphere label, count, window and coverage disclaimer. Lunar phase remains factual context and never a causal mental-health claim.
- Same Tide expresses relating without public popularity counts. Reports from three distinct users quarantine. No comments/DMs/followers.
- Share PNGs are 1080×1920. World/city/prompt/collection cards use public context only. Personal Pattern cards require reviewing the exact summary and an explicit checkbox, and contain no raw notes, photos, identity or check-in dates.
- English is complete; Hindi/Arabic are labelled preview overrides with English fallback. User captions remain original-language `dir=auto`; translation has an interface but no misleading Translate button.
- No fake weather/events or beta user activity. Trusted environment, event and wearable interfaces remain intact. Body-cycle schema is private and collection is disabled.

## Honest limits

This is a working V2 beta implementation with local verification, not a populated live network. Hosted auth/storage/moderation/cron need owner credentials and smoke testing. The internal event adapter counts event names only in memory; it does not send content or identifiers anywhere. Aggregate metric and pulse snapshot schemas are foundations, not a fabricated D1/D7/D30 dashboard. Durable consent-aware analytics and retention measurement require a later implementation. No automated face blur, universal city geocoder or billing integration is claimed.

## First-session review

A guest can understand World immediately, browse city pages, search Edmonton/Tehran and compare the labelled sample windows without registration. A feeling-only private Moment takes city selection, one feeling and Save; no explanation is required. Privacy copy remains next to visibility and media controls. The daily ritual and share cards create return/discovery paths without streak anxiety or notification pressure. Mobile discovery uses horizontal cards and a three-item bottom navigation.
