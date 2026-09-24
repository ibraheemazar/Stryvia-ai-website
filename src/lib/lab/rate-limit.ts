import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { labLog } from "./log";

// Durable rate limiting (brief §9) backed by the `lab_rate_limit_hit` SQL
// function (fixed window, atomic upsert). Keys never contain raw PII: emails
// and IPs are hashed before they reach the database.

export function hashKey(kind: string, value: string): string {
  return `${kind}:${createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32)}`;
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Returns true when the caller is OVER the limit. Fails open on DB errors
 * (logged) so an outage never blocks the product; Turnstile + honeypot still
 * apply upstream.
 */
export async function isRateLimited(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("lab_rate_limit_hit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    labLog("error", "rate_limit.rpc_failed", { error: error.message });
    return false;
  }
  return data === true;
}
