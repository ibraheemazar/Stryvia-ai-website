import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { generateUnifiedLearnings } from "@/lib/marketing/learnings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Synthesis over the conversation corpus can take a while; give it room.
export const maxDuration = 120;

// Generate a fresh unified learnings brief from the real conversation corpus.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const windowDays = Math.min(365, Math.max(7, Number(body?.windowDays) || 90));
  const { count, learning } = await generateUnifiedLearnings(windowDays);
  if (!learning) {
    return NextResponse.json({ ok: false, reason: "no_data_or_model" }, { status: 200 });
  }
  return NextResponse.json({ ok: true, count, learning });
}
