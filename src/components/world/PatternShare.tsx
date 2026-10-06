"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { worldMessages } from "@/lib/world/i18n";
import { renderPersonalShare } from "@/lib/world/share";
import Dialog from "./Dialog";
import { worldAnalytics } from "@/lib/world/domain";
// Receives only an already displayed, deterministic insight. No observation or journal access.
export default function PatternShare({
  summary,
  locale,
}: {
  summary: string;
  locale: string;
}) {
  const m = worldMessages(locale);
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="world-text"
        onClick={() => {
          setConsent(false);
          setError("");
          setOpen(true);
        }}
      >
        <Share2 size={16} />
        {m.patternShare}
      </button>
      {open && (
        <Dialog
          title={m.patternShareTitle}
          closeLabel={m.close}
          onClose={() => setOpen(false)}
        >
          <h2>{m.patternShareTitle}</h2>
          <p>{m.patternShareBody}</p>
          <div className="share-card-preview">
            <h3>{m.personalInsight}</h3>
            <p>{summary}</p>
            <small>{m.personalInsightDisclosure}</small>
          </div>
          <label className="world-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {m.patternShareConsent}
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            className="world-primary"
            disabled={!consent}
            onClick={async () => {
              try {
                const blob = await renderPersonalShare(summary, consent, m);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "my-chosen-pattern.png";
                a.click();
                worldAnalytics.track("share_created");
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              } catch {
                setError(m.shareUnavailable);
              }
            }}
          >
            {m.downloadCard}
          </button>
        </Dialog>
      )}
    </>
  );
}
