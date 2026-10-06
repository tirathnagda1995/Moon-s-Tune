"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Globe2,
  Share2,
  Plus,
  Compass,
  Flag,
  Waves,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { cities, cityById, searchCities, type City } from "@/lib/world/cities";
import {
  dailyPrompt,
  worldAnalytics,
  type PublicMoment,
  type Pulse,
} from "@/lib/world/domain";
import { worldMessages } from "@/lib/world/i18n";
import { direction, format } from "@/lib/i18n";
import { tokenHeaders } from "@/lib/world/client";
import { shareModel, renderShareCard, type ShareSpec } from "@/lib/world/share";
import { lunarContext } from "@/lib/lunar";
import { messages } from "@/lib/i18n";
import WorldHeader from "./WorldHeader";
import Scene from "./Scene";
import AddMoment from "./AddMoment";
import AuthDialog from "./AuthDialog";
import Dialog from "./Dialog";
type Cursor = { before: string; id: string } | null;
export default function WorldApp({ initialCity }: { initialCity?: string }) {
  const [locale, setLocale] = useState("en"),
    [preview, setPreview] = useState(false),
    [query, setQuery] = useState(""),
    [region, setRegion] = useState("all"),
    [add, setAdd] = useState(false),
    [auth, setAuth] = useState(false),
    [moments, setMoments] = useState<PublicMoment[]>([]),
    [same, setSame] = useState<PublicMoment[]>([]),
    [pulses, setPulses] = useState<Pulse[]>([]),
    [cursor, setCursor] = useState<Cursor>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(new Date()),
    [share, setShare] = useState<ShareSpec | null>(null),
    [report, setReport] = useState<string | null>(null),
    [reason, setReason] = useState<"privacy" | "harmful" | "spam">("privacy"),
    [related, setRelated] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false);
  const m = worldMessages(locale);
  const city = initialCity ? cityById(initialCity) : undefined;
  const prompt = dailyPrompt(now);
  const lunar = lunarContext(now);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreview(params.get("mode") === "preview");
    setAdd(params.get("add") === "1");
    setLocale(localStorage.getItem("mp-locale") ?? "en");
    const timer = setInterval(() => setNow(new Date()), 30000);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction(locale);
  }, [locale]);
  const load = useCallback(
    async (next: Cursor = null) => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams();
        if (initialCity) qs.set("city", initialCity);
        if (next) {
          qs.set("before", next.before);
          qs.set("id", next.id);
        }
        const r = await fetch("/api/world?" + qs);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setMoments((old) =>
          next
            ? [
                ...old,
                ...data.moments.filter(
                  (x: PublicMoment) => !old.some((y) => y.id === x.id),
                ),
              ]
            : data.moments,
        );
        setPulses(data.pulses);
        setCursor(data.next);
        if (!next) {
          const rr = await fetch("/api/world?prompt=" + dailyPrompt().id);
          if (rr.ok) setSame((await rr.json()).moments);
        }
      } catch {
        setError(worldMessages(locale).loadError);
      } finally {
        setLoading(false);
      }
    },
    [initialCity, locale],
  );
  useEffect(() => {
    void load();
  }, [load, prompt.id]);
  useEffect(() => {
    if (!preview) {
      worldAnalytics.track(city ? "city_opened" : "world_opened");
      worldAnalytics.track("daily_prompt_viewed");
    }
  }, [city, preview, prompt.id]);
  useEffect(() => {
    if (add) worldAnalytics.track("moment_started");
  }, [add]);
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => worldAnalytics.track("city_searched"), 500);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (preview) return;
    const observer = new IntersectionObserver(
      (items) => {
        for (const item of items)
          if (item.isIntersecting) {
            worldAnalytics.track("moment_viewed");
            observer.unobserve(item.target);
          }
      },
      { threshold: 0.5 },
    );
    document
      .querySelectorAll(".moment-card")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [moments, same, preview]);
  // Expiry is checked in the database and again in the active client view.
  const liveMoments = moments.filter((x) => new Date(x.expires_at) > now);
  const demos: PublicMoment[] = cities.slice(0, 4).map((c, i) => ({
    id: "preview-" + c.id,
    city_id: c.id,
    prompt_id: prompt.id,
    feeling: (["calm", "hopeful", "peaceful", "warm"] as const)[i],
    caption: m.demoCaptions[i],
    language: "en",
    visibility: "global",
    submitted_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 86400000).toISOString(),
    moderation_state: "approved",
    media_id: null,
    demo: true,
    cover: i,
  }));
  const feed = preview
    ? city
      ? demos.filter((x) => x.city_id === city.id)
      : demos
    : liveMoments;
  const promptMoments = preview
    ? demos
    : same.filter((x) => new Date(x.expires_at) > now);
  const featured = searchCities(query)
    .filter((c) => region === "all" || c.region.toLowerCase() === region)
    .sort((a, b) =>
      preview
        ? 0
        : (pulses.find((p) => p.cityId === b.id)?.sampleCount ?? 0) -
          (pulses.find((p) => p.cityId === a.id)?.sampleCount ?? 0),
    );
  const cityUrl = (c: City) => `/city/${c.id}${preview ? "?mode=preview" : ""}`;
  const time = (c: City) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: c.timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  function mode(value: boolean) {
    setPreview(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("mode", "preview");
    else url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);
    setNotice("");
  }
  async function react(moment: PublicMoment) {
    if (moment.demo) {
      setNotice(m.previewAction);
      return;
    }
    const headers = await tokenHeaders();
    if (!headers.Authorization) {
      setAuth(true);
      return;
    }
    try {
      const r = await fetch("/api/moments/react", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: moment.id }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.reacted) worldAnalytics.track("same_tide_reacted");
      setRelated((old) => {
        const next = new Set(old);
        if (data.reacted) next.add(moment.id);
        else next.delete(moment.id);
        return next;
      });
    } catch {
      setNotice(m.unavailable);
    }
  }
  async function openReport(moment: PublicMoment) {
    if (moment.demo) {
      setNotice(m.previewAction);
      return;
    }
    if (!(await tokenHeaders()).Authorization) {
      setAuth(true);
      return;
    }
    setReport(moment.id);
  }
  const renderMoment = (moment: PublicMoment, compact = false) => {
    const place = cityById(moment.city_id);
    return (
      <article
        className={`moment-card ${compact ? "compact" : ""}`}
        key={moment.id}
      >
        {moment.demo ? (
          <div className="moment-photo">
            <Scene index={moment.cover} alt={m.demoAlts[moment.cover ?? 0]} />
            <span className="image-label">{m.preview}</span>
          </div>
        ) : moment.media_id ? (
          <div className="moment-photo">
            <Image
              src={`/api/media/${moment.media_id}`}
              alt={format(m.publicPhotoAlt, { city: place?.name ?? "" })}
              width={700}
              height={470}
              loading="lazy"
              unoptimized
            />
          </div>
        ) : (
          <div className="word-moment">
            <span>“</span>
            <p>{moment.feeling ? m.feelings[moment.feeling] : m.noPhoto}</p>
          </div>
        )}
        <div className="moment-content">
          <div className="moment-place">
            <Link href={place ? cityUrl(place) : "/"}>
              {place?.name ?? moment.city_id}
              <ArrowUpRight size={13} />
            </Link>
            <span>
              {moment.demo
                ? m.preview
                : new Intl.DateTimeFormat(locale, {
                    timeZone: place?.timezone ?? "UTC",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(
                    new Date(
                      Math.floor(
                        new Date(moment.submitted_at).getTime() / 900000,
                      ) * 900000,
                    ),
                  )}
            </span>
          </div>
          {moment.feeling && (
            <span className={`feeling-tag feeling-${moment.feeling}`}>
              {m.feelings[moment.feeling]}
            </span>
          )}
          <p className="moment-caption" dir="auto">
            {moment.caption}
          </p>
          {moment.demo && <p className="moment-disclosure">{m.sample}</p>}
          <div className="moment-actions">
            <button
              aria-pressed={related.has(moment.id)}
              onClick={() => void react(moment)}
            >
              <Waves size={18} />
              {related.has(moment.id) ? m.related : m.sameTide}
            </button>
            <button
              aria-label={m.report}
              onClick={() => void openReport(moment)}
            >
              <Flag size={15} />
            </button>
          </div>
        </div>
      </article>
    );
  };
  const pulse =
    city && !preview ? pulses.find((p) => p.cityId === city.id) : undefined;
  return (
    <div className="world-app">
      <WorldHeader locale={locale} onAdd={() => setAdd(true)} />
      <main className="world-main">
        <div className="world-topline">
          <span>
            <span className="live-dot" />
            {new Intl.DateTimeFormat(locale, {
              weekday: "long",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            }).format(now)}
            <span className="utc-label">{m.utc}</span>
          </span>
          <div className="mode-switch" aria-label={m.viewMode}>
            <button aria-pressed={!preview} onClick={() => mode(false)}>
              {m.live}
            </button>
            <button aria-pressed={preview} onClick={() => mode(true)}>
              {m.preview}
            </button>
          </div>
        </div>
        {preview && (
          <div className="preview-banner">
            <Compass size={18} />
            <p>{m.previewNote}</p>
          </div>
        )}
        {notice && (
          <div className="world-notice" role="status">
            {notice}
            <button aria-label={m.close} onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {initialCity && !city ? (
          <section className="world-empty">
            <h1>{m.cityNotFound}</h1>
            <Link href="/">{m.notFoundBack}</Link>
          </section>
        ) : city ? (
          <>
            <Link
              className="back-world"
              href={preview ? "/?mode=preview" : "/"}
            >
              ← {m.back}
            </Link>
            <section className="city-hero">
              {city.cover !== undefined ? (
                <Scene
                  index={city.cover}
                  alt={m.demoAlts[city.cover]}
                  priority
                />
              ) : (
                <div className="city-no-cover">
                  <Globe2 />
                </div>
              )}
              <div className="city-hero-shade" />
              <span className="image-label">
                {city.cover !== undefined ? m.illustration : m.explore}
              </span>
              <div className="city-hero-copy">
                <span>
                  {city.country} · {time(city)}
                </span>
                <h1>{city.name}.</h1>
                <p>
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "long",
                    timeZone: city.timezone,
                  }).format(now)}
                </p>
              </div>
              <button
                className="city-share"
                aria-label={m.share}
                onClick={() =>
                  setShare({ kind: "city", cityId: city.id, preview })
                }
              >
                <Share2 size={21} />
              </button>
            </section>
            <section className="city-atmosphere">
              <div>
                <span className="world-kicker">{m.among}</span>
                <h2>{m.labels[pulse?.label ?? "insufficient"]}</h2>
                <p>
                  {format(m.coverage, {
                    count: new Intl.NumberFormat(locale).format(
                      preview ? 0 : (pulse?.sampleCount ?? 0),
                    ),
                  })}
                </p>
              </div>
              <p>{m.pulseNote}</p>
              <div className="city-moon">
                <span>{m.moon}</span>
                <strong>{messages(locale).phases[lunar.phase]}</strong>
                <small>
                  {new Intl.NumberFormat(locale, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(lunar.illumination)}{" "}
                  {messages(locale).illumination}
                </small>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="world-intro">
              <div>
                <span className="world-kicker">{m.brandTag}</span>
                <h1>{m.title}</h1>
                <p>{m.intro}</p>
              </div>
              <button
                className="share-world-button"
                onClick={() => setShare({ kind: "world", preview })}
              >
                <Share2 size={17} />
                {m.shareWorld}
              </button>
            </section>
            <div className="discovery-tools">
              <label className="city-search">
                <Search size={20} />
                <input
                  aria-label={m.searchLabel}
                  placeholder={m.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>↵</kbd>
              </label>
              <div className="region-filters">
                {(
                  [
                    "all",
                    "asia",
                    "europe",
                    "americas",
                    "africa",
                    "oceania",
                  ] as const
                ).map((r) => (
                  <button
                    key={r}
                    aria-pressed={region === r}
                    onClick={() => setRegion(r)}
                  >
                    {r === "all" ? m.allPlaces : m[r]}
                  </button>
                ))}
              </div>
            </div>
            <section className="city-discovery" aria-label={m.explore}>
              {featured
                .slice(0, query || region !== "all" ? 66 : 4)
                .map((c, i) => (
                  <Link
                    className={`city-card ${i === 0 && !query && region === "all" ? "city-featured" : ""}`}
                    key={c.id}
                    href={cityUrl(c)}
                  >
                    {c.cover !== undefined ? (
                      <Scene
                        index={c.cover}
                        alt={m.demoAlts[c.cover]}
                        priority={i < 2}
                      />
                    ) : (
                      <div className="city-card-art">
                        <Globe2 size={74} />
                        <span>{c.countryCode}</span>
                      </div>
                    )}
                    <div className="city-card-shade" />
                    <div className="city-card-top">
                      <span>{time(c)}</span>
                      <span>
                        {c.cover !== undefined ? m.illustration : c.country}
                      </span>
                    </div>
                    <div className="city-card-copy">
                      <span className="city-country">{c.country}</span>
                      <h2>{c.name}</h2>
                      <div>
                        <span className="city-atmosphere-chip">
                          {
                            m.labels[
                              (preview
                                ? undefined
                                : pulses.find((p) => p.cityId === c.id)
                                    ?.label) ?? "insufficient"
                            ]
                          }
                        </span>
                        <ArrowUpRight size={22} />
                      </div>
                    </div>
                  </Link>
                ))}
            </section>
            {!featured.length && <p className="world-empty">{m.searchEmpty}</p>}
            {!query && region === "all" && (
              <div className="city-strip">
                {cities.slice(4, 13).map((c) => (
                  <Link href={cityUrl(c)} key={c.id}>
                    {c.name}
                    <ArrowUpRight size={12} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        <section className="daily-prompt">
          <div className="prompt-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
            <i>✦</i>
          </div>
          <div>
            <span className="world-kicker">{m.promptKicker}</span>
            <h2>“{prompt.text}”</h2>
            <p>{m.promptFoot}</p>
            <div className="prompt-actions">
              <button className="world-primary" onClick={() => setAdd(true)}>
                {m.answerPrompt}
                <Plus size={17} />
              </button>
              <button
                className="world-text"
                onClick={() => setShare({ kind: "prompt", preview })}
              >
                <Share2 size={16} />
                {m.sharePrompt}
              </button>
            </div>
          </div>
          <span className="prompt-number">
            {String(prompt.id).padStart(2, "0")}
            <small>/ 64</small>
          </span>
        </section>
        {error && !preview && (
          <div className="world-error" role="alert">
            {error}
            <button onClick={() => void load()}>
              <RefreshCw size={15} />
              {m.retry}
            </button>
          </div>
        )}
        {city ? (
          <section className="moments-section">
            <div className="world-section-heading">
              <div>
                <span className="world-kicker">{city.name}</span>
                <h2>{m.moments}</h2>
              </div>
              <button className="world-text" onClick={() => setAdd(true)}>
                <Plus size={16} />
                {m.add}
              </button>
            </div>
            {loading && !preview ? (
              <div className="feed-skeleton" aria-label={m.loading}>
                <span />
                <span />
                <span />
              </div>
            ) : feed.length ? (
              <div className="moments-grid">
                {feed.map((x) => renderMoment(x))}
              </div>
            ) : (
              <div className="world-empty">
                <Compass size={30} />
                <h3>{m.cityEmpty}</h3>
                <p>{m.cityEmptyBody}</p>
                <button className="world-primary" onClick={() => setAdd(true)}>
                  {m.answerPrompt}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {cursor && !preview && (
              <button
                className="load-more"
                disabled={loading}
                onClick={() => void load(cursor)}
              >
                {m.loadMore}
              </button>
            )}
          </section>
        ) : (
          <>
            <section className="same-world">
              <div className="world-section-heading">
                <div>
                  <span className="world-kicker">{m.promptTitle}</span>
                  <h2>{m.sameTitle}</h2>
                  <p>{m.sameBody}</p>
                </div>
                <button
                  className="round-share"
                  aria-label={m.shareSame}
                  onClick={() => setShare({ kind: "same", preview })}
                >
                  <ArrowUpRight size={24} />
                </button>
              </div>
              {preview || promptMoments.length ? (
                <div className="same-grid">
                  {promptMoments.slice(0, 6).map((x) => renderMoment(x, true))}
                </div>
              ) : loading ? (
                <div className="feed-skeleton" aria-label={m.loading}>
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className="world-empty">
                  <Globe2 size={30} />
                  <h3>{m.emptyTitle}</h3>
                  <p>{m.emptyBody}</p>
                  <button className="world-primary" onClick={() => mode(true)}>
                    {m.preview}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
            {!preview && feed.length > 0 && (
              <section className="moments-section">
                <div className="world-section-heading">
                  <h2>{m.moments}</h2>
                </div>
                <div className="moments-grid">
                  {feed.map((x) => renderMoment(x))}
                </div>
                {cursor && (
                  <button
                    className="load-more"
                    disabled={loading}
                    onClick={() => void load(cursor)}
                  >
                    {m.loadMore}
                  </button>
                )}
              </section>
            )}
          </>
        )}
        <section className="private-invitation">
          <LockKeyhole size={23} />
          <div>
            <h2>{m.privateLine}</h2>
            <p>{m.privateBody}</p>
          </div>
          <Link href="/me">
            {m.privateLink}
            <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="tomorrow">
          <span>✦</span>
          <h2>{m.returnTomorrow}</h2>
          <p>{m.tomorrowBody}</p>
        </section>
      </main>
      <footer className="world-footer">
        <span>
          <Globe2 size={17} />
          {m.footer}
        </span>
        <div>
          <label>
            {m.language}
            <select
              aria-label={m.language}
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value);
                localStorage.setItem("mp-locale", e.target.value);
              }}
            >
              <option value="en">{messages("en").localeNames.en}</option>
              <option value="hi">{messages("en").localeNames.hi}</option>
              <option value="ar">{messages("en").localeNames.ar}</option>
            </select>
          </label>
          <Link href="/privacy">{m.privacy}</Link>
        </div>
        <p>{m.safety}</p>
      </footer>
      {add && (
        <AddMoment
          locale={locale}
          cityId={city?.id}
          onClose={() => setAdd(false)}
          onSaved={() => void load()}
          onAuth={() => {
            setAdd(false);
            setAuth(true);
          }}
        />
      )}
      {auth && <AuthDialog m={m} onClose={() => setAuth(false)} />}{" "}
      {report && (
        <Dialog
          title={m.reportTitle}
          closeLabel={m.close}
          onClose={() => setReport(null)}
        >
          <h2>{m.reportTitle}</h2>
          {notice && <p role="status">{notice}</p>}
          <p>{m.reportBody}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await fetch("/api/moments/report", {
                  method: "POST",
                  headers: {
                    ...(await tokenHeaders()),
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ id: report, reason }),
                });
                if (!r.ok) throw new Error();
                setReport(null);
                setNotice(m.reported);
                await load();
              } catch {
                setNotice(m.unavailable);
              } finally {
                setBusy(false);
              }
            }}
          >
            <select
              aria-label={m.report}
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              {Object.entries(m.reportReasons).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button className="world-primary" disabled={busy}>
              {m.submitReport}
            </button>
          </form>
        </Dialog>
      )}
      {share && (
        <Dialog
          title={m.shareTitle}
          closeLabel={m.close}
          onClose={() => setShare(null)}
        >
          <span className="world-kicker">
            {share.preview ? m.preview : m.live}
          </span>
          <h2>{m.shareTitle}</h2>
          {notice && <p role="status">{notice}</p>}
          <p>{m.shareBody}</p>
          <div className="share-card-preview">
            <Globe2 size={42} />
            <h3>{shareModel(share, m).title}</h3>
            <p>{shareModel(share, m).body}</p>
            <small>{share.preview ? m.preview : m.live}</small>
          </div>
          <button
            className="world-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const blob = await renderShareCard(share, m);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "a-window-into-the-world.png";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                worldAnalytics.track("share_created");
                setNotice(m.shareDownloaded);
              } catch {
                setNotice(m.shareUnavailable);
              } finally {
                setBusy(false);
              }
            }}
          >
            {m.downloadCard}
            <ArrowRight size={16} />
          </button>
          <button
            className="world-text"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + shareModel(share, m).path,
                );
                setNotice(m.copied);
              } catch {
                setNotice(m.shareUnavailable);
              }
            }}
          >
            {m.copyLink}
          </button>
        </Dialog>
      )}
    </div>
  );
}
