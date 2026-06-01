import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/marketing/actions";
import { markAbandoned, sendDailyDigest } from "@/lib/marketing/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Scheduled jobs, driven by Vercel Cron (see vercel.json). Secured by CRON_SECRET
// when set; Vercel sends it in the Authorization header.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow until a secret is configured
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}` || req.headers.has("x-vercel-cron");
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const task = new URL(req.url).searchParams.get("task") || "tick";

  if (task === "digest") {
    const sent = await sendDailyDigest();
    return NextResponse.json({ ok: true, task, digestSent: sent });
  }

  // default "tick": run automations + sweep abandoned conversations
  const [actioned, abandoned] = await Promise.all([runAutomations(), markAbandoned()]);
  return NextResponse.json({ ok: true, task, actioned, abandoned });
}
