import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { hasAnthropic } from "@/lib/anthropic";
import { sesConfigured } from "@/lib/email/ses";
import { getLabSettings } from "@/lib/lab/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Honest health check (production-readiness §3): real dependency probes,
// component booleans only — never env names or values.
export async function GET() {
  const checks: Record<string, boolean> = { db: false, ai: hasAnthropic(), email: sesConfigured(), lab: false, botProtection: false };
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase.from("lab_rate_limits").select("key", { count: "exact", head: true }).limit(1);
    checks.db = !error;
  }
  const lab = getLabSettings();
  checks.lab = lab.enabled;
  checks.botProtection = lab.turnstile.enabled;
  const healthy = checks.db && checks.ai;
  return NextResponse.json(
    { ok: healthy, checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
