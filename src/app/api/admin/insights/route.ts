import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getInsightsSnapshot } from "@/lib/insights/snapshot";
import { parseRange } from "@/lib/insights/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The analytics snapshot: GA4 + first-party funnel. Auth-gated; cached upstream.
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  const fresh = url.searchParams.get("fresh") === "1";
  const snapshot = await getInsightsSnapshot(range, { fresh });
  return NextResponse.json({ ok: true, snapshot });
}
