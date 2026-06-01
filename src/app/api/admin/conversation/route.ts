import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full transcript + metadata + lead for one conversation (Decisions §5).
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, reason: "no_id" }, { status: 400 });

  const svc = requireService();
  const [{ data: conversation }, { data: messages }, { data: leads }] = await Promise.all([
    svc.from("conversations").select("*").eq("id", id).single(),
    svc.from("messages").select("*").eq("conversation_id", id).order("created_at"),
    svc.from("leads").select("*").eq("conversation_id", id),
  ]);

  return NextResponse.json({
    ok: true,
    conversation,
    messages: messages ?? [],
    lead: leads?.[0] ?? null,
  });
}
