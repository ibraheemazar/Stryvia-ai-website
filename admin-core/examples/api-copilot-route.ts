// Example copilot route. Copy to `app/api/admin/copilot/route.ts`.
// Every admin route follows this shape: verifyAdmin first, then do the work.
import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../src/auth/verify";
import { streamClaude, clampMessages, type ChatMessage } from "../src/ai/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COPILOT_SYSTEM = `You are the admin copilot for this website. Answer the
operator's questions about the business honestly and concisely. Never invent
numbers — if you don't have the data, say so. Below is the current data context.`;

// Optional: assemble a compact fact sheet to ground the copilot. Pull from your
// enabled modules (e.g. CRM totals, analytics) and return a short string.
async function buildContext(): Promise<string> {
  // e.g. const { insights } = await getCrmData({ view: "all" });
  return "No data context wired yet.";
}

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

  const system = `${COPILOT_SYSTEM}\n\n=== DATA ===\n${await buildContext()}`;
  return streamClaude(system, messages);
}
