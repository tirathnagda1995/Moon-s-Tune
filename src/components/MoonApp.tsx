"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Moon as MoonIcon,
  Sun,
  BookOpen,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Check,
  X,
  Download,
  LogOut,
  Trash2,
} from "lucide-react";
import Moon from "./Moon";
import Link from "next/link";
import { worldMessages } from "@/lib/world/i18n";
import WorldHeader from "./world/WorldHeader";
import MomentLibrary from "./world/MomentLibrary";
import PatternShare from "./world/PatternShare";
import { worldAnalytics } from "@/lib/world/domain";
import {
  erasePrivateMoments,
  listPrivateMoments,
} from "@/lib/world/private-moments";
import { privateScope } from "@/lib/world/client";
import Checkin from "./Checkin";
import { messages, direction, format, formatPlural } from "@/lib/i18n";
import {
  type Observation,
  effectiveSignals,
  localDate,
  quickDimensions,
} from "@/lib/domain";
import { lunarContext } from "@/lib/lunar";
import { baseline, patterns as calculatePatterns } from "@/lib/patterns";
import {
  clearHistory,
  deleteObservation,
  eraseGuest,
  exportLedger,
  guestId,
  listConsents,
  listObservations,
  saveConsent,
  saveObservation,
} from "@/lib/storage";
import { decrypt } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
type Tab = "today" | "memories" | "patterns" | "settings";
export default function MoonApp({
  initialTab = "today",
}: {
  initialTab?: Tab;
}) {
  useEffect(() => {
    if (initialTab === "patterns") worldAnalytics.track("patterns_viewed");
  }, [initialTab]);
  const [locale, setLocale] = useState("en");
  const m = messages(locale);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [onboarding, setOnboarding] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Observation[]>([]);
  const [personId, setPersonId] = useState("");
  const [cloud, setCloud] = useState(false);
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Observation | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [pending, setPending] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [units, setUnits] = useState("metric");
  const refresh = useCallback(async (isCloud: boolean) => {
    const data = await listObservations(isCloud);
    setEntries(data.sort((a, b) => b.localDate.localeCompare(a.localDate)));
  }, []);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLocale(localStorage.getItem("mp-locale") ?? "en");
        setUnits(localStorage.getItem("mp-units") ?? "metric");
        const client = supabase();
        const session = client
          ? (await client.auth.getSession()).data.session
          : null;
        if (!alive) return;
        const isCloud = !!session;
        setCloud(isCloud);
        setPersonId(session?.user.id ?? guestId());
        setAccountEmail(session?.user.email ?? "");
        await refresh(isCloud);
        const consent = isCloud ? await listConsents(true) : [];
        setOnboarding(
          isCloud
            ? consent.some((c) => c.purpose === "CORE_APP" && c.granted)
              ? 0
              : 2
            : localStorage.getItem("mp-onboarded")
              ? 0
              : 1,
        );
        setReady(true);
      } catch {
        setError(messages("en").error);
        setReady(true);
      }
    }
    void load();
    const sub = supabase()?.auth.onAuthStateChange(() => {
      void load();
      setSelected(null);
      setPlaintext("");
      setPassphrase("");
    });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction(locale);
  }, [locale]);
  const yesterday = entries.find(
    (e) =>
      e.localDate ===
      new Date(new Date(localDate(now) + "T12:00:00Z").getTime() - 86400000)
        .toISOString()
        .slice(0, 10),
  );
  const yesterdayMood = yesterday
    ? effectiveSignals(yesterday.signals).find(
        (s) => s.dimension === "emotional_valence",
      )
    : null;
  const lunar = useMemo(() => lunarContext(now), [now]);
  const patternResults = useMemo(() => calculatePatterns(entries), [entries]);
  const today = entries.find((e) => e.localDate === localDate(now));
  const fmtDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options).format(date);
  const fmtNumber = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  async function run(fn: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await fn();
    } catch {
      setError(m.error);
    } finally {
      setPending(false);
    }
  }
  async function save(entry: Observation) {
    await saveObservation(entry, cloud);
    worldAnalytics.track("personal_checkin_completed");
    setEntries((old) =>
      [entry, ...old.filter((o) => o.id !== entry.id)].sort((a, b) =>
        b.localDate.localeCompare(a.localDate),
      ),
    );
    setSelected(entry);
    setEditing(false);
    setSaved(true);
    setPlaintext("");
    try {
      await refresh(cloud);
    } catch {
      setError(m.refreshError);
    }
  }
  function open(entry: Observation) {
    setSelected(entry);
    setEditing(false);
    setSaved(false);
    setPlaintext("");
    setError("");
  }
  async function remove() {
    if (!selected || !confirm(m.confirmDelete)) return;
    await run(async () => {
      await deleteObservation(selected.id, cloud);
      await refresh(cloud);
      setSelected(null);
    });
  }
  async function exportData() {
    await run(async () => {
      const consent = await listConsents(cloud);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              schemaVersion: 1,
              exportedAt: new Date().toISOString(),
              observations: await listObservations(cloud),
              consents: consent,
              ledger: await exportLedger(cloud),
              privateMoments: await listPrivateMoments(await privateScope()),
              preferences: { locale, units },
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moon-pattern-${localDate()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNotice(m.downloaded);
    });
  }
  const tabs = [
    { id: "today" as const, icon: Sun },
    { id: "memories" as const, icon: BookOpen },
    { id: "patterns" as const, icon: ChartNoAxesCombined },
    { id: "settings" as const, icon: Settings2 },
  ];
  const changeTab = (id: Tab) => {
    setTab(id);
    setSelected(null);
    setEditing(false);
    setPlaintext("");
    setNotice("");
    setError("");
  };
  if (!ready)
    return (
      <main className="loading">
        <MoonIcon />
        <p>{m.loading}</p>
      </main>
    );
  if (onboarding)
    return (
      <main className="onboarding">
        <Link className="back-world" href="/">
          ← {worldMessages(locale).world}
        </Link>
        <div className="brand">
          <MoonIcon size={20} />
          {m.brand}
        </div>
        <div className="onboarding-moon">
          <Moon angle={145} size={340} />
        </div>
        <div className="onboarding-content">
          <div className="eyebrow">{m.tagline}</div>
          <h1>
            {onboarding === 1 ? (
              <>
                {m.onboardTitle}
                <br />
                <em>{m.onboardSecond}</em>
              </>
            ) : (
              m.trustTitle
            )}
          </h1>
          <p>{onboarding === 1 ? m.onboardBody : m.trustBody}</p>
          {onboarding === 2 && (
            <>
              <p className="hint">{m.trustDetail}</p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                {m.coreConsent}
              </label>
            </>
          )}
          <button
            className="primary"
            disabled={pending || (onboarding === 2 && !accepted)}
            onClick={() =>
              onboarding === 1
                ? setOnboarding(2)
                : void run(async () => {
                    await saveConsent(
                      {
                        id: crypto.randomUUID(),
                        purpose: "CORE_APP",
                        granted: true,
                        timestamp: new Date().toISOString(),
                        version: "1",
                        region: "unspecified",
                      },
                      cloud,
                    );
                    localStorage.setItem("mp-onboarded", "1");
                    setOnboarding(0);
                  })
            }
          >
            {onboarding === 1 ? m.discover : m.begin}
            <ArrowRight size={17} />
          </button>
          {error && <p role="alert">{error}</p>}
          <a className="subtle-link" href="/privacy">
            {m.privacy}
          </a>
        </div>
        <footer>{m.trustFoot}</footer>
      </main>
    );
  const firstDate = entries.length
    ? entries[entries.length - 1].localDate
    : localDate();
  const elapsed =
    Math.floor(
      (new Date(localDate()).getTime() - new Date(firstDate).getTime()) /
        86400000,
    ) + 1;
  return (
    <div className="app personal-v2">
      <WorldHeader
        locale={locale}
        active={tab === "patterns" ? "patterns" : "me"}
      />
      <nav className="personal-tabs" aria-label={m.settings}>
        {tabs
          .filter((t) => t.id !== "patterns")
          .map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => changeTab(id)}
              aria-pressed={tab === id}
            >
              <Icon size={16} />
              {m[id]}
            </button>
          ))}
      </nav>
      <main className="main">
        {error && (
          <div role="alert" className="error global-error">
            {error}
            <button onClick={() => void run(() => refresh(cloud))}>
              {m.retry}
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            <Check size={16} />
            {notice}
            <button
              className="icon-button"
              aria-label={m.close}
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {selected ? (
          <section className="day-view">
            <button
              className="text-button"
              onClick={() => {
                setSelected(null);
                setEditing(false);
                setPlaintext("");
              }}
            >
              <ChevronLeft size={16} />
              {m.back}
            </button>
            {editing ? (
              <Checkin
                key={selected.id}
                m={m}
                locale={locale}
                cloud={cloud}
                personId={personId}
                existing={selected}
                passphrase={passphrase}
                setPassphrase={setPassphrase}
                onSave={save}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <div className="day-heading">
                  <div>
                    <div className="eyebrow">{saved ? m.saved : m.dayCard}</div>
                    <h1>
                      {fmtDate(new Date(selected.localDate + "T12:00:00"), {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h1>
                    <p>
                      {m.phases[selected.lunar.phase]} ·{" "}
                      {fmtNumber(selected.lunar.illumination * 100)}%{" "}
                      {m.illumination.toLowerCase()}
                    </p>
                  </div>
                  <Moon angle={selected.lunar.angle} size={135} />
                </div>
                <div className="reflection">
                  <span>✦</span>
                  <p>{m[selected.reflectionCode]}</p>
                  {selected.reflectionCode === "urgent" && (
                    <a
                      href="https://findahelpline.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.support}
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
                <div className="day-metrics">
                  {effectiveSignals(selected.signals).map((s) => (
                    <div key={s.dimension}>
                      <span className="eyebrow">
                        {m.dimensions[s.dimension]}
                      </span>
                      <strong>{m.levels[s.dimension][s.value - 1]}</strong>
                      <small>
                        {s.sourceType === "MODEL_INFERRED"
                          ? m.sourceModel
                          : s.sourceType === "USER_CORRECTED"
                            ? m.sourceCorrected
                            : m.sourceSelf}{" "}
                        · {fmtNumber(s.confidence * 100)}%
                      </small>
                    </div>
                  ))}
                </div>
                <div className="feedback">
                  <button
                    onClick={() =>
                      void run(async () => {
                        const updated = {
                          ...selected,
                          feedback: "helpful" as const,
                          revision: selected.revision + 1,
                        };
                        await saveObservation(updated, cloud);
                        setSelected(updated);
                        await refresh(cloud);
                        setNotice(m.feedbackSaved);
                      })
                    }
                  >
                    {m.helpful}
                  </button>
                  <button onClick={() => setEditing(true)}>
                    {m.notAccurate}
                  </button>
                  <button
                    onClick={() =>
                      void run(async () => {
                        const updated = {
                          ...selected,
                          feedback: "unhelpful" as const,
                          revision: selected.revision + 1,
                        };
                        await saveObservation(updated, cloud);
                        setSelected(updated);
                        await refresh(cloud);
                        setNotice(m.feedbackSaved);
                      })
                    }
                  >
                    {m.unhelpful}
                  </button>
                </div>
                {selected.journal && (
                  <section className="vault">
                    <h3>
                      <LockKeyhole size={16} />
                      {m.privateNote}
                    </h3>
                    {plaintext ? (
                      <>
                        <p className="private-text">{plaintext}</p>
                        <button
                          className="secondary"
                          onClick={() => setPlaintext("")}
                        >
                          {m.lockNote}
                        </button>
                      </>
                    ) : (
                      <>
                        <label className="field">
                          {m.passphrase}
                          <input
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            autoComplete="off"
                          />
                        </label>
                        <button
                          className="secondary"
                          onClick={async () => {
                            try {
                              setPlaintext(
                                await decrypt(
                                  selected.journal!,
                                  passphrase,
                                  selected.id,
                                ),
                              );
                              setError("");
                            } catch {
                              setError(m.unlockFail);
                            }
                          }}
                        >
                          {m.unlock}
                        </button>
                      </>
                    )}
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (confirm(m.confirmNote))
                          void run(async () => {
                            const updated = {
                              ...selected,
                              journal: null,
                              revision: selected.revision + 1,
                            };
                            await saveObservation(updated, cloud);
                            setSelected(updated);
                            setPlaintext("");
                            await refresh(cloud);
                          });
                      }}
                    >
                      {m.removeNote}
                    </button>
                  </section>
                )}
                <div className="day-actions">
                  <button className="primary" onClick={() => setEditing(true)}>
                    {m.edit}
                    <ArrowRight size={16} />
                  </button>
                  <button
                    className="text-button danger"
                    disabled={pending}
                    onClick={remove}
                  >
                    {m.delete}
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            {tab === "today" && (
              <>
                <div className="page-top">
                  <span className="eyebrow">{m.greeting}</span>
                  <span>
                    {fmtDate(now, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="today-layout">
                  <aside className="lunar-panel">
                    <div className="moon-scene">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <span className="star star-one">+</span>
                      <span className="star star-two">·</span>
                      <Moon angle={lunar.angle} size={340} />
                    </div>
                    <div className="lunar-title">
                      <span className="eyebrow">{m.phases[lunar.phase]}</span>
                      <h2>{m.moonCaption}</h2>
                    </div>
                    <div className="moon-facts">
                      <div>
                        <strong>
                          {fmtNumber(lunar.illumination * 100)}
                          <small>%</small>
                        </strong>
                        <span>{m.illumination}</span>
                      </div>
                      <div>
                        <strong>
                          {fmtNumber(lunar.age, 1)}
                          <small> {m.daysUnit}</small>
                        </strong>
                        <span>{m.lunarAge}</span>
                      </div>
                    </div>
                    <div className="next-moon">
                      <MoonIcon size={22} />
                      <div>
                        <span className="eyebrow">{m.nextFull}</span>
                        <p>
                          {fmtDate(new Date(lunar.nextFull), {
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="moon-line" />
                    </div>
                    <p className="moon-footnote">{m.moonNote}</p>
                  </aside>
                  {today ? (
                    <section className="checkin completed">
                      <span className="eyebrow">{m.checkin}</span>
                      <div className="complete-icon">
                        <Check size={29} />
                      </div>
                      <h1>{m.already}</h1>
                      <p className="subtitle">{m.alreadyBody}</p>
                      <div className="reflection">
                        <p>{m[today.reflectionCode]}</p>
                      </div>
                      <button className="primary" onClick={() => open(today)}>
                        {m.viewToday}
                        <ArrowRight size={17} />
                      </button>
                      <p className="privacy-line">
                        <LockKeyhole size={12} />
                        {m.footer}
                      </p>
                    </section>
                  ) : (
                    <Checkin
                      key={localDate(now)}
                      m={m}
                      locale={locale}
                      personId={personId}
                      cloud={cloud}
                      passphrase={passphrase}
                      setPassphrase={setPassphrase}
                      onSave={save}
                    />
                  )}
                </div>
                {yesterdayMood && (
                  <div className="continuity">
                    <span className="eyebrow">{m.yesterday}</span>
                    <p>
                      {format(m.yesterdayBody, {
                        feeling:
                          m.levels.emotional_valence[yesterdayMood.value - 1],
                      })}
                    </p>
                  </div>
                )}
                <section className="journey">
                  <div>
                    <span className="eyebrow">{m.about}</span>
                    <h2>{m.journey}</h2>
                    <p>{m.journeyBody}</p>
                  </div>
                  <div className="milestones">
                    {[
                      { name: m.weekly, target: 7 },
                      { name: m.cycle, target: 30 },
                      { name: m.month, target: 30 },
                      { name: m.threeCycles, target: 89 },
                    ].map((item, i) => (
                      <button key={i} onClick={() => changeTab("patterns")}>
                        <div className="milestone-top">
                          <span
                            className="milestone-orb"
                            style={{ opacity: 0.45 + i * 0.15 }}
                          >
                            ◐
                          </span>
                          <span>
                            {Math.min(entries.length, elapsed) >=
                            item.target ? (
                              <Check size={14} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                        </div>
                        <strong>{item.name}</strong>
                        <div className="progress-track">
                          <div
                            style={{
                              width: `${Math.min(100, (Math.min(entries.length, elapsed) / item.target) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {format(m.progress, {
                            count: Math.min(entries.length, elapsed),
                            target: item.target,
                          })}
                        </small>
                      </button>
                    ))}
                  </div>
                  <p className="hint">{m.journeyHint}</p>
                </section>
              </>
            )}
            {tab === "memories" && (
              <section className="history">
                <div className="section-heading">
                  <span className="eyebrow">{m.memories}</span>
                  <h1>{m.historyTitle}</h1>
                  <p>{m.historyBody}</p>
                </div>
                <MomentLibrary
                  key={cloud ? personId : "guest"}
                  locale={locale}
                />
                <div className="history-layout">
                  <div className="calendar">
                    <div className="calendar-top">
                      <h2>
                        {fmtDate(month, { month: "long", year: "numeric" })}
                      </h2>
                      <div>
                        <button
                          className="icon-button"
                          aria-label={m.previousMonth}
                          onClick={() =>
                            setMonth(
                              new Date(
                                month.getFullYear(),
                                month.getMonth() - 1,
                                1,
                              ),
                            )
                          }
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={m.nextMonth}
                          onClick={() =>
                            setMonth(
                              new Date(
                                month.getFullYear(),
                                month.getMonth() + 1,
                                1,
                              ),
                            )
                          }
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="calendar-grid">
                      {m.weekdays.map((d) => (
                        <span className="weekday" key={d}>
                          {d}
                        </span>
                      ))}
                      {Array.from(
                        {
                          length: new Date(
                            month.getFullYear(),
                            month.getMonth(),
                            1,
                          ).getDay(),
                        },
                        (_, i) => (
                          <span key={"blank" + i} />
                        ),
                      )}
                      {Array.from(
                        {
                          length: new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            0,
                          ).getDate(),
                        },
                        (_, i) => {
                          const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                          const entry = entries.find(
                            (e) => e.localDate === date,
                          );
                          return (
                            <button
                              key={date}
                              className={`${entry ? "has-entry" : ""} ${date === localDate() ? "is-today" : ""}`}
                              aria-label={`${fmtDate(new Date(date + "T12:00:00"), { dateStyle: "long" })}: ${entry ? m.dayCard : m.noDay}`}
                              disabled={!entry}
                              onClick={() => entry && open(entry)}
                            >
                              <span>{fmtNumber(i + 1)}</span>
                              {entry && <span className="calendar-dot" />}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                  <div className="memory-list">
                    {entries.length > 0 &&
                      !entries.some((e) =>
                        e.localDate.startsWith(
                          `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
                        ),
                      ) && <p className="empty">{m.noMonth}</p>}
                    {entries.length ? (
                      entries
                        .filter((e) =>
                          e.localDate.startsWith(
                            `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
                          ),
                        )
                        .map((entry) => (
                          <button
                            key={entry.id}
                            className="memory"
                            onClick={() => open(entry)}
                          >
                            <span className="memory-day">
                              {fmtDate(
                                new Date(entry.localDate + "T12:00:00"),
                                { day: "numeric" },
                              )}
                              <small>
                                {fmtDate(
                                  new Date(entry.localDate + "T12:00:00"),
                                  { weekday: "short" },
                                )}
                              </small>
                            </span>
                            <div>
                              <strong>{m.phases[entry.lunar.phase]}</strong>
                              <p>
                                {effectiveSignals(entry.signals)
                                  .slice(0, 2)
                                  .map(
                                    (s) => m.levels[s.dimension][s.value - 1],
                                  )
                                  .join(" · ") || m.recorded}
                              </p>
                            </div>
                            <ArrowUpRight size={18} />
                          </button>
                        ))
                    ) : (
                      <div className="empty">
                        <BookOpen size={28} />
                        <h2>{m.empty}</h2>
                        <p>{m.emptyBody}</p>
                        <button
                          className="secondary"
                          onClick={() => changeTab("today")}
                        >
                          {m.begin}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {tab === "patterns" && (
              <section className="patterns">
                <div className="section-heading">
                  <span className="eyebrow">{m.about}</span>
                  <h1>{m.patternTitle}</h1>
                  <p>{m.patternBody}</p>
                </div>
                <section className="weekly">
                  <div>
                    <span className="eyebrow">{m.weekly}</span>
                    <h2>{m.weekTitle}</h2>
                    <p>{m.weekBody}</p>
                  </div>
                  <div className="week-metrics">
                    {quickDimensions.map((d) => {
                      const b = baseline(entries, d, 6, now);
                      return (
                        <div key={d}>
                          <span>{m.dimensions[d]}</span>
                          <strong>
                            {b.mean === null ? "—" : fmtNumber(b.mean, 1)}
                          </strong>
                          <div className="progress-track">
                            <div style={{ width: `${(b.mean ?? 0) * 20}%` }} />
                          </div>
                          <small>
                            {formatPlural(
                              locale,
                              { one: m.observationOne, other: m.observations },
                              b.n,
                            )}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <p className="hint">{m.meanLabel}</p>
                </section>
                <section className="weekly month-report">
                  <div>
                    <span className="eyebrow">{m.month}</span>
                    <h2>{m.monthTitle}</h2>
                    <p>{m.monthBody}</p>
                  </div>
                  <div className="week-metrics">
                    {quickDimensions.map((d) => {
                      const b = baseline(entries, d, 29, now);
                      return (
                        <div key={d}>
                          <span>{m.dimensions[d]}</span>
                          <strong>
                            {b.mean === null ? "—" : fmtNumber(b.mean, 1)}
                          </strong>
                          <div className="progress-track">
                            <div style={{ width: `${(b.mean ?? 0) * 20}%` }} />
                          </div>
                          <small>
                            {formatPlural(
                              locale,
                              { one: m.observationOne, other: m.observations },
                              b.n,
                            )}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <p className="hint">{m.meanLabel}</p>
                </section>
                <section className="moon-report">
                  <div>
                    <div className="eyebrow">{m.moonPattern}</div>
                    <h2>
                      {patternResults.some(
                        (p) => p.variable === "moon" && p.difference !== null,
                      )
                        ? m.moonReady
                        : m.collecting}
                    </h2>
                    <p>{m.moonPatternBody}</p>
                    <p className="hint">{m.collectingBody}</p>
                  </div>
                  <div className="phase-coverage">
                    {m.phases.map((phase, i) => (
                      <div key={phase}>
                        <span className="phase-symbol">
                          {["●", "◔", "◑", "◕", "○", "◕", "◐", "◔"][i]}
                        </span>
                        <span>{phase}</span>
                        <strong>
                          {fmtNumber(
                            entries.filter((e) => e.lunar.phase === i).length,
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {patternResults
                    .filter(
                      (p) => p.variable === "moon" && p.difference !== null,
                    )
                    .slice(0, 3)
                    .map((p, i) => (
                      <div className="pattern-result" key={i}>
                        <span>
                          {m.phases[p.group]} · {m.dimensions[p.dimension]}
                        </span>
                        <strong>
                          {format(m.difference, {
                            value: fmtNumber(p.difference!, 2),
                          })}
                        </strong>
                        <p>
                          {format(m.evidence, {
                            count: p.n,
                            periods: p.periods,
                          })}{" "}
                          · {m.exploratory}
                        </p>
                        <PatternShare
                          locale={locale}
                          summary={`${p.variable === "moon" ? m.phases[p.group] : p.variable === "weekday" ? m.weekdays[p.group] : m.restfulnessGroup} · ${m.dimensions[p.dimension]}. ${format(m.difference, { value: fmtNumber(p.difference!, 2) })}. ${format(m.evidence, { count: p.n, periods: p.periods })}. ${m.exploratory}`}
                        />
                      </div>
                    ))}
                </section>
                <section className="other-patterns">
                  <h2>{m.otherRhythms}</h2>
                  <p>{m.otherBody}</p>
                  {patternResults
                    .filter(
                      (p) => p.variable !== "moon" && p.difference !== null,
                    )
                    .slice(0, 3)
                    .map((p, i) => (
                      <div className="pattern-result" key={i}>
                        <span>
                          {p.variable === "weekday"
                            ? m.weekdays[p.group]
                            : m.restfulnessGroup}{" "}
                          · {m.dimensions[p.dimension]}
                        </span>
                        <strong>
                          {format(m.difference, {
                            value: fmtNumber(p.difference!, 2),
                          })}
                        </strong>
                        <p>
                          {format(m.evidence, {
                            count: p.n,
                            periods: p.periods,
                          })}{" "}
                          · {m.exploratory}
                        </p>
                        <PatternShare
                          locale={locale}
                          summary={`${p.variable === "moon" ? m.phases[p.group] : p.variable === "weekday" ? m.weekdays[p.group] : m.restfulnessGroup} · ${m.dimensions[p.dimension]}. ${format(m.difference, { value: fmtNumber(p.difference!, 2) })}. ${format(m.evidence, { count: p.n, periods: p.periods })}. ${m.exploratory}`}
                        />
                      </div>
                    ))}
                  {!patternResults.some(
                    (p) => p.variable !== "moon" && p.difference !== null,
                  ) && <div className="muted-box">{m.noRelationship}</div>}
                  <p className="hint">{m.caution}</p>
                </section>
                <div className="environment">
                  <span>◎</span>
                  <div>
                    <h3>{m.environment}</h3>
                    <p>{m.environmentBody}</p>
                  </div>
                </div>
              </section>
            )}
            {tab === "settings" && (
              <section className="settings">
                <div className="section-heading">
                  <span className="eyebrow">{m.settings}</span>
                  <h1>{m.settingsTitle}</h1>
                  <p>{m.settingsBody}</p>
                </div>
                <section>
                  <h2>{m.account}</h2>
                  <p>{cloud ? accountEmail : m.guestHint}</p>
                  {supabase() ? (
                    cloud ? (
                      <button
                        className="secondary"
                        onClick={() =>
                          void run(async () => {
                            await supabase()!.auth.signOut();
                          })
                        }
                      >
                        <LogOut size={15} />
                        {m.signOut}
                      </button>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(async () => {
                            const { error } =
                              await supabase()!.auth.signInWithOtp({
                                email,
                                options: {
                                  emailRedirectTo: window.location.origin,
                                },
                              });
                            if (error) throw error;
                            setNotice(m.linkSent);
                          });
                        }}
                      >
                        <label className="field">
                          {m.email}
                          <input
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </label>
                        <button className="secondary" disabled={pending}>
                          {m.sendLink}
                          <ArrowRight size={15} />
                        </button>
                        <p className="hint">{m.authHelp}</p>
                      </form>
                    )
                  ) : (
                    <p className="hint">{m.authUnavailable}</p>
                  )}
                </section>
                <section>
                  <h2>{m.language}</h2>
                  <select
                    aria-label={m.language}
                    value={locale}
                    onChange={(e) => {
                      setLocale(e.target.value);
                      localStorage.setItem("mp-locale", e.target.value);
                    }}
                  >
                    <option value="en">{m.localeNames.en}</option>
                    <option value="hi">{m.localeNames.hi}</option>
                    <option value="ar">{m.localeNames.ar}</option>
                  </select>
                  <p className="hint">{m.languageHint}</p>
                  <label className="field">
                    {m.units}
                    <select
                      value={units}
                      onChange={(e) => {
                        setUnits(e.target.value);
                        localStorage.setItem("mp-units", e.target.value);
                      }}
                    >
                      <option value="metric">{m.metric}</option>
                      <option value="imperial">{m.imperial}</option>
                    </select>
                  </label>
                </section>
                <section>
                  <h2>{m.privacySummary}</h2>
                  <p>{m.privacyBody}</p>
                  <h3>{m.consentTitle}</h3>
                  <p>{m.consentBody}</p>
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(async () => {
                        await saveConsent(
                          {
                            id: crypto.randomUUID(),
                            purpose: "OPTIONAL_AI_TEXT_PROCESSING",
                            granted: false,
                            timestamp: new Date().toISOString(),
                            version: "1",
                            region: "unspecified",
                          },
                          cloud,
                        );
                        setNotice(m.withdrawn);
                      })
                    }
                  >
                    {m.withdrawAI}
                  </button>
                </section>
                <section>
                  <h2>{m.dataControl}</h2>
                  <p>{m.exportHint}</p>
                  <button
                    className="secondary"
                    disabled={pending}
                    onClick={exportData}
                  >
                    <Download size={16} />
                    {m.export}
                  </button>
                  <div className="danger-zone">
                    <button
                      className="text-button danger"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(m.confirmAll))
                          void run(async () => {
                            await clearHistory(cloud);
                            await erasePrivateMoments(await privateScope());
                            await refresh(cloud);
                          });
                      }}
                    >
                      {m.deleteAll}
                    </button>
                    <button
                      className="text-button danger"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(cloud ? m.confirmAccount : m.confirmGuest))
                          void run(async () => {
                            if (cloud) {
                              const session = (
                                await supabase()!.auth.getSession()
                              ).data.session;
                              const response = await fetch("/api/account", {
                                method: "DELETE",
                                headers: {
                                  Authorization: `Bearer ${session?.access_token}`,
                                },
                              });
                              if (!response.ok) throw new Error();
                              await erasePrivateMoments(await privateScope());
                              await supabase()!.auth.signOut();
                            } else {
                              await erasePrivateMoments("guest");
                              await eraseGuest();
                              window.location.reload();
                            }
                          });
                      }}
                    >
                      <Trash2 size={15} />
                      {cloud ? m.deleteAccount : m.deleteGuest}
                    </button>
                  </div>
                </section>
                <section>
                  <h2>{m.install}</h2>
                  <p>{m.installBody}</p>
                </section>
              </section>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <span>
          <MoonIcon size={14} />
          {m.footer}
        </span>
        <a href="/privacy">
          {m.privacy}
          <ArrowUpRight size={12} />
        </a>
        <span>{m.wellness}</span>
      </footer>
    </div>
  );
}
