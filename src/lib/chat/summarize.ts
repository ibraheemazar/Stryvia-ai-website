import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import type { ChatMessage } from "./types";

// At conversion (and optionally for non-converted conversations), generate a
// short summary and a problem category so the admin Inbox and Insights are
// readable without opening every transcript (Decisions §5 + §6).

const CATEGORIES = [
  "product_or_app",
  "new_venture",
  "brand_and_creative",
  "marketing_and_growth",
  "operations_and_automation",
  "finance_and_modeling",
  "strategy_and_research",
  "sales_and_crm",
  "data_and_dashboards",
  "investor_materials",
  "other",
] as const;

export type ConversationDigest = {
  summary: string;
  problem_category: string;
};

export async function summarizeConversation(
  messages: ChatMessage[],
): Promise<ConversationDigest> {
  const fallback: ConversationDigest = {
    summary: messages.find((m) => m.role === "user")?.content.slice(0, 280) ?? "",
    problem_category: "other",
  };
  if (!hasAnthropic() || messages.length === 0) return fallback;

  const transcript = messages
    .map((m) => `${m.role === "user" ? "VISITOR" : "STRYVIA"}: ${m.content}`)
    .join("\n");

  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      // temperature is deprecated for claude-opus-4-8 and rejected by the API.
      system:
        "You label sales conversations for an internal dashboard. Reply ONLY with a " +
        "compact JSON object: {\"summary\": string (max 240 chars, what the visitor " +
        "wants, plainly), \"problem_category\": one of " +
        CATEGORIES.join(", ") +
        "}. No prose, no code fences.",
      messages: [{ role: "user", content: transcript }],
    });

    const text =
      res.content.find((b) => b.type === "text")?.type === "text"
        ? (res.content.find((b) => b.type === "text") as { text: string }).text
        : "";
    const parsed = JSON.parse(text.trim());
    const category = CATEGORIES.includes(parsed.problem_category)
      ? parsed.problem_category
      : "other";
    return {
      summary: String(parsed.summary ?? fallback.summary).slice(0, 240),
      problem_category: category,
    };
  } catch (err) {
    console.error("[stryvia] summarizeConversation failed:", err);
    return fallback;
  }
}
