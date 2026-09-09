"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) router.push("/");
        else setMessage("Account created. Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><div className="brand-mark">W</div><div><strong>WorkPilot</strong><span>AI workforce control plane</span></div></div>
    <div className="auth-copy"><span className="section-kicker">SECURE WORKSPACE</span><h1>{mode === "login" ? "Welcome back" : "Create your workspace"}</h1><p>{mode === "login" ? "Sign in to manage your AI workforce." : "Start a private AI operations workspace."}</p></div>
    <form onSubmit={submit} className="auth-form"><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength={6} required /></label><button className="primary auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in →" : "Create account →"}</button></form>
    {error && <div className="auth-error">{error}</div>}{message && <div className="auth-message">{message}</div>}
    <button className="auth-switch" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setError("");setMessage("")}}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
    <small className="auth-foot">Your workspace is protected by Supabase authentication and company-level access controls.</small>
  </section></main>;
}
