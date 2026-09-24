import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/marketing/actions";
import { markAbandoned, sendDailyDigest, enrichConversations } from "@/lib/marketing/jobs";
import { labRetention, labSpendCheck, labSweep } from "@/lib/lab/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Scheduled jobs, driven by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET` on every cron invocation.
//
// Auth policy: once CRON_SECRET is set, ONLY the bearer secret is accepted —
// the bare `x-vercel-cron` header is spoofable and no longer trusted. Lab
// tasks (which can delete data) require the secret unconditionally.
function authorized(req: NextRequest, requireSecret: boolean): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret) return header === `Bearer ${secret}`;
  return !requireSecret; // legacy tasks stay open only until a secret exists
}

const LAB_TASKS = new Set(["lab_sweep", "lab_retention", "lab_spend_alert"]);

export async function GET(req: NextRequest) {
  const task = new URL(req.url).searchParams.get("task") || "tick";
  if (!authorized(req, LAB_TASKS.has(task))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (task === "lab_sweep") return NextResponse.json({ ok: true, task, ...(await labSweep()) });
  if (task === "lab_retention") return NextResponse.json({ ok: true, task, ...(await labRetention()) });
  if (task === "lab_spend_alert") return NextResponse.json({ ok: true, task, ...(await labSpendCheck()) });

  if (task === "digest") {
    const sent = await sendDailyDigest();
    return NextResponse.json({ ok: true, task, digestSent: sent });
  }

  // default "tick": run automations + sweep abandoned conversations, then
  // backfill digests. markAbandoned runs first so freshly-abandoned chats are
  // eligible for enrichment in the same tick.
  const [actioned, abandoned] = await Promise.all([runAutomations(), markAbandoned()]);
  const enriched = await enrichConversations();
  return NextResponse.json({ ok: true, task, actioned, abandoned, enriched });
}
