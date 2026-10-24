"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

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
      const result = await authClient.signUp.email({
        name: String(form.get("name")).trim(),
        email: String(form.get("email")).trim(),
        password,
      });
      if (result.error) {
        setError("Account creation failed. Sign in or use password recovery if this email is already registered.");
        return;
      }

      const workspace = await fetch("/api/account/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceName: String(form.get("workspaceName")).trim() }),
      });
      if (!workspace.ok) {
        await authClient.signOut();
        setError("Your account was created, but workspace setup did not finish. Sign in to retry safely.");
        return;
      }

      router.push("/overview");
      router.refresh();
    } catch {
      setError("Agent.Raven could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="stack">
    <div className="field"><label htmlFor="name">Your name</label><input className="input" id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required /></div>
    <div className="field"><label htmlFor="workspaceName">Workspace name</label><input className="input" id="workspaceName" name="workspaceName" autoComplete="organization" minLength={2} maxLength={80} required /></div>
    <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
    <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><span className="field-hint">Use at least 12 characters.</span></div>
    <div className="field"><label htmlFor="confirmPassword">Confirm password</label><input className="input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="btn primary" type="submit" disabled={busy || !hydrated}>{busy ? "Creating workspace…" : "Create account"}</button>
    <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
  </form>;
}
