"use client";

import { useEffect, useState, useCallback } from "react";
import type { AdminConfig } from "../config";
import { getBrowserSupabase } from "../auth/supabase-browser";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

// Admin entry point: gate on a Supabase session, then render the shell. The
// shell's modules call the auth-gated /api/admin routes with the access token.
// Mount this from a page at your chosen route (e.g. app/supadmin/page.tsx).
export function AdminApp({ config }: { config: AdminConfig }) {
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

    // Safety net: never strand the user on the loading screen.
    const fallback = setTimeout(() => {
      if (active) setReady(true);
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setToken(data.session?.access_token ?? null);
        setEmail(data.session?.user?.email ?? null);
      })
      .catch((err) => console.error("[admin-core] session check failed:", err))
      .finally(() => {
        if (active) setReady(true);
      });

    // Never call getSession() inside this callback — Supabase holds its auth
    // lock while it runs and a nested call can deadlock.
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
      <div className="grid min-h-dvh place-items-center bg-zinc-950">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Loading</span>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-950 px-6 text-zinc-100">
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Admin</p>
          <h1 className="mt-4 text-2xl font-semibold">Supabase isn&apos;t connected yet.</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL_ALLOWLIST to enable the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!token) return <AdminLogin brandName={config.brand.name} />;

  return <AdminShell config={config} token={token} email={email} onSignOut={signOut} />;
}
