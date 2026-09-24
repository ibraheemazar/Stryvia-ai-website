"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { AdminLogin } from "@/app/supadmin/AdminLogin";
import { AdminThemePicker } from "@/app/supadmin/AdminThemePicker";

// Same Supabase-session gate as /supadmin, with the Lab's own header. The
// allowlist is enforced server-side on every /api/admin/lab request.
export function LabAdminGate({ children, title }: { children: (token: string, email: string | null) => React.ReactNode; title: string }) {
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
    const fallback = setTimeout(() => active && setReady(true), 4000);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setToken(data.session?.access_token ?? null);
        setEmail(data.session?.user?.email ?? null);
      })
      .catch(() => undefined)
      .finally(() => active && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
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
        <p className="text-sv-small text-sv-text-2">Supabase isn&apos;t connected yet.</p>
      </div>
    );
  }
  if (!token) return <AdminLogin />;

  return (
    <div className="min-h-dvh bg-sv-base text-sv-text">
      <header className="flex items-center justify-between gap-4 border-b border-sv-line px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/supadmin" className="flex items-center gap-3" title="Back to admin">
            <span className="sv-live-dot" />
            <span className="sv-label sv-label--live">STRYVIA ADMIN</span>
          </Link>
          <nav className="flex items-center gap-2 text-sv-small">
            <Link href="/supadmin" className="rounded-sv-sm px-3 py-1.5 text-sv-text-3 hover:text-sv-text">Leads</Link>
            <Link href="/supadmin/lab" className="rounded-sv-sm bg-sv-surface-3 px-3 py-1.5 text-sv-text">Idea Lab</Link>
            <span className="hidden text-sv-text-3 sm:inline">/ {title}</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sv-small text-sv-text-3 sm:block">{email}</span>
          <AdminThemePicker />
          <button onClick={signOut} className="text-sv-small text-sv-text-2 transition-colors hover:text-sv-text">
            Sign out
          </button>
        </div>
      </header>
      {children(token, email)}
    </div>
  );
}
