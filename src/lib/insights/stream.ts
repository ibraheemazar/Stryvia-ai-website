import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import type { ChatMessage } from "@/lib/chat/types";

// Core: stream a Claude completion as plain text from already-built message
// params (which may carry image / document content blocks). Errors surface
// inline so the UI never hangs silently.
export function streamClaudeMessages(
  system: string,
  messages: Anthropic.Messages.MessageParam[],
): Response {
  if (!hasAnthropic()) {
    return new Response(
      "The intelligence isn't connected yet — add ANTHROPIC_API_KEY to enable it.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const encoder = new TextEncoder();
  const anthropic = getAnthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = anthropic.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: 2000,
          system,
          messages,
        });
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("[stryvia] admin AI stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n_The intelligence hit an error. Please try again._"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

// Streams a Claude completion from plain-text admin turns (analytics, copilot).
export function streamClaude(system: string, messages: ChatMessage[]): Response {
  return streamClaudeMessages(
    system,
    messages.map((m) => ({ role: m.role, content: m.content })),
  );
}

const RANGES = ["7d", "30d", "90d"] as const;
export function parseRange(v: string | null | undefined): (typeof RANGES)[number] {
  return RANGES.includes(v as (typeof RANGES)[number]) ? (v as (typeof RANGES)[number]) : "30d";
}

// Trim a conversation to the last N turns to bound token cost.
export function clampMessages(messages: ChatMessage[], max = 16): ChatMessage[] {
  return (messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}
