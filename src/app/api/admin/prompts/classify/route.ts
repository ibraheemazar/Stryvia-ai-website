import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { classifyPrompt } from "@/lib/prompts/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/prompts/classify  { body, improve? }
// Returns AI-suggested title/category/tags and, when improve is true, a cleaner
// rewrite of an existing prompt. The client decides what to apply.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text: string = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const classification = await classifyPrompt(text, { improve: body?.improve === true });
  if (!classification) return NextResponse.json({ ok: false, reason: "no_model" }, { status: 200 });
  return NextResponse.json({ ok: true, classification });
}
