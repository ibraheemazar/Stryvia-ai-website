import type { NextRequest } from "next/server";
import { z } from "zod";
import { LAB_LIMITS } from "@/config/lab.config";
import { isValidEmail } from "@/lib/utils";
import { magicLinkEmail } from "@/lib/lab/emails";
import { labEvent } from "@/lib/lab/events";
import { json, labUrl, readJson, withLabRoute } from "@/lib/lab/http";
import { createMagicLink } from "@/lib/lab/magic-link";
import { sendLabMail } from "@/lib/lab/mail";
import { clientIp, hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { getVisitorByEmail, listSessionsForVisitor } from "@/lib/lab/store";
import { verifyTurnstile } from "@/lib/lab/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().max(200),
  language: z.enum(["en", "ar"]).default("en"),
  turnstileToken: z.string().max(4000).optional().nullable(),
  website: z.string().max(0).optional(),
});

// Always answers {ok:true} so an attacker cannot enumerate emails.
export const POST = withLabRoute("lab.resume", async (req: NextRequest, ctx) => {
  const ip = clientIp(req);
  const parsed = await readJson(req, Schema);
  if (!parsed.ok) return parsed.res;
  const { email, language, turnstileToken } = parsed.data;
  if (!isValidEmail(email)) return json({ ok: true });
  if (!(await verifyTurnstile(turnstileToken ?? undefined, ip))) return json({ ok: false, error: "bot_check_failed" }, 403);
  if (await isRateLimited(hashKey("resume_ip", ip), 10, 3600)) return json({ ok: true });
  const eKey = hashKey("resume_email", email);
  if (
    (await isRateLimited(`${eKey}:h`, LAB_LIMITS.magicLinkPerEmailPerHour, 3600)) ||
    (await isRateLimited(`${eKey}:d`, LAB_LIMITS.magicLinkPerEmailPerDay, 86400))
  ) {
    return json({ ok: true });
  }

  const visitor = await getVisitorByEmail(email);
  if (!visitor) return json({ ok: true });
  const sessions = await listSessionsForVisitor(visitor.id);
  if (sessions.length === 0) return json({ ok: true });

  const { token } = await createMagicLink(email, "resume", hashKey("ip", ip));
  const url = labUrl(`/api/lab/auth?token=${token}&lang=${language}`, "en");
  const mail = magicLinkEmail({ language, name: sessions[0].visitor_name, url, expiresHours: LAB_LIMITS.magicLinkTtlHours });
  await sendLabMail({ ...mail, to: email.toLowerCase(), kind: "magic_link", sessionId: sessions[0].id });
  await labEvent("magic_link.resume_sent", "info", { sessionId: sessions[0].id, requestId: ctx.requestId });
  return json({ ok: true });
});
