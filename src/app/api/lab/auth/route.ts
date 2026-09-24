import { NextResponse, type NextRequest } from "next/server";
import { LAB_NAME, LAB_PATH, type LabLanguage } from "@/config/lab.config";
import { escapeHtml } from "@/lib/lab/guardrails";
import { labEvent } from "@/lib/lab/events";
import { withLabRoute } from "@/lib/lab/http";
import { consumeMagicLink, magicLinkIsValid } from "@/lib/lab/magic-link";
import { buildVisitorCookie } from "@/lib/lab/session-auth";
import { getVisitorByEmail, listSessionsForVisitor, markEmailVerified } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Magic-link landing. GET only renders a confirm page (email scanners prefetch
// links, so a GET must never consume the token); POST consumes it, sets the
// visitor cookie and redirects to the latest in-progress session.

function lang(req: NextRequest): LabLanguage {
  return req.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en";
}

function page(l: LabLanguage, token: string, valid: boolean): NextResponse {
  const dir = l === "ar" ? "rtl" : "ltr";
  const copy =
    l === "ar"
      ? valid
        ? { title: "متابعة محادثتك", body: "اضغط للمتابعة إلى مختبر الأفكار على هذا الجهاز.", cta: "متابعة" }
        : { title: "الرابط لم يعد صالحًا", body: "انتهت صلاحية هذا الرابط أو استُخدم من قبل. اطلب رابطًا جديدًا من صفحة المتابعة.", cta: "طلب رابط جديد" }
      : valid
        ? { title: "Continue your conversation", body: "Press continue to open the Idea Lab on this device.", cta: "Continue" }
        : { title: "This link is no longer valid", body: "It expired or was already used. Request a new one from the resume page.", cta: "Request a new link" };
  const action = valid ? `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="lang" value="${l}"><button type="submit">${copy.cta}</button></form>` : `<a class="btn" href="${l === "ar" ? "/ar" : ""}${LAB_PATH}/resume">${copy.cta}</a>`;
  const html = `<!doctype html><html lang="${l}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(LAB_NAME[l])}</title>
<style>body{margin:0;background:#0a0b0a;color:#f4f6f4;font-family:${l === "ar" ? "'IBM Plex Sans Arabic',Tahoma,sans-serif" : "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif"};display:grid;place-items:center;min-height:100dvh;padding:24px}main{max-width:440px;width:100%}.eyebrow{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:${l === "ar" ? 0 : ".14em"};text-transform:uppercase;color:rgba(244,246,244,.5)}h1{font-size:28px;line-height:1.2;margin:16px 0 12px;font-weight:600}p{color:rgba(244,246,244,.66);line-height:1.6;margin:0 0 24px}button,.btn{display:inline-block;background:#c0fa20;color:#0a0b0a;border:0;border-radius:4px;padding:14px 22px;font:inherit;font-weight:600;font-size:16px;cursor:pointer;text-decoration:none;min-height:44px}</style></head>
<body><main><div class="eyebrow">${escapeHtml(LAB_NAME[l])}</div><h1>${copy.title}</h1><p>${copy.body}</p>${action}</main></body></html>`;
  return new NextResponse(html, { status: valid ? 200 : 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = withLabRoute("lab.auth.get", async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const valid = token ? await magicLinkIsValid(token, "resume") : false;
  return page(lang(req), token, valid);
});

export const POST = withLabRoute("lab.auth.post", async (req: NextRequest, ctx) => {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const l: LabLanguage = form?.get("lang") === "ar" ? "ar" : "en";
  const email = token ? await consumeMagicLink(token, "resume") : null;
  if (!email) return page(l, "", false);

  const visitor = await getVisitorByEmail(email);
  if (!visitor) return page(l, "", false);
  await markEmailVerified(visitor.id);
  const sessions = await listSessionsForVisitor(visitor.id);
  const target = sessions.find((s) => s.status === "in_progress") ?? sessions[0];
  const prefix = l === "ar" ? "/ar" : "";
  const dest = target ? `${prefix}${LAB_PATH}/s/${target.id}` : `${prefix}${LAB_PATH}`;
  await labEvent("magic_link.consumed", "info", { sessionId: target?.id ?? null, requestId: ctx.requestId });

  const cookie = buildVisitorCookie(visitor.id, visitor.cookie_generation);
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin), 303);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
});
