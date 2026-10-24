"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/account/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email")).trim() }),
      });
      if (response.status === 503) {
        setError("Password email delivery is not configured yet. Contact the workspace owner.");
        return;
      }
      if (!response.ok) {
        setError("The reset request could not be completed. Try again shortly.");
        return;
      }
      setSent(true);
    } catch {
      setError("Agent.Raven could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <div className="stack"><div className="auth-notice" role="status">If an account exists for that email, its reset link is on the way. The link expires in one hour.</div><Link className="btn ghost" href="/sign-in">Back to sign in</Link></div>;

  return <form onSubmit={submit} className="stack">
    <div className="field"><label htmlFor="email">Account email</label><input className="input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>
  </form>;
}
