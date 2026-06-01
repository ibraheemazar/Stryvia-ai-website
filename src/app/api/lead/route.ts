import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/lib/utils";
import { persistConversation, markConversationStatus, createLead } from "@/lib/chat/store";
import { summarizeConversation } from "@/lib/chat/summarize";
import { notifyNewLead } from "@/lib/notify";
import { runAutomations } from "@/lib/marketing/actions";
import type { LeadRequestBody, ChatMessage } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return (messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-60)
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 8000) }));
}

export async function POST(req: NextRequest) {
  let body: LeadRequestBody;
  try {
    body = (await req.json()) as LeadRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 320);
  const company = body.company ? String(body.company).trim().slice(0, 200) : undefined;

  if (!name || !email) {
    return NextResponse.json({ ok: false, error: "required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "email" }, { status: 400 });
  }

  const locale = ["en", "ar", "fr"].includes(body.locale) ? body.locale : "en";
  const conversationId = body.conversationId || crypto.randomUUID();
  const messages = sanitizeMessages(body.messages ?? []);
  const pageContext = body.pageContext?.slice(0, 400);

  // Ensure the conversation exists with its full transcript, then digest it.
  await persistConversation({
    conversationId,
    locale,
    pageContext,
    status: "converted",
    messages,
  });

  const digest = await summarizeConversation(messages);

  await markConversationStatus(conversationId, "converted", {
    summary: digest.summary,
    problem_category: digest.problem_category,
    converted: true,
  });

  const stored = await createLead({ conversationId, name, email, company });

  // Immediate notification regardless of DB outcome — the lead must not be lost.
  await notifyNewLead({
    name,
    email,
    company,
    summary: digest.summary,
    problemCategory: digest.problem_category,
    locale,
    conversationId,
    messages,
  });

  // Fire marketing automations for the new lead (non-blocking).
  runAutomations().catch((err) => console.error("[stryvia] automations after lead:", err));

  return NextResponse.json({ ok: true, stored, conversationId });
}
