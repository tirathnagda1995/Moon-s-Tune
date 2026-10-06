"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { LockKeyhole, Trash2, Download } from "lucide-react";
import {
  listPrivateMoments,
  deletePrivateMoment,
  type PrivateMoment,
} from "@/lib/world/private-moments";
import { privateScope, tokenHeaders } from "@/lib/world/client";
import { worldMessages } from "@/lib/world/i18n";
import { cityById } from "@/lib/world/cities";
import type { PublicMoment } from "@/lib/world/domain";
import { decrypt } from "@/lib/crypto";
import Dialog from "./Dialog";
export default function MomentLibrary({ locale }: { locale: string }) {
  const m = worldMessages(locale);
  const [rows, setRows] = useState<PrivateMoment[]>([]),
    [publicRows, setPublicRows] = useState<PublicMoment[]>([]),
    [selected, setSelected] = useState<PrivateMoment | null>(null),
    [password, setPassword] = useState(""),
    [unlocked, setUnlocked] = useState<{
      caption: string;
      photo: string;
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
    const scope = await privateScope();
    setRows(await listPrivateMoments(scope));
    const headers = await tokenHeaders();
    if (headers.Authorization) {
      const r = await fetch("/api/moments", { headers });
      if (r.ok) setPublicRows((await r.json()).moments);
    }
  }
  useEffect(() => {
    void load().catch(() => setError(m.unavailable));
  }, [m.unavailable]);
  return (
    <section className="moment-library">
      <div className="library-heading">
        <div>
          <h2>{m.privateMoments}</h2>
          <p>{m.privateMomentsHint}</p>
        </div>
        <button
          className="world-text"
          onClick={async () => {
            try {
              const data = {
                schemaVersion: 1,
                privateMoments: await listPrivateMoments(await privateScope()),
                publicSubmissions: publicRows,
              };
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "my-moments.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            } catch {
              setError(m.unavailable);
            }
          }}
        >
          <Download size={16} />
          {m.exportMoments}
        </button>
      </div>
      {error && (
        <p className="world-error" role="alert">
          {error}
        </p>
      )}
      {!rows.length && <p className="library-empty">{m.noPrivate}</p>}
      <div className="private-moment-grid">
        {rows.map((row) => (
          <article key={row.id}>
            <span>{cityById(row.cityId)?.name}</span>
            <h3>{row.feeling ? m.feelings[row.feeling] : m.onlyMe}</h3>
            <time>
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(row.createdAt),
              )}
            </time>
            <div>
              {row.cipher && (
                <button
                  className="world-text"
                  onClick={() => {
                    setSelected(row);
                    setPassword("");
                    setUnlocked(null);
                  }}
                >
                  <LockKeyhole size={14} />
                  {m.unlock}
                </button>
              )}
              <button
                className="world-text danger"
                aria-label={m.delete}
                onClick={async () => {
                  if (confirm(m.confirmDelete)) {
                    try {
                      await deletePrivateMoment(row.id, await privateScope());
                      await load();
                    } catch {
                      setError(m.unavailable);
                    }
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <h3>{m.mySubmissions}</h3>
      {!publicRows.length ? (
        <p className="library-empty">{m.noSubmissions}</p>
      ) : (
        publicRows.map((row) => (
          <div className="submission" key={row.id}>
            <span>
              {cityById(row.city_id)?.name} ·{" "}
              {new Date(row.expires_at) < new Date()
                ? m.statusExpired
                : row.moderation_state === "pending"
                  ? m.statusPending
                  : row.moderation_state === "approved"
                    ? m.statusApproved
                    : m.statusRejected}
            </span>
            <button
              className="world-text danger"
              onClick={async () => {
                if (confirm(m.confirmDelete)) {
                  try {
                    const r = await fetch("/api/moments?id=" + row.id, {
                      method: "DELETE",
                      headers: await tokenHeaders(),
                    });
                    if (!r.ok) throw new Error();
                    await load();
                  } catch {
                    setError(m.unavailable);
                  }
                }
              }}
            >
              {m.delete}
            </button>
          </div>
        ))
      )}
      <p className="world-help">
        {m.privateExportHelp} {m.deletePublicHelp}
      </p>
      {selected && (
        <Dialog
          title={m.unlock}
          closeLabel={m.close}
          onClose={() => {
            setSelected(null);
            setUnlocked(null);
            setPassword("");
          }}
        >
          <h2>{m.unlock}</h2>
          {unlocked ? (
            <>
              <p className="unlocked-caption">{unlocked.caption}</p>
              {unlocked.photo && (
                <Image
                  src={unlocked.photo}
                  alt={m.photoPreviewAlt}
                  width={600}
                  height={450}
                  unoptimized
                />
              )}
              <button
                className="world-primary"
                onClick={() => {
                  setUnlocked(null);
                  setPassword("");
                }}
              >
                {m.lock}
              </button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setUnlocked(
                    JSON.parse(
                      await decrypt(selected.cipher!, password, selected.id),
                    ),
                  );
                  setError("");
                } catch {
                  setError(m.unlockError);
                }
              }}
            >
              <label>
                {m.passphrase}
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="world-error">
                  {error}
                </p>
              )}
              <button className="world-primary">{m.unlock}</button>
            </form>
          )}
        </Dialog>
      )}
    </section>
  );
}
