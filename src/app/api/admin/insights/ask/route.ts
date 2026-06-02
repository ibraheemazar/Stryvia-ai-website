import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { buildAnalyticsContext, serializeContext } from "@/lib/insights/context";
import { ANALYTICS_SYSTEM } from "@/lib/insights/prompts";
import { streamClaude, parseRange, clampMessages } from "@/lib/insights/stream";
import type { ChatMessage } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streamed analytics advisor: answers questions / writes reports grounded in
// the metrics snapshot for the selected range.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  let body: { messages?: ChatMessage[]; range?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const messages = clampMessages(body.messages ?? []);
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: "no message" }, { status: 400 });
  }

  const range = parseRange(body.range);
  const ctx = await buildAnalyticsContext(range);
  const system = `${ANALYTICS_SYSTEM}\n\n=== DATA ===\n${serializeContext(ctx)}`;
  return streamClaude(system, messages);
}
