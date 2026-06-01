import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { resolveSegmentLeads } from "@/lib/marketing/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  const svc = requireService();

  if (body.action === "preview") {
    const leads = await resolveSegmentLeads(body.rules || {});
    return NextResponse.json({ ok: true, count: leads.length });
  }

  if (body.action === "create") {
    const { error } = await svc.from("marketing_segments").insert({
      name: String(body.name || "Untitled segment").slice(0, 200),
      description: body.description ? String(body.description).slice(0, 500) : null,
      rules: body.rules || {},
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    await svc.from("marketing_segments").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
}
