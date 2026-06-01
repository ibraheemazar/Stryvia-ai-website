import "server-only";
import { getServiceSupabase } from "@/lib/supabase";
import type { ChatMessage } from "./types";

// Persistence for the Chat (Decisions §5). Every conversation is stored,
// converted or not, with its full transcript, language, the page it started on,
// a short summary, and a problem category. If Supabase is not configured yet,
// these functions no-op so the Chat keeps working in development.

type UpsertConversationArgs = {
  conversationId: string;
  locale: string;
  pageContext?: string;
  status?: "active" | "scoped" | "converted" | "escalated" | "abandoned";
  messages: ChatMessage[];
};

export async function persistConversation(
  args: UpsertConversationArgs,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { conversationId, locale, pageContext, status, messages } = args;
  const now = new Date().toISOString();

  try {
    await supabase.from("conversations").upsert(
      {
        id: conversationId,
        locale,
        page_context: pageContext ?? null,
        status: status ?? "active",
        updated_at: now,
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

    // Replace the message set for this conversation with the current transcript.
    // Simple and correct for short scoping conversations.
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    if (messages.length > 0) {
      await supabase.from("messages").insert(
        messages.map((m) => ({
          conversation_id: conversationId,
          role: m.role,
          content: m.content,
        })),
      );
    }
  } catch (err) {
    console.error("[stryvia] persistConversation failed:", err);
  }
}

export async function markConversationStatus(
  conversationId: string,
  status: "active" | "scoped" | "converted" | "escalated" | "abandoned",
  fields?: { summary?: string; problem_category?: string; converted?: boolean },
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from("conversations")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(fields?.summary ? { summary: fields.summary } : {}),
        ...(fields?.problem_category
          ? { problem_category: fields.problem_category }
          : {}),
        ...(fields?.converted !== undefined ? { converted: fields.converted } : {}),
      })
      .eq("id", conversationId);
  } catch (err) {
    console.error("[stryvia] markConversationStatus failed:", err);
  }
}

type CreateLeadArgs = {
  conversationId: string;
  name: string;
  email: string;
  company?: string;
};

export async function createLead(args: CreateLeadArgs): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("leads").insert({
      conversation_id: args.conversationId,
      name: args.name,
      email: args.email,
      company: args.company ?? null,
      status: "new",
    });
    if (error) {
      console.error("[stryvia] createLead failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[stryvia] createLead failed:", err);
    return false;
  }
}
