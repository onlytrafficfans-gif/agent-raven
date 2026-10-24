"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInForm(){
  const [hydrated,setHydrated]=useState(false);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  useEffect(()=>{const frame=requestAnimationFrame(()=>setHydrated(true));return()=>cancelAnimationFrame(frame)},[]);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData(e.currentTarget);
      const result=await authClient.signIn.email({
        email:String(form.get("email")),
        password:String(form.get("password")),
        rememberMe:form.get("rememberMe")==="on",
      });
      if(result.error){setError("Sign-in failed. Check your email and password.");return}
      const workspace=await fetch("/api/account/workspace",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
      if(!workspace.ok){setError("Signed in, but the workspace could not be prepared. Try again.");return}
      router.push("/overview");router.refresh();
    } catch {
      setError("Agent.Raven could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className="stack">
    <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required/></div>
    <div className="field"><div className="field-label-row"><label htmlFor="password">Password</label><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required/></div>
    <label className="checkbox-row" htmlFor="rememberMe"><input id="rememberMe" name="rememberMe" type="checkbox" defaultChecked/><span>Remember me on this device</span></label>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <button className="btn primary" type="submit" disabled={busy||!hydrated}>{busy?"Signing in…":"Sign in"}</button>
    <p className="auth-switch">New to Agent.Raven? <Link href="/sign-up">Create an account</Link></p>
  </form>
}
