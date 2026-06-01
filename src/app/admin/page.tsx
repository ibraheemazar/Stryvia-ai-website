"use client";

import { useCallbackRef } from "@/app/admin/use-callback-ref";
import { useEffect, useState, useCallback } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { AdminLogin } from "@/app/admin/AdminLogin";
import { AdminDashboard } from "@/app/admin/AdminDashboard";

// Admin entry: gate on a Supabase session, then render the dashboard. The
// dashboard calls the auth-gated /api/admin routes with the access token.
export default function AdminPage() {
  const supabase = getBrowserSupabase();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const sync = useCallbackRef(async () => {
    if (!supabase) {
      setReady(true);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setToken(data.session?.access_token ?? null);
    setEmail(data.session?.user?.email ?? null);
    setReady(true);
  });

  useEffect(() => {
    sync();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => sync());
    return () => sub.subscription.unsubscribe();
  }, [supabase, sync]);

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

  return <AdminDashboard token={token} email={email} onSignOut={signOut} />;
}
