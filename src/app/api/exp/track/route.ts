import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/marketing/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public beacon for landing-page experiment events (view / conversion).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.slug || !body?.variantId || !["view", "conversion"].includes(body.kind)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await recordEvent(
    String(body.slug).slice(0, 80),
    String(body.variantId).slice(0, 40),
    body.kind,
  );
  return NextResponse.json({ ok: true });
}
