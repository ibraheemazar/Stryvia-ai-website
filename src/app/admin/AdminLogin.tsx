"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";
import { Bracket } from "@/components/ui/Bracket";
import { isValidEmail } from "@/lib/utils";

// Single admin login (Decisions §5): Supabase Auth magic link. The email
// allowlist is enforced server-side on every data request.
export function AdminLogin() {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) return setError("Enter a valid email.");
    if (!supabase) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-sv-base px-6">
      <div className="relative w-full max-w-sm rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-8">
        <Bracket live focusIn />
        <p className="sv-label sv-label--live">STRYVIA ADMIN</p>
        <h1 className="mt-4 font-display text-sv-h2 text-sv-text">Sign in</h1>

        {sent ? (
          <p className="mt-4 text-sv-small text-sv-text-2">
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@stryvia.ai"
              className="w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
            />
            {error && <p className="text-sv-small text-sv-danger">{error}</p>}
            <Button variant="primary" type="submit" disabled={sending} className="w-full">
              {sending ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
