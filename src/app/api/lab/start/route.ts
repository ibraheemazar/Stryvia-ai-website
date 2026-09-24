import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { LAB_LIMITS, LAB_PATH } from "@/config/lab.config";
import { isValidEmail } from "@/lib/utils";
import { seedSlots } from "@/lib/lab/engine";
import { magicLinkEmail } from "@/lib/lab/emails";
import { getLabSettings } from "@/lib/lab/env";
import { labEvent } from "@/lib/lab/events";
import { json, labUrl, readJson, withLabRoute } from "@/lib/lab/http";
import { createMagicLink } from "@/lib/lab/magic-link";
import { sendLabMail } from "@/lib/lab/mail";
import { PROMPT_VERSION } from "@/lib/lab/prompts/version";
import { clientIp, hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { buildVisitorCookie } from "@/lib/lab/session-auth";
import { countSessionsForEmailToday, createSession, upsertVisitor } from "@/lib/lab/store";
import { verifyTurnstile } from "@/lib/lab/turnstile";
import { spendCapReached } from "@/lib/lab/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StartSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200),
  phone: z.string().trim().min(5).max(30),
  country: z.string().trim().length(2),
  company: z.string().trim().max(160).optional().nullable(),
  role: z.string().trim().max(120).optional().nullable(),
  language: z.enum(["en", "ar"]),
  consent: z.literal(true),
  consentVersion: z.string(),
  turnstileToken: z.string().max(4000).optional().nullable(),
  /** honeypot — must stay empty */
  website: z.string().max(0).optional(),
});

export const POST = withLabRoute("lab.start", async (req: NextRequest, ctx) => {
  const settings = getLabSettings();
  const ip = clientIp(req);
  if (await isRateLimited(hashKey("start_ip", ip), LAB_LIMITS.startPerIpPerHour, 3600)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  const parsed = await readJson(req, StartSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;
  if (await spendCapReached()) return json({ ok: false, error: "paused" }, 503);

  if (!isValidEmail(body.email)) return json({ ok: false, error: "invalid_email" }, 400);
  if (body.consentVersion !== settings.consentVersion) return json({ ok: false, error: "consent_version" }, 400);
  const phone = parsePhoneNumberFromString(body.phone, body.country.toUpperCase() as never);
  if (!phone || !phone.isValid()) return json({ ok: false, error: "invalid_phone" }, 400);

  if (!(await verifyTurnstile(body.turnstileToken ?? undefined, ip))) {
    return json({ ok: false, error: "bot_check_failed" }, 403);
  }
  const email = body.email.toLowerCase();
  if ((await countSessionsForEmailToday(email)) >= settings.maxSessionsPerEmailPerDay) {
    return json({ ok: false, error: "too_many_sessions" }, 429);
  }

  const visitor = await upsertVisitor(email);
  const session = await createSession(
    {
      visitor_id: visitor.id,
      visitor_name: body.name,
      email,
      phone_e164: phone.number,
      country: body.country.toUpperCase(),
      company: body.company || null,
      role: body.role || null,
      language: body.language,
      consent_version: body.consentVersion,
      prompt_version: PROMPT_VERSION,
      ip_hash: hashKey("ip", ip),
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    seedSlots({ country: body.country.toUpperCase(), company: body.company, role: body.role }),
  );
  await labEvent("session.started", "info", { sessionId: session.id, requestId: ctx.requestId, payload: { language: body.language } });

  // Resume link — async, never blocks the start.
  void (async () => {
    try {
      const { token } = await createMagicLink(email, "resume", hashKey("ip", ip));
      const url = labUrl(`/api/lab/auth?token=${token}&lang=${body.language}`, "en");
      const mail = magicLinkEmail({ language: body.language, name: body.name, url, expiresHours: LAB_LIMITS.magicLinkTtlHours });
      await sendLabMail({ ...mail, to: email, kind: "magic_link", sessionId: session.id });
    } catch (err) {
      await labEvent("magic_link.send_failed", "error", { sessionId: session.id, payload: { error: String(err) } });
    }
  })();

  const cookie = buildVisitorCookie(visitor.id, visitor.cookie_generation);
  const res = NextResponse.json(
    { ok: true, sessionId: session.id, url: `${body.language === "ar" ? "/ar" : ""}${LAB_PATH}/s/${session.id}` },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
});
