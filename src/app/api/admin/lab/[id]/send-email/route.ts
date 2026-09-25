import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminJson, canDecide, withAdminLabRoute } from "@/lib/lab/admin-http";
import { sendDecisionEmail } from "@/lib/lab/decisions";
import { decisionEmail } from "@/lib/lab/emails";
import { labEvent } from "@/lib/lab/events";
import { getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  action: z.enum(["book_call", "request_quote", "decline"]),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(10).max(6000),
  notes: z.string().trim().max(4000).optional().nullable(),
  language: z.enum(["en", "ar"]).optional(),
  /** "preview" renders the exact email without sending; "send" requires `confirmed: true`. */
  mode: z.enum(["preview", "send"]),
  confirmed: z.boolean().optional(),
  /** Required to send to a visitor who asked not to be contacted. */
  overrideNoContact: z.boolean().optional(),
});

// The ONLY path that sends anything to a visitor after submission (§8 hard
// rule). Two distinct steps: preview (nothing leaves) and send (explicit
// confirmation by an authorised reviewer). A visitor who asked not to be
// contacted is protected by a flag kept outside any generated text.
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.send", async (req: NextRequest, { params, admin, requestId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "invalid_input", issues: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  if (!canDecide(admin)) {
    await labEvent("decision.refused", "warn", { sessionId: params.id, requestId, payload: { actor: "admin", code: "not_reviewer" } });
    return adminJson({ ok: false, error: "not_reviewer" }, 403);
  }
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  if (session.status === "in_progress") return adminJson({ ok: false, error: "not_submitted" }, 409);
  const language = parsed.data.language ?? session.language;

  if (parsed.data.mode === "preview") {
    const mail = decisionEmail({ language, subject: parsed.data.subject, body: parsed.data.body });
    return adminJson({ ok: true, preview: { to: session.email, subject: mail.subject, html: mail.html, text: mail.text }, noContact: Boolean(session.flags?.no_contact), test: Boolean(session.flags?.test) });
  }
  if (parsed.data.confirmed !== true) return adminJson({ ok: false, error: "confirmation_required" }, 400);
  if (session.flags?.no_contact && parsed.data.overrideNoContact !== true) {
    await labEvent("decision.send_blocked", "warn", { sessionId: session.id, requestId, payload: { actor: "admin", code: "no_contact" } });
    return adminJson({ ok: false, error: "no_contact_requested" }, 409);
  }
  const { sent } = await sendDecisionEmail(session, { ...parsed.data, language, decidedBy: admin });
  return adminJson({ ok: true, sent });
});
