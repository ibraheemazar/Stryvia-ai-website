import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/lib/utils";
import { getServiceSupabase } from "@/lib/supabase";
import { notifyNewLead } from "@/lib/notify";
import type { EarlyAccessBody } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Secondary capture (Spec §6.20). Feeds the same destination the Chat
// conversion does, with whatever context the visitor offered.
export async function POST(req: NextRequest) {
  let body: EarlyAccessBody;
  try {
    body = (await req.json()) as EarlyAccessBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().slice(0, 320);
  const name = body.name ? String(body.name).trim().slice(0, 200) : "Early access";
  const context = body.context ? String(body.context).trim().slice(0, 2000) : undefined;
  const locale = ["en", "ar", "fr"].includes(body.locale) ? body.locale : "en";

  if (!email) {
    return NextResponse.json({ ok: false, error: "required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "email" }, { status: 400 });
  }

  const conversationId = crypto.randomUUID();
  const supabase = getServiceSupabase();
  if (supabase) {
    try {
      // Represent early access as a conversation + lead so it lands in the
      // same Inbox the Chat conversions do.
      await supabase.from("conversations").upsert({
        id: conversationId,
        locale,
        page_context: "early-access",
        status: "converted",
        summary: context ?? "Early access request",
        problem_category: "other",
        converted: true,
      });
      await supabase.from("leads").insert({
        conversation_id: conversationId,
        name,
        email,
        status: "new",
        notes: context ? `Early access: ${context}` : "Early access request",
      });
    } catch (err) {
      console.error("[stryvia] early access store failed:", err);
    }
  }

  await notifyNewLead({
    name,
    email,
    summary: context ?? "Early access request",
    problemCategory: "early_access",
    locale,
    conversationId,
    messages: context ? [{ role: "user", content: context }] : [],
  });

  return NextResponse.json({ ok: true });
}
