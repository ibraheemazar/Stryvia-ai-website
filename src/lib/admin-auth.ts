import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase";

// Admin access control (Decisions §5): a single admin login to start, Supabase
// Auth with an email allowlist, expandable later. The dashboard SPA sends the
// user's access token; we verify it and check the email against the allowlist
// before any data is returned with the service role.

export function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdmin(
  authHeader: string | null,
): Promise<{ ok: boolean; email?: string; reason?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, reason: "supabase_unconfigured" };

  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "no_token" };

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return { ok: false, reason: "invalid_token" };

  const email = data.user.email.toLowerCase();
  const allow = adminAllowlist();
  if (allow.length > 0 && !allow.includes(email)) {
    return { ok: false, reason: "not_allowlisted" };
  }
  return { ok: true, email };
}

// Convenience: the service client guaranteed to exist, or throws.
export function requireService() {
  const svc = getServiceSupabase();
  if (!svc) throw new Error("Supabase service role not configured.");
  return svc;
}
