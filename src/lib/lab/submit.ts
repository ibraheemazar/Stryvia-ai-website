import "server-only";
import type { LabLanguage } from "@/config/lab.config";
import { LAB_PATH } from "@/config/lab.config";
import { getLatestAssessment, runAssessment } from "./assessor";
import { briefCopyEmail } from "./emails";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { labUrl } from "./http";
import { sendLabMail } from "./mail";
import { notifyFounder } from "./notify";
import { renderBriefText } from "./render";
import { normalizeBrief } from "./schemas";
import { getSessionById, getSubmittedOrCurrentBrief, hasEvent, type LabSessionRow } from "./store";

// Everything that happens after the visitor presses Submit (brief §2.7, §4.5,
// §6). Each step is idempotent so the cron sweep / admin re-run can safely
// repeat it if `after()` was cut short.

export async function emailBriefCopy(session: LabSessionRow): Promise<void> {
  if (await hasEvent(session.id, "mail.sent.brief_copy")) return;
  const brief = await getSubmittedOrCurrentBrief(session);
  if (!brief) return;
  const settings = getLabSettings();
  const content = normalizeBrief(brief.content);
  const mail = briefCopyEmail({
    language: brief.language as LabLanguage,
    name: session.visitor_name,
    briefHtml: brief.rendered_html,
    briefText: renderBriefText(content, brief.language as LabLanguage, { flags: session.flags ?? {} }),
    responseDays: settings.responseDays,
    sessionUrl: labUrl(`${LAB_PATH}/s/${session.id}`, brief.language as LabLanguage),
  });
  await sendLabMail({ ...mail, to: session.email, kind: "brief_copy", sessionId: session.id });
}

/** Run (or resume) the post-submit pipeline for a session. Safe to repeat. */
export async function runPostSubmit(sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session || session.status === "deleted" || !session.submitted_at) return;

  await emailBriefCopy(session).catch((err) =>
    labEvent("post_submit.brief_copy_failed", "error", { sessionId, payload: { error: String(err) } }),
  );

  let assessment = await getLatestAssessment(sessionId);
  if (!assessment || session.assessment_status !== "done") {
    try {
      assessment = await runAssessment(session, "system");
    } catch {
      // Logged by runAssessment; notify with what we have so the founder still hears.
    }
  }
  const fresh = (await getSessionById(sessionId)) ?? session;
  await notifyFounder(fresh, assessment).catch((err) =>
    labEvent("post_submit.notify_failed", "error", { sessionId, payload: { error: String(err) } }),
  );
}
