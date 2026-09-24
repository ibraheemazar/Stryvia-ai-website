import "server-only";
import type { LabLanguage } from "@/config/lab.config";
import { getLabAi, LabAiError } from "./ai";
import { recordDecision } from "./admin";
import { decisionEmail } from "./emails";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { sendLabMail } from "./mail";
import { DECISION_FROZEN, buildDecisionUser, fallbackDraft, type DecisionAction } from "./prompts/decision";
import { DecisionEmailSchema } from "./schemas";
import { BriefSchema } from "./schemas";
import { getLatestBrief, type LabSessionRow } from "./store";

// Decision actions (brief §8): draft → admin edits → explicit send. The
// visitor only ever receives what the admin approved.

export async function draftDecisionEmail(
  session: LabSessionRow,
  action: DecisionAction,
  opts: { language?: LabLanguage; adminHint?: string | null } = {},
): Promise<{ subject: string; body: string; source: "model" | "template" }> {
  const settings = getLabSettings();
  const brief = await getLatestBrief(session.id);
  const parsed = brief ? BriefSchema.safeParse(brief.content) : null;
  const language = opts.language ?? (session.language as LabLanguage);
  const input = {
    action,
    language,
    visitorFirstName: session.visitor_name.split(/\s+/)[0] || session.visitor_name,
    briefTitle: parsed?.success ? parsed.data.title : "your idea",
    briefOneLine: parsed?.success ? parsed.data.one_line : "",
    schedulingUrl: action === "book_call" ? settings.schedulingUrl ?? null : null,
    adminHint: opts.adminHint?.slice(0, 600) ?? null,
  };
  try {
    const { value } = await getLabAi().structured({
      role: "draft",
      sessionId: session.id,
      actor: "admin",
      frozenSystem: DECISION_FROZEN,
      messages: [{ role: "user", content: buildDecisionUser(input) }],
      schema: DecisionEmailSchema,
      timeoutMs: 45_000,
    });
    return { subject: value.subject.slice(0, 200), body: value.body.slice(0, 4000), source: "model" };
  } catch (err) {
    await labEvent("decision.draft_fallback", "warn", {
      sessionId: session.id,
      payload: { code: err instanceof LabAiError ? err.code : "unknown", kind: action },
    });
    return { ...fallbackDraft(input), source: "template" };
  }
}

export async function sendDecisionEmail(
  session: LabSessionRow,
  input: { action: DecisionAction; subject: string; body: string; notes?: string | null; decidedBy: string; language?: LabLanguage },
): Promise<{ sent: boolean }> {
  const settings = getLabSettings();
  const language = input.language ?? (session.language as LabLanguage);
  const cta =
    input.action === "book_call" && settings.schedulingUrl
      ? { ctaLabel: language === "ar" ? "احجز وقتًا" : "Book a time", ctaUrl: settings.schedulingUrl }
      : {};
  const mail = decisionEmail({ language, subject: input.subject.slice(0, 200), body: input.body.slice(0, 6000), ...cta });
  const sent = await sendLabMail({ ...mail, to: session.email, replyTo: settings.notifyTo, kind: `decision_${input.action}`, sessionId: session.id });
  await recordDecision({
    session_id: session.id,
    decision: input.action,
    notes: input.notes ?? null,
    decided_by: input.decidedBy,
    outbound_email_subject: input.subject,
    outbound_email_body: input.body,
    outbound_email_sent_at: sent ? new Date().toISOString() : null,
  });
  return { sent };
}
