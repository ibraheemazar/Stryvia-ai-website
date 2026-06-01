import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { runAdvisor } from "@/lib/marketing/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generate fresh AI growth recommendations from the real funnel data.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });
  const count = await runAdvisor();
  return NextResponse.json({ ok: true, count });
}
