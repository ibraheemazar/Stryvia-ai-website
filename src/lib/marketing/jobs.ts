import "server-only";
import { getServiceSupabase } from "@/lib/supabase";
import { sendMarketingEmail, sesConfigured } from "./email";

// Background jobs run by the scheduler (Vercel Cron via /api/cron).

// Mark stale active conversations as abandoned so the funnel reflects reality.
export async function markAbandoned(minutes = 45): Promise<number> {
  const svc = getServiceSupabase();
  if (!svc) return 0;
  const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
  const { data, error } = await svc
    .from("conversations")
    .update({ status: "abandoned" })
    .eq("status", "active")
    .eq("converted", false)
    .lt("updated_at", cutoff)
    .select("id");
  if (error) {
    console.error("[stryvia] markAbandoned failed:", error);
    return 0;
  }
  return (data ?? []).length;
}

// Daily digest of non-converted conversations worth reading (Decisions §5).
export async function sendDailyDigest(): Promise<boolean> {
  const svc = getServiceSupabase();
  const to = process.env.LEAD_NOTIFY_TO;
  if (!svc || !to || !sesConfigured()) return false;

  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data } = await svc
    .from("conversations")
    .select("summary, problem_category, locale, status, converted, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const converted = rows.filter((r) => r.converted).length;
  const nonConverted = rows.filter((r) => !r.converted && r.summary);

  const lines = nonConverted
    .slice(0, 50)
    .map((r) => `• [${r.problem_category || "—"} · ${r.locale}] ${r.summary}`)
    .join("\n");

  const body =
    `Stryvia — last 24h\n\n` +
    `Conversations: ${rows.length}\nConverted: ${converted}\nWorth reading (non-converted): ${nonConverted.length}\n\n` +
    `${lines || "No non-converted conversations with summaries in the last 24h."}\n`;

  await sendMarketingEmail([{ email: to }], `Stryvia daily digest — ${rows.length} conversations`, body);
  return true;
}
