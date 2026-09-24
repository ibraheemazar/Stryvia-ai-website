import "server-only";
import { sendWhatsApp } from "@/lib/marketing/connectors";
import { LAB_ADMIN_PATH } from "@/config/lab.config";
import { redFlagLabels, type LabAssessmentRow } from "./assessor";
import { getLabSettings } from "./env";
import { founderNotifyEmail } from "./emails";
import { labEvent } from "./events";
import { sendLabMail } from "./mail";
import { getState, hasEvent, type LabSessionRow } from "./store";

// Founder notifications (brief §6): email on every submission; email marked
// PRIORITY plus WhatsApp (when configured) for priority_call / productize.
// Idempotent per session via lab_events.

const PRIORITY = new Set(["priority_call", "productize"]);

export async function notifyFounder(session: LabSessionRow, assessment: LabAssessmentRow | null): Promise<void> {
  const settings = getLabSettings();
  if (!settings.notifyTo) return;
  const key = assessment ? "notify.founder.assessed" : "notify.founder.submitted";
  if (await hasEvent(session.id, key)) return;

  const state = await getState(session.id);
  const priority = Boolean(assessment && PRIORITY.has(assessment.verdict));
  const adminUrl = `${settings.siteUrl}${LAB_ADMIN_PATH}/${session.id}`;
  const mail = founderNotifyEmail({
    name: session.visitor_name,
    email: session.email,
    phone: session.phone_e164,
    country: session.country,
    company: session.company,
    language: session.language,
    industry: state.slots.industry?.value ?? null,
    verdict: assessment?.verdict ?? null,
    weighted: assessment?.weighted_score ?? null,
    whyLines: assessment?.why_lines ?? [],
    redFlags: assessment ? redFlagLabels(assessment.red_flags) : [],
    adminUrl,
    priority,
  });
  const ok = await sendLabMail({ ...mail, to: settings.notifyTo, kind: "founder", sessionId: session.id });
  await labEvent(key, ok ? "info" : "warn", { sessionId: session.id, payload: { channel: "email", ok, verdict: assessment?.verdict ?? "pending" } });

  if (priority && settings.notifyWhatsAppTo) {
    const text = `⚡ Idea Lab PRIORITY: ${session.visitor_name} (${state.slots.industry?.value ?? "industry n/a"}, ${session.country}) — ${assessment!.verdict} ${assessment!.weighted_score.toFixed(2)}. ${adminUrl}`;
    const sent = await sendWhatsApp(settings.notifyWhatsAppTo, text);
    await labEvent("notify.founder.whatsapp", sent ? "info" : "warn", { sessionId: session.id, payload: { channel: "whatsapp", ok: sent } });
  }
}
