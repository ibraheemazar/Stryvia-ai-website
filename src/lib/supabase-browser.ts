"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client used only by the admin dashboard for auth (magic
// link). Uses the public anon key; all privileged reads go through the
// auth-gated /api/admin routes with the service role.
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  if (!browserClient) {
    browserClient = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClient;
}
