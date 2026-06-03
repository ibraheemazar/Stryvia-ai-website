import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { resolveSegmentLeads } from "@/lib/marketing/actions";
import { sendMarketingEmail, sesConfigured } from "@/lib/marketing/email";
import { sendSMS, sendWhatsApp, providerConfigured } from "@/lib/marketing/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// One-off broadcast to a segment over email / SMS / WhatsApp. Reuses the same
// audience resolver as campaigns and the existing channel send plumbing.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ ok: false, reason: "missing_message" }, { status: 400 });

  const channel = ["email", "sms", "whatsapp"].includes(body.channel) ? body.channel : "email";
  const leads = await resolveSegmentLeads(body.rules || {});
  if (leads.length === 0) return NextResponse.json({ ok: false, reason: "empty_audience" }, { status: 400 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  if (channel === "email") {
    if (!sesConfigured()) return NextResponse.json({ ok: false, reason: "ses_not_configured" }, { status: 503 });
    if (!body.subject) return NextResponse.json({ ok: false, reason: "missing_subject" }, { status: 400 });
    const r = await sendMarketingEmail(
      leads.map((l) => ({ email: l.email, name: l.name })),
      String(body.subject).slice(0, 200),
      String(body.message).slice(0, 20000),
    );
    sent = r.sent;
    failed = r.failed;
  } else {
    if (!providerConfigured(channel)) {
      return NextResponse.json({ ok: false, reason: `${channel}_not_configured` }, { status: 503 });
    }
    const msg = String(body.message).slice(0, 1500);
    for (const l of leads.slice(0, 500)) {
      if (!l.phone) {
        skipped++;
        continue;
      }
      const ok = channel === "sms" ? await sendSMS(l.phone, msg) : await sendWhatsApp(l.phone, msg);
      if (ok) sent++;
      else failed++;
    }
  }

  const svc = requireService();
  await svc.from("marketing_campaigns").insert({
    name: `Broadcast (${channel})`,
    channel,
    status: sent > 0 ? "sent" : "failed",
    subject: body.subject ? String(body.subject).slice(0, 200) : null,
    sent_at: new Date().toISOString(),
    stats: { audience: leads.length, sent, failed, skipped },
  });

  return NextResponse.json({ ok: true, channel, audience: leads.length, sent, failed, skipped });
}
