"use client";
import { useState, useRef } from "react";
import {
  ImagePlus,
  LockKeyhole,
  ArrowRight,
  Check,
  Globe2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cities } from "@/lib/world/cities";
import {
  feelings,
  type Feeling,
  dailyPrompt,
  worldAnalytics,
} from "@/lib/world/domain";
import { encrypt } from "@/lib/crypto";
import { savePrivateMoment } from "@/lib/world/private-moments";
import { preparePhoto, privateScope, tokenHeaders } from "@/lib/world/client";
import { worldMessages } from "@/lib/world/i18n";
import { supabase } from "@/lib/supabase";
import Dialog from "./Dialog";
export default function AddMoment({
  locale,
  cityId,
  onClose,
  onSaved,
  onAuth,
}: {
  locale: string;
  cityId?: string;
  onClose: () => void;
  onSaved: () => void;
  onAuth: () => void;
}) {
  const m = worldMessages(locale);
  const [city, setCity] = useState(cityId ?? ""),
    [feeling, setFeeling] = useState<Feeling | null>(null),
    [caption, setCaption] = useState(""),
    [photo, setPhoto] = useState(""),
    [visibility, setVisibility] = useState<"private" | "city" | "global">(
      "private",
    ),
    [passphrase, setPassphrase] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  const photoVersion = useRef(0);
  async function save() {
    setError("");
    if (!city || (!feeling && !caption.trim() && !photo)) {
      setError(m.formError);
      return;
    }
    if (
      visibility === "private" &&
      (caption.trim() || photo) &&
      passphrase.length < 12
    ) {
      setError(m.passphraseError);
      return;
    }
    setBusy(true);
    try {
      if (visibility === "private") {
        const id = crypto.randomUUID();
        const cipher =
          caption.trim() || photo
            ? await encrypt(
                JSON.stringify({ caption: caption.trim(), photo }),
                passphrase,
                id,
              )
            : null;
        await savePrivateMoment({
          id,
          scope: await privateScope(),
          cityId: city,
          feeling,
          promptId: dailyPrompt().id,
          createdAt: new Date().toISOString(),
          cipher,
          schemaVersion: 1,
        });
        worldAnalytics.track("moment_saved_private");
        setResult(m.savedPrivate);
      } else {
        if (!supabase()) {
          setError(m.publicUnavailable);
          return;
        }
        const headers = await tokenHeaders();
        if (!headers.Authorization) {
          onAuth();
          return;
        }
        const response = await fetch("/api/moments", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId: city,
            feeling,
            caption: caption.trim(),
            visibility,
            publicConsent: consent,
            image: photo ? photo.split(",")[1] : undefined,
            language: "und",
          }),
        });
        if (response.status === 429) {
          setError(m.rateError);
          return;
        }
        if (response.status === 401) {
          onAuth();
          return;
        }
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (body.state === "approved") worldAnalytics.track("moment_published");
        setResult(
          body.state === "approved"
            ? m.published
            : body.state === "rejected"
              ? m.rejected
              : m.pending,
        );
      }
      setCaption("");
      setPhoto("");
      setPassphrase("");
      onSaved();
    } catch {
      setError(m.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={m.addTitle} closeLabel={m.close} onClose={onClose}>
      {result ? (
        <div className="moment-success">
          <Check size={34} />
          <h2>{result}</h2>
          <p>{visibility === "private" ? m.privateHelp : m.publicHelp}</p>
          <button className="world-primary" onClick={onClose}>
            {m.close}
          </button>
        </div>
      ) : (
        <>
          <span className="world-kicker">{m.promptTitle}</span>
          <p className="dialog-prompt">{dailyPrompt().text}</p>
          <h2>{m.addTitle}</h2>
          <p>{m.addBody}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              {m.visibility}
              <select
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as typeof visibility);
                  setConsent(false);
                }}
              >
                <option value="private">{m.onlyMe}</option>
                <option value="city">{m.cityPublic}</option>
                <option value="global">{m.globalPublic}</option>
              </select>
            </label>
            <div className="visibility-note">
              {visibility === "private" ? (
                <LockKeyhole size={17} />
              ) : (
                <Globe2 size={17} />
              )}
              <p>
                {visibility === "private"
                  ? m.privateHelp
                  : visibility === "city"
                    ? m.cityPublicHelp
                    : m.globalPublicHelp}
              </p>
            </div>
            <label>
              {m.city}
              <select
                aria-label={m.city}
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">{m.chooseCity}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}, {c.country}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="world-feelings">
              <legend>{m.feeling}</legend>
              <div>
                {feelings.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={feeling === f}
                    onClick={() => setFeeling(feeling === f ? null : f)}
                  >
                    {m.feelings[f]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="photo-picker">
              <ImagePlus size={22} />
              {m.photo}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const version = ++photoVersion.current;
                  setBusy(true);
                  setError("");
                  try {
                    const image = await preparePhoto(file);
                    if (version === photoVersion.current) setPhoto(image);
                  } catch {
                    setError(m.photoError);
                  } finally {
                    if (version === photoVersion.current) setBusy(false);
                  }
                }}
              />
            </label>
            <p className="world-help">{m.photoHelp}</p>
            {photo && (
              <div className="selected-photo">
                <Image
                  src={photo}
                  alt={m.photoPreviewAlt}
                  width={500}
                  height={350}
                  unoptimized
                />
                <button
                  type="button"
                  className="world-text"
                  onClick={() => {
                    photoVersion.current++;
                    setPhoto("");
                    setBusy(false);
                  }}
                >
                  {m.removePhoto}
                </button>
              </div>
            )}
            <label>
              {m.caption}
              <textarea
                maxLength={180}
                value={caption}
                placeholder={m.captionPlaceholder}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
            {visibility === "private" && (photo || caption.trim()) && (
              <label>
                {m.passphrase}
                <input
                  type="password"
                  autoComplete="off"
                  minLength={12}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <span className="world-help">{m.passphraseHelp}</span>
              </label>
            )}
            {visibility !== "private" && (
              <>
                <p className="world-help">
                  {m.publicHelp} {m.publicWarning}
                </p>
                <label className="world-checkbox">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  {m.publicConsent}
                </label>
              </>
            )}
            {error && (
              <p className="world-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="world-primary full"
              disabled={busy || (visibility !== "private" && !consent)}
            >
              {busy
                ? m.saving
                : visibility === "private"
                  ? m.savePrivate
                  : m.submit}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="private-alternative">
            <p>{m.privateCheckin}</p>
            <Link href="/me">{m.privateCheckinLink} ↗</Link>
          </div>
        </>
      )}
    </Dialog>
  );
}
