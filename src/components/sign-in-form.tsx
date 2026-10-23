"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInForm(){
  const [hydrated,setHydrated]=useState(false);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  useEffect(()=>{const frame=requestAnimationFrame(()=>setHydrated(true));return()=>cancelAnimationFrame(frame)},[]);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const form=new FormData(e.currentTarget);const result=await authClient.signIn.email({email:String(form.get("email")),password:String(form.get("password"))});setBusy(false);if(result.error){setError("Sign-in failed. Check your email and password.");return}router.push("/overview");router.refresh()}
  return <form onSubmit={submit} className="stack"><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required/></div><div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required/></div>{error&&<div className="form-error" role="alert">{error}</div>}<button className="btn primary" disabled={busy||!hydrated}>{busy?"Signing in…":"Sign in"}</button></form>
}
