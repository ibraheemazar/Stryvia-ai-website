"use client";

import { useEffect, useState, useCallback } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { AdminLogin } from "@/app/supadmin/AdminLogin";
import { AdminShell } from "@/app/supadmin/AdminShell";

// Admin entry: gate on a Supabase session, then render the dashboard. The
// dashboard calls the auth-gated /api/admin routes with the access token.
export default function AdminPage() {
  const supabase = getBrowserSupabase();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;

    // Safety net: never strand the user on the loading screen. If the session
    // check is slow or hangs, fall through to the login form after a beat.
    const fallback = setTimeout(() => {
      if (active) setReady(true);
    }, 4000);

    // Initial session check, fully guarded so a failure can't strand the UI.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setToken(data.session?.access_token ?? null);
        setEmail(data.session?.user?.email ?? null);
      })
      .catch((err) => console.error("[stryvia] session check failed:", err))
      .finally(() => {
        if (active) setReady(true);
      });

    // React to sign-in / sign-out using the session passed to the callback.
    // Never call getSession() in here — Supabase holds its auth lock while the
    // callback runs, so a nested getSession() can deadlock and hang forever.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setToken(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setToken(null);
  }, [supabase]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sv-base">
        <span className="sv-label sv-label--live">LOADING</span>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sv-base px-6">
        <div className="max-w-md text-center">
          <p className="sv-label sv-label--live">ADMIN</p>
          <h1 className="mt-4 font-display text-sv-h2 text-sv-text">
            Supabase isn&apos;t connected yet.
          </h1>
          <p className="mt-3 text-sv-small text-sv-text-2">
            Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL_ALLOWLIST to enable the
            dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!token) return <AdminLogin />;

  return <AdminShell token={token} email={email} onSignOut={signOut} />;
}
