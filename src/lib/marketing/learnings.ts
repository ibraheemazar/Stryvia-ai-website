import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import { getServiceSupabase } from "@/lib/supabase";
import { BRAND_GUARDRAIL } from "./brand";
import type { ChatMessage } from "@/lib/chat/types";

// AI learnings: per-conversation deep analysis and a unified cross-conversation
// synthesis. Both run on Stryvia Intelligence (Claude), grounded strictly in
// real conversation content — no fabricated numbers — and are cached in the DB
// so they're computed once and re-displayed cheaply.

function textOf(res: { content: { type: string }[] }): string {
  const block = res.content.find((b) => b.type === "text") as { text?: string } | undefined;
  return block?.text ?? "";
}

export type ConversationAnalysis = {
  intent: string;
  requests: string[];
  objections: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  outcome_reason: string;
  follow_up: string;
};

const SENTIMENTS = ["positive", "neutral", "negative", "mixed"] as const;

function normalizeAnalysis(raw: Record<string, unknown>): ConversationAnalysis {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 12) : [];
  const sentiment = SENTIMENTS.includes(raw.sentiment as (typeof SENTIMENTS)[number])
    ? (raw.sentiment as ConversationAnalysis["sentiment"])
    : "neutral";
  return {
    intent: String(raw.intent ?? "").slice(0, 600),
    requests: arr(raw.requests),
    objections: arr(raw.objections),
    sentiment,
    outcome_reason: String(raw.outcome_reason ?? "").slice(0, 600),
    follow_up: String(raw.follow_up ?? "").slice(0, 600),
  };
}

// Deep analysis of a single conversation from its transcript.
export async function analyzeConversation(
  messages: ChatMessage[],
): Promise<ConversationAnalysis | null> {
  if (!hasAnthropic() || messages.length === 0) return null;
  const transcript = messages
    .map((m) => `${m.role === "user" ? "VISITOR" : "STRYVIA"}: ${m.content}`)
    .join("\n");

  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system:
        `${BRAND_GUARDRAIL}\n\n` +
        "You analyse a single sales conversation for an internal dashboard. Reply ONLY " +
        'with a JSON object: {"intent": string (what the visitor ultimately wants), ' +
        '"requests": string[] (specific things they asked for), "objections": string[] ' +
        "(hesitations, blockers, or concerns raised), \"sentiment\": one of " +
        '"positive"|"neutral"|"negative"|"mixed", "outcome_reason": string (why it ' +
        'converted or did not), "follow_up": string (the single best next action)}. ' +
        "Base everything strictly on the transcript. Be concrete. No code fences.",
      messages: [{ role: "user", content: transcript }],
    });
    return normalizeAnalysis(JSON.parse(textOf(res).trim()));
  } catch (err) {
    console.error("[stryvia] analyzeConversation failed:", err);
    return null;
  }
}

// Return the stored analysis, or compute + persist it on first request.
export async function analyzeAndStore(
  conversationId: string,
  force = false,
): Promise<ConversationAnalysis | null> {
  const svc = getServiceSupabase();
  if (!svc) return null;

  if (!force) {
    const { data: conv } = await svc
      .from("conversations")
      .select("analysis")
      .eq("id", conversationId)
      .maybeSingle();
    const existing = conv?.analysis as ConversationAnalysis | null;
    if (existing && existing.intent) return existing;
  }

  const { data: msgs } = await svc
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");
  const analysis = await analyzeConversation((msgs ?? []) as ChatMessage[]);
  if (!analysis) return null;

  await svc.from("conversations").update({ analysis }).eq("id", conversationId);
  return analysis;
}

export type UnifiedLearnings = {
  summary: string;
  topRequests: { request: string; count: number; note?: string }[];
  friction: string[];
  messagingGaps: string[];
  productGaps: string[];
  recommendations: { title: string; body: string; priority: "high" | "medium" | "low" }[];
};

// Map-reduce synthesis: read the per-conversation analyses (or summaries) over a
// window and produce one intelligence brief. Synthesizing from digests rather
// than raw transcripts keeps this scalable and within context as data grows.
export async function generateUnifiedLearnings(
  windowDays = 90,
): Promise<{ count: number; learning: Record<string, unknown> | null }> {
  const svc = getServiceSupabase();
  if (!svc || !hasAnthropic()) return { count: 0, learning: null };

  const since = new Date(Date.now() - windowDays * 86400000).toISOString();
  const { data } = await svc
    .from("conversations")
    .select("summary, analysis, problem_category, locale, converted, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);

  const rows = (data ?? []).filter((r) => r.summary || r.analysis);
  if (rows.length === 0) return { count: 0, learning: null };

  const corpus = rows.map((r) => ({
    category: r.problem_category || "uncategorized",
    locale: r.locale || "en",
    converted: !!r.converted,
    ...(r.analysis ? { analysis: r.analysis } : { summary: r.summary }),
  }));

  let payload: Record<string, unknown>;
  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2200,
      system:
        `${BRAND_GUARDRAIL}\n\n` +
        "You are Stryvia's head of growth, synthesizing what the market is telling us " +
        "from real visitor conversations. Reply ONLY with a JSON object: " +
        '{"summary": string (3-4 sentences on the headline takeaway), ' +
        '"topRequests": [{"request": string, "count": number, "note": string}] ' +
        "(the most common asks, ranked, count = how many conversations show it), " +
        '"friction": string[] (recurring blockers/objections that cost conversions), ' +
        '"messagingGaps": string[] (where visitors misunderstand the offering), ' +
        '"productGaps": string[] (things asked for that we do not clearly offer), ' +
        '"recommendations": [{"title": string, "body": string, "priority": ' +
        '"high"|"medium"|"low"}] (prioritised, concrete moves to do better)}. ' +
        "Base everything strictly on the data. Use real frequencies for counts. " +
        "No fabrication. No code fences.",
      messages: [{ role: "user", content: JSON.stringify(corpus).slice(0, 180000) }],
    });
    payload = JSON.parse(textOf(res).trim());
  } catch (err) {
    console.error("[stryvia] generateUnifiedLearnings failed:", err);
    return { count: 0, learning: null };
  }

  const { data: inserted } = await svc
    .from("marketing_learnings")
    .insert({
      scope: "all",
      window_days: windowDays,
      conversations_analyzed: rows.length,
      payload,
      model: ANTHROPIC_MODEL,
    })
    .select("*")
    .single();

  return { count: rows.length, learning: inserted ?? null };
}

export async function getLatestLearning(): Promise<Record<string, unknown> | null> {
  const svc = getServiceSupabase();
  if (!svc) return null;
  const { data } = await svc
    .from("marketing_learnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
