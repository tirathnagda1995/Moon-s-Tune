"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WorldMessages } from "@/lib/world/i18n";
import Dialog from "./Dialog";
export default function AuthDialog({
  m,
  onClose,
}: {
  m: WorldMessages;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog title={m.authTitle} closeLabel={m.close} onClose={onClose}>
      <span className="world-kicker">{m.publicHelp}</span>
      <h2>{m.authTitle}</h2>
      <p>{m.authBody}</p>
      {supabase() ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const { error } = await supabase()!.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: window.location.origin + "/?add=1",
                },
              });
              if (error) throw error;
              setMessage(m.emailSent);
            } catch {
              setMessage(m.unavailable);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {m.email}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="world-primary" disabled={busy}>
            {m.sendLink}
          </button>
        </form>
      ) : (
        <div className="world-notice">{m.publicUnavailable}</div>
      )}
      {message && <p role="status">{message}</p>}
    </Dialog>
  );
}
