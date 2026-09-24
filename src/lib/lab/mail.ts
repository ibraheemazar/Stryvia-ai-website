import "server-only";
import { createHash } from "node:crypto";
import { sendSesEmail } from "@/lib/email/ses";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { insertEvent } from "./store";

// Outbound mail for the Lab. `ses` sends; `log` (tests, dev without SES) writes
// the message to lab_events so e2e can read the magic link. Never throws.

export type LabMail = { to: string; subject: string; html: string; text: string; replyTo?: string; kind: string; sessionId?: string | null };

export async function sendLabMail(mail: LabMail): Promise<boolean> {
  const settings = getLabSettings();
  const toHash = createHash("sha256").update(mail.to.toLowerCase()).digest("hex").slice(0, 16);
  if (settings.mailProvider === "log") {
    // Test/dev sink: full body stored so tests can extract links. Not PII-free
    // by design; only reachable when SES is not configured or explicitly set.
    await insertEvent({
      session_id: mail.sessionId ?? null,
      kind: `mail.logged.${mail.kind}`,
      level: "info",
      payload: { to: mail.to, subject: mail.subject, text: mail.text },
    });
    return true;
  }
  try {
    const id = await sendSesEmail({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
    await labEvent(`mail.sent.${mail.kind}`, "info", { sessionId: mail.sessionId ?? null, payload: { to_hash: toHash, ok: Boolean(id) } });
    return Boolean(id);
  } catch (err) {
    // Log the provider's error CLASS and code, never the message (it can carry
    // the recipient address).
    const e = err as { name?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number } };
    await labEvent(`mail.failed.${mail.kind}`, "error", {
      sessionId: mail.sessionId ?? null,
      payload: { to_hash: toHash, code: `${e?.name ?? "Error"}${e?.Code || e?.code ? `:${e.Code ?? e.code}` : ""}${e?.$metadata?.httpStatusCode ? `:${e.$metadata.httpStatusCode}` : ""}` },
    });
    return false;
  }
}
