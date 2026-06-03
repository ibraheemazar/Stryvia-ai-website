import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { runAutomations } from "@/lib/marketing/actions";
import { buildAutomation, suggestAutomations } from "@/lib/marketing/aiassist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // AI: turn a plain-English goal into a full, reviewable automation spec.
  if (body.action === "ai_build") {
    const spec = await buildAutomation(String(body.goal || ""));
    if (!spec) return NextResponse.json({ ok: false, reason: "build_failed" }, { status: 200 });
    return NextResponse.json({ ok: true, spec });
  }
  if (body.action === "suggest") {
    const specs = await suggestAutomations();
    return NextResponse.json({ ok: true, specs });
  }

  const svc = requireService();

  if (body.action === "create") {
    const { error } = await svc.from("marketing_automations").insert({
      name: String(body.name || "Untitled automation").slice(0, 200),
      trigger: body.trigger || { event: "lead_created", filters: {} },
      actions: body.actions || [],
      enabled: Boolean(body.enabled),
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle" && body.id) {
    await svc.from("marketing_automations").update({ enabled: Boolean(body.enabled) }).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    await svc.from("marketing_automations").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "run") {
    const actioned = await runAutomations();
    return NextResponse.json({ ok: true, actioned });
  }

  return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
}
