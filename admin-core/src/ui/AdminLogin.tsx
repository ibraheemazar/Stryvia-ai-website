"use client";

import { useState } from "react";
import { getBrowserSupabase } from "../auth/supabase-browser";

// Single admin login: Supabase Auth email one-time code. We send a 6-digit code
// rather than a magic link, then verify it in place. The email allowlist is
// still enforced server-side on every data request.

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function AdminLogin({ brandName }: { brandName: string }) {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) return setError("Enter a valid email.");
    if (!supabase) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.trim();
    if (token.length < 6) return setError("Enter the code we emailed you.");
    if (!supabase) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setVerifying(false);
    if (error) setError(error.message);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--admin-accent, #9ef01a)" }}>
          {brandName}
        </p>
        <h1 className="mt-4 text-2xl font-semibold">Sign in</h1>

        {sent ? (
          <form onSubmit={onVerify} className="mt-5 space-y-3">
            <p className="text-sm text-zinc-400">Enter the code we sent to {email}.</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter code"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-center text-2xl tracking-[0.4em] outline-none focus:border-zinc-500"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-md py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
              style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }}
            >
              {verifying ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300"
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form onSubmit={onSendCode} className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-500"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-md py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
              style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }}
            >
              {sending ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
