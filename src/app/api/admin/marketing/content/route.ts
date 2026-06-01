import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { generateContent } from "@/lib/marketing/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Generate (does not persist; the user saves what they like).
  if (body.action === "generate") {
    const text = await generateContent({
      type: String(body.type || "social_post"),
      channel: body.channel ? String(body.channel) : undefined,
      locale: body.locale ? String(body.locale) : "en",
      brief: String(body.brief || "").slice(0, 4000),
    });
    return NextResponse.json({ ok: true, text });
  }

  const svc = requireService();

  if (body.action === "save") {
    const { error } = await svc.from("marketing_content").insert({
      type: String(body.type || "social_post"),
      channel: body.channel ? String(body.channel) : null,
      locale: String(body.locale || "en"),
      title: body.title ? String(body.title).slice(0, 200) : null,
      body: String(body.body || "").slice(0, 20000),
      status: "draft",
      meta: body.meta || {},
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status" && body.id) {
    await svc
      .from("marketing_content")
      .update({ status: String(body.status), updated_at: new Date().toISOString() })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    await svc.from("marketing_content").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
}
