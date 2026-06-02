import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { analyzeAndStore } from "@/lib/marketing/learnings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

// Generate (or regenerate) the AI deep-analysis for one conversation.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ ok: false, reason: "no_id" }, { status: 400 });

  const analysis = await analyzeAndStore(String(body.id), Boolean(body.force));
  if (!analysis) return NextResponse.json({ ok: false, reason: "analysis_failed" }, { status: 200 });
  return NextResponse.json({ ok: true, analysis });
}
