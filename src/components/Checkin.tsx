"use client";
import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  LockKeyhole,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import {
  type Observation,
  type Dimension,
  type Interpretation,
  quickDimensions,
  effectiveSignals,
  makeSignal,
  localDate,
  reflectionCode,
} from "@/lib/domain";
import { lunarContext } from "@/lib/lunar";
import { encrypt } from "@/lib/crypto";
import type { Messages } from "@/lib/i18n";
import { urgentLanguage } from "@/lib/safety";
import { supabase } from "@/lib/supabase";
import { saveConsent } from "@/lib/storage";
export default function Checkin({
  m,
  locale,
  personId,
  cloud,
  existing,
  passphrase,
  setPassphrase,
  onSave,
  onCancel,
}: {
  m: Messages;
  locale: string;
  personId: string;
  cloud: boolean;
  existing?: Observation;
  passphrase: string;
  setPassphrase: (v: string) => void;
  onSave: (o: Observation) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Partial<Record<Dimension, number>>>(() =>
    Object.fromEntries(
      existing
        ? effectiveSignals(existing.signals).map((s) => [s.dimension, s.value])
        : [],
    ),
  );
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [retain, setRetain] = useState(false);
  const [ai, setAi] = useState(false);
  const [inferred, setInferred] = useState<Interpretation | null>(null);
  const [touched, setTouched] = useState<Set<Dimension>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const choose = (d: Dimension, v?: number) => {
    setValues((old) => ({ ...old, [d]: v }));
    setTouched((old) => new Set([...old, d]));
  };
  async function interpret() {
    setAnalyzing(true);
    setError("");
    try {
      await saveConsent(
        {
          id: crypto.randomUUID(),
          purpose: "OPTIONAL_AI_TEXT_PROCESSING",
          granted: true,
          timestamp: new Date().toISOString(),
          version: "1",
          region: "unspecified",
        },
        cloud,
      );
      const session = cloud
        ? (await supabase()!.auth.getSession()).data.session
        : null;
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ text, locale, consent: true }),
      });
      if (response.status === 503 || response.status === 401) {
        setError(m.aiUnavailable);
        return;
      }
      if (!response.ok) throw new Error();
      const result = (await response.json()) as Interpretation;
      setInferred(result);
      setValues((old) => {
        const next = { ...old };
        for (const s of result.signals)
          if (!touched.has(s.dimension) && next[s.dimension] === undefined)
            next[s.dimension] = s.value;
        return next;
      });
      setMore(true);
    } catch {
      setError(m.aiFail);
    } finally {
      setAnalyzing(false);
    }
  }
  async function save() {
    setError("");
    if (
      !Object.values(values).some((v) => v !== undefined) &&
      !(retain && text.trim()) &&
      !existing?.journal
    ) {
      setError(m.needSignal);
      return;
    }
    if (retain && text.trim() && passphrase.length < 12) {
      setError(m.needPass);
      return;
    }
    setBusy(true);
    try {
      const timezone =
        existing?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const date = existing?.localDate ?? localDate();
      const id = existing?.id ?? crypto.randomUUID();
      let signals = existing?.signals ?? [];
      for (const d of quickDimensions.concat(
        Object.keys(values).filter(
          (d) => !quickDimensions.includes(d as Dimension),
        ) as Dimension[],
      )) {
        const value = values[d];
        const old = effectiveSignals(signals).find((s) => s.dimension === d);
        if (value === undefined) {
          signals = signals.filter((s) => s.dimension !== d);
          continue;
        }
        if (old && old.value === value && !touched.has(d)) continue;
        const guess = inferred?.signals.find((s) => s.dimension === d);
        const source =
          existing || (touched.has(d) && guess)
            ? "USER_CORRECTED"
            : guess && !touched.has(d)
              ? "MODEL_INFERRED"
              : "SELF_REPORTED";
        signals = [
          ...signals,
          makeSignal(
            d,
            value,
            source === "MODEL_INFERRED" ? guess!.confidence : 1,
            source,
            date,
            timezone,
            source === "MODEL_INFERRED"
              ? JSON.stringify(
                  inferred?.provenance ?? {
                    provider: "unknown",
                    promptVersion: "checkin-1",
                  },
                )
              : "quick-checkin",
            old?.id,
          ),
        ];
      }
      const journal =
        retain && text.trim()
          ? await encrypt(text, passphrase, id)
          : (existing?.journal ?? null);
      await onSave({
        id,
        personId,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        localDate: date,
        timezone,
        schemaVersion: 1,
        revision: (existing?.revision ?? 0) + 1,
        signals,
        lunar: existing?.lunar ?? lunarContext(new Date()),
        language:
          inferred?.language ??
          (text.trim() ? "und" : (existing?.language ?? "und")),
        reflectionCode: reflectionCode(
          signals,
          inferred?.safety === "urgent" || urgentLanguage(text),
        ),
        journal,
      });
      setText("");
    } catch {
      setError(m.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="checkin">
      <div className="eyebrow">
        {m.checkin}
        <span className="tiny-orbit">✦</span>
      </div>
      <h1>{existing ? m.editTitle : m.question}</h1>
      <p className="subtitle">{m.questionBody}</p>
      {inferred && (
        <div className="notice">
          <Sparkles size={17} />
          <div>
            <strong>{m.review}</strong>
            <p>{m.reviewBody}</p>
            <p>{inferred.reflection}</p>
          </div>
        </div>
      )}
      <div className="feelings">
        {(more
          ? Array.from(
              new Set([
                ...quickDimensions,
                ...(Object.keys(values) as Dimension[]),
              ]),
            )
          : quickDimensions.slice(0, 2)
        ).map((d) => (
          <fieldset key={d}>
            <legend>
              {m.dimensions[d]}
              <span>{values[d] ? m.levels[d][values[d]! - 1] : m.unknown}</span>
            </legend>
            <div
              className={`feeling-options ${d === "emotional_valence" ? "moods" : ""}`}
            >
              {m.levels[d].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={values[d] === index + 1}
                  onClick={() =>
                    choose(d, values[d] === index + 1 ? undefined : index + 1)
                  }
                  className={values[d] === index + 1 ? "selected" : ""}
                >
                  {d === "emotional_valence" ? (
                    <svg viewBox="0 0 40 40" aria-hidden="true">
                      <circle cx="20" cy="20" r="17" />
                      <circle cx="14" cy="16" r=".8" />
                      <circle cx="26" cy="16" r=".8" />
                      <path
                        d={
                          index === 0
                            ? "M12 29 Q20 16 28 29"
                            : index === 1
                              ? "M13 27 Q20 20 27 27"
                              : index === 2
                                ? "M13 25 L27 25"
                                : index === 3
                                  ? "M12 23 Q20 31 28 23"
                                  : "M11 22 Q20 35 29 22 Z"
                        }
                      />
                    </svg>
                  ) : (
                    <span className="energy-mark" aria-hidden="true">
                      {"▰".repeat(index + 1)}
                    </span>
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <button className="text-button more" onClick={() => setMore(!more)}>
        {more ? m.less : m.more}
        <ChevronDown
          size={15}
          style={{ transform: more ? "rotate(180deg)" : undefined }}
        />
      </button>
      <div className="note-input">
        <label htmlFor="journal">
          {m.noteLabel}
          <LockKeyhole size={13} />
        </label>
        <textarea
          id="journal"
          maxLength={4000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (inferred) {
              setValues((old) => {
                const next = { ...old };
                for (const s of inferred.signals)
                  if (
                    !touched.has(s.dimension) &&
                    !existing?.signals.some(
                      (old) => old.dimension === s.dimension,
                    )
                  )
                    delete next[s.dimension];
                return next;
              });
              setInferred(null);
            }
          }}
          placeholder={m.placeholder}
        />
        <span className="hint">{m.noteHint}</span>
      </div>
      {urgentLanguage(text) && (
        <div className="notice" role="status">
          <div>
            <p>{m.urgent}</p>
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noreferrer"
            >
              {m.support}
            </a>
          </div>
        </div>
      )}
      {text.trim() && (
        <div className="note-options">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={retain}
              onChange={(e) => setRetain(e.target.checked)}
            />
            {m.retain}
          </label>
          {retain && (
            <label className="field">
              {m.passphrase}
              <input
                type="password"
                autoComplete="off"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                minLength={12}
              />
              <span className="hint">{m.passphraseHint}</span>
            </label>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={ai}
              onChange={(e) => setAi(e.target.checked)}
            />
            {m.aiConsent}
          </label>
          <p className="hint">{m.aiDetail}</p>
          {ai && (
            <button
              className="secondary"
              disabled={analyzing}
              onClick={interpret}
            >
              <Sparkles size={15} />
              {analyzing ? m.interpreting : m.interpret}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="save-row">
        <button className="primary" disabled={busy || analyzing} onClick={save}>
          {busy ? m.saving : existing ? m.saveEdit : m.save}
          {busy ? <Check size={17} /> : <ArrowRight size={17} />}
        </button>
        {onCancel && (
          <button
            className="icon-button"
            aria-label={m.cancel}
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <p className="privacy-line">
        <LockKeyhole size={12} />
        {m.footer}
      </p>
    </section>
  );
}
