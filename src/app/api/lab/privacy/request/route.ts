import type { NextRequest } from "next/server";
import { z } from "zod";
import { LAB_LIMITS } from "@/config/lab.config";
import { isValidEmail } from "@/lib/utils";
import { deleteLinkEmail } from "@/lib/lab/emails";
import { labEvent } from "@/lib/lab/events";
import { json, labUrl, readJson, withLabRoute } from "@/lib/lab/http";
import { createMagicLink } from "@/lib/lab/magic-link";
import { sendLabMail } from "@/lib/lab/mail";
import { clientIp, hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { getVisitorByEmail, recordDeletionRequest } from "@/lib/lab/store";
import { verifyTurnstile } from "@/lib/lab/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().max(200),
  language: z.enum(["en", "ar"]).default("en"),
  turnstileToken: z.string().max(4000).optional().nullable(),
  website: z.string().max(0).optional(),
});

// "Delete my data" (brief §9): email a confirmation link; always {ok:true}.
export const POST = withLabRoute("lab.privacy.request", async (req: NextRequest, ctx) => {
  const ip = clientIp(req);
  const parsed = await readJson(req, Schema);
  if (!parsed.ok) return parsed.res;
  const { email, language, turnstileToken } = parsed.data;
  if (!isValidEmail(email)) return json({ ok: true });
  if (!(await verifyTurnstile(turnstileToken ?? undefined, ip))) return json({ ok: false, error: "bot_check_failed" }, 403);
  const eKey = hashKey("delete_email", email);
  if (
    (await isRateLimited(hashKey("delete_ip", ip), 10, 3600)) ||
    (await isRateLimited(`${eKey}:h`, LAB_LIMITS.magicLinkPerEmailPerHour, 3600)) ||
    (await isRateLimited(`${eKey}:d`, LAB_LIMITS.magicLinkPerEmailPerDay, 86400))
  ) {
    return json({ ok: true });
  }
  await recordDeletionRequest({ email_hash: hashKey("email", email) });
  const visitor = await getVisitorByEmail(email);
  if (!visitor) return json({ ok: true });
  const { token } = await createMagicLink(email, "delete", hashKey("ip", ip));
  const mail = deleteLinkEmail({ language, url: labUrl(`/api/lab/privacy/confirm?token=${token}&lang=${language}`, "en") });
  await sendLabMail({ ...mail, to: email.toLowerCase(), kind: "delete_link" });
  await labEvent("privacy.delete_requested", "info", { requestId: ctx.requestId });
  return json({ ok: true });
});
