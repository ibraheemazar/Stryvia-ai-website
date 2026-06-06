import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "./anthropic";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Streams a Claude completion as plain text for the admin AI surfaces. The data
// context is injected as a system block; the conversation is the operator's
// turns. Errors are surfaced inline so the UI never hangs silently.
export function streamClaude(system: string, messages: ChatMessage[]): Response {
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
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("[admin-core] AI stream error:", err);
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
