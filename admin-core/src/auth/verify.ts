import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin access control: a single admin login to start, Supabase Auth with an
// email allowlist, expandable later. The dashboard sends the user's access
// token; we verify it and check the email against the allowlist before any data
// is returned with the service role.

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
  // Fail closed: an unset or empty allowlist must deny everyone, never grant the
  // whole admin to any authenticated Supabase user.
  if (allow.length === 0) {
    console.error("[admin-core] ADMIN_EMAIL_ALLOWLIST is empty — denying admin access.");
    return { ok: false, reason: "no_allowlist" };
  }
  if (!allow.includes(email)) {
    return { ok: false, reason: "not_allowlisted" };
  }
  return { ok: true, email };
}
