import { NextRequest } from "next/server";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import {
  buildSystemPrompt,
  extractSignal,
  stripPartialToken,
} from "@/lib/chat/systemPrompt";
import { persistConversation, markConversationStatus } from "@/lib/chat/store";
import type { ChatRequestBody, ChatMessage } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Metadata frame delimiter (ASCII record separator) — the client reads visible
// text until this byte, then parses the trailing JSON for the control signal.
const RS = "\x1e";

// Best-effort in-memory rate limit. Serverless instances are ephemeral, so this
// throttles bursts per instance; a durable limiter can be added at the edge.
const HITS = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = HITS.get(ip);
  if (!entry || now > entry.reset) {
    HITS.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const MAX_MESSAGE_CHARS = 6000;
const MAX_MESSAGES = 40;

function sanitize(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content.trim().length > 0);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return new Response("Too many requests. Take a breath and try again.", {
      status: 429,
    });
  }

  if (!hasAnthropic()) {
    return new Response(
      "The Chat isn't connected yet. Add ANTHROPIC_API_KEY to enable it.",
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  const messages = sanitize(body.messages ?? []);
  if (messages.length === 0) {
    return new Response("No message to respond to.", { status: 400 });
  }

  const locale = ["en", "ar", "fr"].includes(body.locale) ? body.locale : "en";
  const pageContext = body.pageContext?.slice(0, 400);
  const conversationId = body.conversationId || crypto.randomUUID();
  const system = buildSystemPrompt(locale, pageContext);

  const encoder = new TextEncoder();
  const anthropic = getAnthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let sent = "";

      try {
        const anthropicStream = anthropic.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: 1400,
          temperature: 0.6,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            // Show text with any partial control token at the tail hidden.
            const display = stripPartialToken(full);
            if (display.length > sent.length) {
              controller.enqueue(encoder.encode(display.slice(sent.length)));
              sent = display;
            }
          }
        }

        const { clean, signal } = extractSignal(full);
        // Flush any remaining clean text not yet sent.
        if (clean.length > sent.length) {
          controller.enqueue(encoder.encode(clean.slice(sent.length)));
        }

        // Persist the full transcript including this assistant turn.
        const finalMessages: ChatMessage[] = [
          ...messages,
          { role: "assistant", content: clean },
        ];
        const status =
          signal === "human" ? "escalated" : signal === "ready" ? "scoped" : "active";
        await persistConversation({
          conversationId,
          locale,
          pageContext,
          status,
          messages: finalMessages,
        });
        if (signal === "human") {
          await markConversationStatus(conversationId, "escalated");
        }

        // Trailing metadata frame.
        controller.enqueue(
          encoder.encode(
            RS + JSON.stringify({ signal: signal ?? null, conversationId }),
          ),
        );
        controller.close();
      } catch (err) {
        console.error("[stryvia] chat stream error:", err);
        // Surface a concise reason so the client can show an error state and so
        // failures are diagnosable, then close gracefully — calling
        // controller.error() here would discard the frame and yield an empty
        // 200, leaving the visitor with a silent blank response.
        const status =
          (err as { status?: number })?.status ?? null;
        const detail =
          (err as { error?: { error?: { message?: string } } })?.error?.error
            ?.message ||
          (err as { message?: string })?.message ||
          "unknown error";
        try {
          controller.enqueue(
            encoder.encode(
              RS +
                JSON.stringify({
                  signal: null,
                  conversationId,
                  error: true,
                  status,
                  detail: String(detail).slice(0, 300),
                }),
            ),
          );
          controller.close();
        } catch {
          /* stream already torn down */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Conversation-Id": conversationId,
    },
  });
}
