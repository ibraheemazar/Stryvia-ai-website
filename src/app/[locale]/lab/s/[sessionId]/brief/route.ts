import { NextResponse, type NextRequest } from "next/server";
import { ownerOr, withLabRoute } from "@/lib/lab/http";
import { getBriefVersion, getSubmittedOrCurrentBrief } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Printable brief (brief §2.7): the server-rendered brief HTML with print CSS.
// After submission this is always the exact submitted version; before, it is
// the current version (or a specific one via ?version=N, for the visitor's own
// history). "Save as PDF" from the browser keeps Arabic shaping and bidi
// correct, which JavaScript PDF libraries do not.
const PRINT_CSS = `<style media="print">@page{margin:16mm}body{background:#fff!important}.no-print{display:none!important}</style>
<style>.no-print{position:fixed;inset-block-start:12px;inset-inline-end:12px;background:#c0fa20;color:#0a0b0a;border:0;border-radius:4px;padding:10px 16px;font:600 14px/1 system-ui,sans-serif;cursor:pointer}</style>`;

export const GET = withLabRoute<{ sessionId: string; locale: string }>("lab.brief.print", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.sessionId);
  if (!owner.ok) return NextResponse.redirect(new URL(`${params.locale === "ar" ? "/ar" : ""}/lab/resume`, req.nextUrl.origin));
  const { session } = owner;
  const requested = req.nextUrl.searchParams.get("version");
  // Once submitted, the print view is frozen to the submitted version.
  const brief =
    requested && session.submitted_brief_version == null
      ? await getBriefVersion(session.id, Number(requested))
      : await getSubmittedOrCurrentBrief(session);
  if (!brief) return NextResponse.redirect(new URL(`${params.locale === "ar" ? "/ar" : ""}/lab/s/${params.sessionId}`, req.nextUrl.origin));
  const label = brief.language === "ar" ? "طباعة / حفظ PDF" : "Print / Save as PDF";
  const stamp =
    brief.language === "ar"
      ? `النسخة ${brief.version}${session.submitted_brief_version === brief.version ? " · النسخة المُرسلة" : ""}`
      : `Version ${brief.version}${session.submitted_brief_version === brief.version ? " · submitted version" : ""}`;
  const html = brief.rendered_html
    .replace("</head>", `${PRINT_CSS}</head>`)
    .replace(/<body([^>]*)>/, `<body$1><button class="no-print" onclick="window.print()">${label}</button>`)
    .replace("<bdi>stryvia.ai</bdi>", `<bdi>stryvia.ai</bdi> · ${stamp}`);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Lab-Brief-Version": String(brief.version) },
  });
});
