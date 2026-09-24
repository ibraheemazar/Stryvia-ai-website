import { NextResponse, type NextRequest } from "next/server";
import { LAB_NAME, type LabLanguage } from "@/config/lab.config";
import { deletionDoneEmail } from "@/lib/lab/emails";
import { labEvent } from "@/lib/lab/events";
import { escapeHtml } from "@/lib/lab/guardrails";
import { withLabRoute } from "@/lib/lab/http";
import { consumeMagicLink, magicLinkIsValid } from "@/lib/lab/magic-link";
import { sendLabMail } from "@/lib/lab/mail";
import { hashKey } from "@/lib/lab/rate-limit";
import { deleteVisitorData, getVisitorByEmail, recordDeletionRequest } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deletion confirm: GET shows a page with a POST button (never delete on a
// prefetchable GET); POST consumes the token and hard-deletes everything.

function page(l: LabLanguage, token: string, state: "confirm" | "done" | "invalid"): NextResponse {
  const dir = l === "ar" ? "rtl" : "ltr";
  const c =
    l === "ar"
      ? {
          confirm: { title: "تأكيد الحذف النهائي", body: "سيُحذف كل ما يرتبط ببريدك في مختبر الأفكار: المحادثات والملخصات وبيانات التواصل. لا يمكن التراجع.", cta: "احذف بياناتي" },
          done: { title: "تم الحذف", body: "لم يبقَ لدينا أي بيانات عنك في مختبر الأفكار.", cta: "" },
          invalid: { title: "الرابط لم يعد صالحًا", body: "انتهت صلاحيته أو استُخدم من قبل.", cta: "" },
        }
      : {
          confirm: { title: "Confirm permanent deletion", body: "Everything linked to your email in the Idea Lab will be deleted: conversations, briefs and contact details. This cannot be undone.", cta: "Delete my data" },
          done: { title: "Deleted", body: "We no longer hold any Idea Lab data about you.", cta: "" },
          invalid: { title: "This link is no longer valid", body: "It expired or was already used.", cta: "" },
        };
  const copy = c[state];
  const action =
    state === "confirm"
      ? `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="lang" value="${l}"><button type="submit">${copy.cta}</button></form>`
      : "";
  const html = `<!doctype html><html lang="${l}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(LAB_NAME[l])}</title>
<style>body{margin:0;background:#0a0b0a;color:#f4f6f4;font-family:${l === "ar" ? "'IBM Plex Sans Arabic',Tahoma,sans-serif" : "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif"};display:grid;place-items:center;min-height:100dvh;padding:24px}main{max-width:440px;width:100%}.eyebrow{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:${l === "ar" ? 0 : ".14em"};text-transform:uppercase;color:rgba(244,246,244,.5)}h1{font-size:28px;line-height:1.2;margin:16px 0 12px;font-weight:600}p{color:rgba(244,246,244,.66);line-height:1.6;margin:0 0 24px}button{background:#ff6b5c;color:#0a0b0a;border:0;border-radius:4px;padding:14px 22px;font:inherit;font-weight:600;font-size:16px;cursor:pointer;min-height:44px}</style></head>
<body><main><div class="eyebrow">${escapeHtml(LAB_NAME[l])}</div><h1>${copy.title}</h1><p>${copy.body}</p>${action}</main></body></html>`;
  return new NextResponse(html, { status: state === "invalid" ? 410 : 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = withLabRoute("lab.privacy.confirm.get", async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const l: LabLanguage = req.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en";
  const valid = token ? await magicLinkIsValid(token, "delete") : false;
  return page(l, token, valid ? "confirm" : "invalid");
});

export const POST = withLabRoute("lab.privacy.confirm.post", async (req: NextRequest, ctx) => {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const l: LabLanguage = form?.get("lang") === "ar" ? "ar" : "en";
  const email = token ? await consumeMagicLink(token, "delete") : null;
  if (!email) return page(l, "", "invalid");
  const visitor = await getVisitorByEmail(email);
  let deleted = 0;
  if (visitor) deleted = await deleteVisitorData(visitor.id);
  await recordDeletionRequest({ email_hash: hashKey("email", email), confirmed_at: new Date().toISOString(), sessions_deleted: deleted });
  await labEvent("privacy.deleted", "info", { requestId: ctx.requestId, payload: { count: deleted } });
  const mail = deletionDoneEmail({ language: l });
  await sendLabMail({ ...mail, to: email, kind: "delete_done" });
  return page(l, "", "done");
});
