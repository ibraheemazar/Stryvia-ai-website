"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";
import { Bracket } from "@/components/ui/Bracket";
import { isValidEmail } from "@/lib/utils";

// Single admin login (Decisions §5): Supabase Auth email one-time code. We send
// a 6-digit code rather than a magic link, then verify it in place. The email
// allowlist is still enforced server-side on every data request.
export function AdminLogin() {
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
    if (token.length < 6) return setError("Enter the 6-digit code.");
    if (!supabase) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setVerifying(false);
    // On success the session lands and the page's onAuthStateChange renders the
    // dashboard; only surface the failure path here.
    if (error) setError(error.message);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-sv-base px-6">
      <div className="relative w-full max-w-sm rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-8">
        <Bracket live focusIn />
        <p className="sv-label sv-label--live">STRYVIA ADMIN</p>
        <h1 className="mt-4 font-display text-sv-h2 text-sv-text">Sign in</h1>

        {sent ? (
          <form onSubmit={onVerify} className="mt-5 space-y-3">
            <p className="text-sv-small text-sv-text-2">
              Enter the 6-digit code we sent to {email}.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-center text-sv-h2 tracking-[0.4em] text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
            />
            {error && <p className="text-sv-small text-sv-danger">{error}</p>}
            <Button variant="primary" type="submit" disabled={verifying} className="w-full">
              {verifying ? "Verifying…" : "Verify & sign in"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              className="w-full text-sv-small text-sv-text-3 hover:text-sv-text-2"
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
              placeholder="you@stryvia.ai"
              className="w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
            />
            {error && <p className="text-sv-small text-sv-danger">{error}</p>}
            <Button variant="primary" type="submit" disabled={sending} className="w-full">
              {sending ? "Sending…" : "Send sign-in code"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
