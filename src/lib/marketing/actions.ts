import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import { getServiceSupabase } from "@/lib/supabase";
import { BRAND_GUARDRAIL, CONTENT_TYPE_BRIEFS } from "./brand";
import { INTEGRATIONS } from "./integrations";
import { getMarketingOverview } from "./data";

function textOf(res: { content: { type: string }[] }): string {
  const block = res.content.find((b) => b.type === "text") as { text?: string } | undefined;
  return block?.text ?? "";
}

// Generate on-brand marketing content. Uses Stryvia Intelligence (Claude) with
// the brand guardrail so nothing off-voice or off-message ships.
export async function generateContent(args: {
  type: string;
  channel?: string;
  locale?: string;
  brief: string;
}): Promise<string> {
  if (!hasAnthropic()) {
    return "Stryvia Intelligence isn't connected yet (ANTHROPIC_API_KEY). Add it to generate content.";
  }
  const typeBrief = CONTENT_TYPE_BRIEFS[args.type] || "Write the requested marketing content.";
  const localeNote =
    args.locale === "ar"
      ? "Write in natural, idiomatic Gulf Arabic."
      : args.locale === "fr"
        ? "Write in natural French."
        : "Write in English.";

  const res = await getAnthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1400,
    system: `${BRAND_GUARDRAIL}\n\nTASK: ${typeBrief}\n${localeNote}${
      args.channel ? `\nChannel: ${args.channel}.` : ""
    }`,
    messages: [{ role: "user", content: args.brief }],
  });
  return textOf(res).trim();
}

// AI growth advisor: analyse the real metrics and return prioritised
// recommendations, saved as insights.
export async function runAdvisor(): Promise<number> {
  const svc = getServiceSupabase();
  if (!svc || !hasAnthropic()) return 0;
  const overview = await getMarketingOverview();
  if (!overview) return 0;

  const res = await getAnthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1200,
    system:
      `${BRAND_GUARDRAIL}\n\nYou are a senior growth marketer analysing Stryvia's real funnel data. ` +
      `Return ONLY a JSON array of 3–6 objects: {"title": string (max 70 chars), "body": string (one or two sentences, concrete and actionable), "severity": "info"|"opportunity"|"warning"}. ` +
      `Base every recommendation strictly on the data given. No fabricated numbers. No code fences.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          totals: overview.totals,
          funnel: overview.funnel,
          byCategory: overview.byCategory.slice(0, 8),
          bySource: overview.bySource.slice(0, 8),
          byLocale: overview.byLocale,
        }),
      },
    ],
  });

  let items: { title: string; body: string; severity?: string }[] = [];
  try {
    items = JSON.parse(textOf(res).trim());
  } catch {
    return 0;
  }
  const valid = items
    .filter((i) => i.title && i.body)
    .slice(0, 6)
    .map((i) => ({
      kind: "recommendation",
      title: String(i.title).slice(0, 120),
      body: String(i.body).slice(0, 600),
      severity: ["info", "opportunity", "warning"].includes(i.severity || "")
        ? i.severity
        : "info",
    }));
  if (valid.length === 0) return 0;

  // Replace the previous undismissed recommendation set.
  await svc.from("marketing_insights").delete().eq("kind", "recommendation").eq("dismissed", false);
  await svc.from("marketing_insights").insert(valid);
  return valid.length;
}

// Resolve a segment's rules to the matching leads (with email) for sending.
export async function resolveSegmentLeads(rules: {
  category?: string;
  locale?: string;
  converted?: boolean;
  leadStatus?: string;
}): Promise<{ id: string; name: string; email: string; conversation_id: string | null }[]> {
  const svc = getServiceSupabase();
  if (!svc) return [];

  let convFilterIds: string[] | null = null;
  if (rules.category || rules.locale || rules.converted !== undefined) {
    let q = svc.from("conversations").select("id").limit(5000);
    if (rules.category) q = q.eq("problem_category", rules.category);
    if (rules.locale) q = q.eq("locale", rules.locale);
    if (rules.converted !== undefined) q = q.eq("converted", rules.converted);
    const { data } = await q;
    convFilterIds = (data ?? []).map((c) => c.id);
    if (convFilterIds.length === 0) return [];
  }

  let lq = svc.from("leads").select("id, name, email, conversation_id, status").limit(5000);
  if (rules.leadStatus) lq = lq.eq("status", rules.leadStatus);
  if (convFilterIds) lq = lq.in("conversation_id", convFilterIds);
  const { data: leads } = await lq;
  return (leads ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    conversation_id: l.conversation_id,
  }));
}

type AutomationAction = { type: string; params?: Record<string, unknown> };

// Run all enabled automations over recent leads that haven't been processed yet.
// Trigger filters select the audience; actions run in order. Idempotent via the
// automation_runs ledger. Returns how many leads were actioned.
export async function runAutomations(): Promise<number> {
  const svc = getServiceSupabase();
  if (!svc) return 0;

  const { data: autos } = await svc.from("marketing_automations").select("*").eq("enabled", true);
  if (!autos || autos.length === 0) return 0;

  let actioned = 0;
  for (const auto of autos) {
    const trigger = (auto.trigger || {}) as { filters?: Record<string, unknown> };
    const filters = (trigger.filters || {}) as {
      category?: string;
      locale?: string;
      converted?: boolean;
      leadStatus?: string;
    };
    const candidates = await resolveSegmentLeads(filters);

    const { data: prior } = await svc
      .from("marketing_automation_runs")
      .select("lead_id")
      .eq("automation_id", auto.id);
    const done = new Set((prior ?? []).map((r) => r.lead_id));
    const todo = candidates.filter((l) => !done.has(l.id)).slice(0, 100);

    for (const lead of todo) {
      const actions = (auto.actions || []) as AutomationAction[];
      const log: string[] = [];
      for (const a of actions) {
        const p = a.params || {};
        try {
          if (a.type === "send_email" && p.subject && p.body) {
            const { sendMarketingEmail } = await import("./email");
            await sendMarketingEmail(
              [{ email: lead.email, name: lead.name }],
              String(p.subject),
              String(p.body),
            );
            log.push("email");
          } else if (a.type === "set_lead_status" && p.status) {
            await svc.from("leads").update({ status: String(p.status) }).eq("id", lead.id);
            log.push(`status:${p.status}`);
          } else if (a.type === "create_insight" && p.title) {
            await svc.from("marketing_insights").insert({
              kind: "automation",
              title: String(p.title).slice(0, 120),
              body: String(p.body || `Triggered for ${lead.name}`).slice(0, 600),
              severity: "info",
            });
            log.push("insight");
          } else if (a.type === "slack_notify" && process.env.SLACK_WEBHOOK_URL) {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: String(p.message || `Lead ${lead.name} matched ${auto.name}`),
              }),
            });
            log.push("slack");
          }
        } catch (err) {
          log.push(`error:${a.type}`);
          console.error("[stryvia] automation action failed:", err);
        }
      }
      await svc.from("marketing_automation_runs").insert({
        automation_id: auto.id,
        lead_id: lead.id,
        status: "ok",
        detail: log.join(", "),
      });
      actioned++;
    }

    await svc
      .from("marketing_automations")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (auto.run_count || 0) + todo.length,
      })
      .eq("id", auto.id);
  }
  return actioned;
}

// Ensure every catalog integration has a row, marking native ones connected.
export async function seedIntegrations(): Promise<void> {
  const svc = getServiceSupabase();
  if (!svc) return;
  const { data: existing } = await svc.from("marketing_integrations").select("provider");
  const have = new Set((existing ?? []).map((r) => r.provider));
  const missing = INTEGRATIONS.filter((i) => !have.has(i.provider)).map((i) => ({
    provider: i.provider,
    category: i.category,
    status: i.native ? "connected" : "disconnected",
    connected_at: i.native ? new Date().toISOString() : null,
  }));
  if (missing.length) await svc.from("marketing_integrations").insert(missing);
}
