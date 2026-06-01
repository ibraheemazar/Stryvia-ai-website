import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Update a lead's status and notes as the manual close progresses (Decisions §5).
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  let body: { id?: string; status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, reason: "no_id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.status && ["new", "contacted", "closed", "lost"].includes(body.status)) {
    update.status = body.status;
  }
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 5000);

  const svc = requireService();
  const { error } = await svc.from("leads").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
