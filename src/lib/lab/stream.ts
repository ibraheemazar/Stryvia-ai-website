import "server-only";
import type { TurnMeta } from "./engine";

// Wire protocol shared with /api/chat: visible text, then the ASCII record
// separator, then one JSON meta frame. The client reads text until RS.
export const RS = "\x1e";

export function streamTurn(outcome: { text: AsyncIterable<string>; meta: Promise<TurnMeta> }): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of outcome.text) controller.enqueue(encoder.encode(chunk));
      } catch {
        // The meta frame below carries the error.
      }
      const meta = await outcome.meta;
      controller.enqueue(encoder.encode(RS + JSON.stringify(meta)));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
