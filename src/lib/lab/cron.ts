import "server-only";
import { getServiceSupabase } from "@/lib/supabase";
import { emailShell } from "./emails";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { sendLabMail } from "./mail";
import { hasEvent, insertEvent } from "./store";
import { runPostSubmit } from "./submit";

// Scheduled maintenance for the Lab (brief §9, plan 1.7/4.2). Every task is
// idempotent and bounded so a repeated or delayed run is always safe.

function db() {
  const s = getServiceSupabase();
  if (!s) throw new Error("Supabase service role is not configured.");
  return s;
}

/** Re-run the post-submit pipeline for sessions `after()` did not finish. */
export async function labSweep(): Promise<{ resumed: number }> {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await db()
    .from("lab_sessions")
    .select("id")
    .eq("status", "submitted")
    .in("assessment_status", ["pending", "failed", "running"])
    .lt("updated_at", cutoff)
    .order("submitted_at", { ascending: true })
    .limit(5);
  let resumed = 0;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    try {
      await runPostSubmit(row.id);
      resumed += 1;
    } catch (err) {
      await labEvent("sweep.failed", "error", { sessionId: row.id, payload: { error: String(err) } });
    }
  }
  // Clear stale turn locks (a crashed function must never freeze a session).
  await db()
    .from("lab_sessions")
    .update({ pending_turn_id: null, pending_started_at: null })
    .not("pending_turn_id", "is", null)
    .lt("pending_started_at", new Date(Date.now() - 5 * 60_000).toISOString());
  return { resumed };
}

/** Retention (§9): hard-delete sessions past the configured age. Visitors
 *  with no remaining sessions are removed too, so nothing identifying stays. */
export async function labRetention(): Promise<{ sessions: number; visitors: number }> {
  const months = getLabSettings().retentionMonths;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const iso = cutoff.toISOString();
  const { data: old } = await db().from("lab_sessions").select("id, visitor_id").lt("last_active_at", iso).limit(500);
  const rows = (old ?? []) as Array<{ id: string; visitor_id: string }>;
  if (rows.length) {
    const { error } = await db().from("lab_sessions").delete().in("id", rows.map((r) => r.id));
    if (error) throw new Error(error.message);
  }
  // Orphaned visitors (no sessions left) and expired magic links.
  const { data: orphans } = await db().rpc("lab_orphan_visitors").select("id");
  let visitors = 0;
  if (orphans && Array.isArray(orphans) && orphans.length) {
    const ids = (orphans as Array<{ id: string }>).map((o) => o.id);
    await db().from("lab_visitors").delete().in("id", ids);
    visitors = ids.length;
  }
  await db().from("lab_magic_links").delete().lt("expires_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  await db().from("lab_rate_limits").delete().lt("window_start", new Date(Date.now() - 2 * 86_400_000).toISOString());
  if (rows.length || visitors) {
    await labEvent("retention.run", "info", { payload: { count: rows.length, actor: "system" } });
  }
  return { sessions: rows.length, visitors };
}

/** Monthly spend alert + hard cap circuit breaker (§9). */
export async function labSpendCheck(): Promise<{ monthUsd: number; alerted: boolean; capped: boolean }> {
  const settings = getLabSettings();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("lab_ai_calls").select("cost_usd").gte("created_at", start.toISOString());
  const monthUsd = ((data ?? []) as Array<{ cost_usd: number | string }>).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const monthKey = start.toISOString().slice(0, 7);
  let alerted = false;
  const capped = monthUsd >= settings.monthlySpendHardCapUsd;

  if (monthUsd >= settings.monthlySpendAlertUsd && settings.notifyTo) {
    const kind = `spend.alert.${monthKey}`;
    const { data: existing } = await db().from("lab_events").select("id").eq("kind", kind).limit(1).maybeSingle();
    if (!existing) {
      const title = `Idea Lab spend alert — $${monthUsd.toFixed(2)} this month`;
      const { html, text } = emailShell({
        language: "en",
        title,
        bodyHtml: `<p>The Idea Lab has spent <strong>$${monthUsd.toFixed(2)}</strong> on the Anthropic API since ${monthKey}-01 (alert threshold $${settings.monthlySpendAlertUsd}). ${capped ? `The hard cap of $${settings.monthlySpendHardCapUsd} is reached: new sessions are paused until next month or until LAB_MONTHLY_SPEND_HARD_CAP_USD is raised.` : `New sessions pause automatically at $${settings.monthlySpendHardCapUsd}.`}</p>`,
        bodyText: `Idea Lab spend this month: $${monthUsd.toFixed(2)} (alert at $${settings.monthlySpendAlertUsd}, hard cap $${settings.monthlySpendHardCapUsd}).`,
      });
      await sendLabMail({ to: settings.notifyTo, subject: title, html, text, kind: "spend_alert" });
      await insertEvent({ session_id: null, kind, level: "warn", payload: { cost_usd: Math.round(monthUsd * 100) / 100 } });
      alerted = true;
    }
  }
  return { monthUsd: Math.round(monthUsd * 100) / 100, alerted, capped };
}

/** True when the monthly hard cap is reached (checked at session start). */
export async function spendCapReached(): Promise<boolean> {
  const settings = getLabSettings();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { data } = await supabase.from("lab_ai_calls").select("cost_usd").gte("created_at", start.toISOString());
  const monthUsd = ((data ?? []) as Array<{ cost_usd: number | string }>).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  return monthUsd >= settings.monthlySpendHardCapUsd;
}

export { hasEvent };
