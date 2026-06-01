import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { resolveSegmentLeads } from "@/lib/marketing/actions";
import { sendMarketingEmail, sesConfigured } from "@/lib/marketing/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Send an email campaign to a segment (or all leads) via SES, and record it.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.subject || !body?.body) {
    return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }
  if (!sesConfigured()) {
    return NextResponse.json({ ok: false, reason: "ses_not_configured" }, { status: 503 });
  }

  const rules = body.rules || {};
  const leads = await resolveSegmentLeads(rules);
  if (leads.length === 0) {
    return NextResponse.json({ ok: false, reason: "empty_audience" }, { status: 400 });
  }

  const result = await sendMarketingEmail(
    leads.map((l) => ({ email: l.email, name: l.name })),
    String(body.subject).slice(0, 200),
    String(body.body).slice(0, 20000),
  );

  const svc = requireService();
  await svc.from("marketing_campaigns").insert({
    name: String(body.name || body.subject).slice(0, 200),
    channel: "email",
    status: result.sent > 0 ? "sent" : "failed",
    subject: String(body.subject).slice(0, 200),
    sent_at: new Date().toISOString(),
    stats: { audience: leads.length, sent: result.sent, failed: result.failed },
  });

  return NextResponse.json({ ok: true, ...result, audience: leads.length });
}
