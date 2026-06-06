import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase access. The service-role client is used only inside
// route handlers — never shipped to the client — and bypasses RLS, so it must
// only ever run after verifyAdmin() has passed.

let serviceClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** The service client guaranteed to exist, or throws. */
export function requireService(): SupabaseClient {
  const svc = getServiceSupabase();
  if (!svc) throw new Error("Supabase service role not configured.");
  return svc;
}
