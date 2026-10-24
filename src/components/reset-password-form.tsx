"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, invalid }: { token: string; invalid: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setBusy(false);
      setError("Passwords do not match.");
      return;
    }
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("This reset link is invalid or expired. Request a new link.");
        return;
      }
      setComplete(true);
    } catch {
      setError("Agent.Raven could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (invalid) return <div className="stack"><div className="form-error" role="alert">This reset link is invalid or expired.</div><Link className="btn primary" href="/forgot-password">Request a new link</Link></div>;
  if (complete) return <div className="stack"><div className="auth-notice" role="status">Your password has been changed and existing sessions were signed out.</div><Link className="btn primary" href="/sign-in">Sign in</Link></div>;

  return <form onSubmit={submit} className="stack">
    <div className="field"><label htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><span className="field-hint">Use at least 12 characters.</span></div>
    <div className="field"><label htmlFor="confirmPassword">Confirm new password</label><input className="input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="btn primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
  </form>;
}
