import type { NextRequest } from "next/server";
import { z } from "zod";
import { LAB_CONVERSATION, LAB_LIMITS } from "@/config/lab.config";
import { runTurn } from "@/lib/lab/engine";
import { streamTurn } from "@/lib/lab/stream";
import { sanitizeVisitorText } from "@/lib/lab/guardrails";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { hashKey, isRateLimited } from "@/lib/lab/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Extract (≤25s) + lens (≤30s) + summary (≤30s) + interview (≤50s) can exceed
// 60s on a first turn; the lock TTL and client timeout are aligned with this.
export const maxDuration = 120;

const TurnSchema = z.object({
  content: z.string().max(LAB_CONVERSATION.maxMessageChars + 200).default(""),
  inputMode: z.enum(["text", "voice"]).default("text"),
  transcriptRaw: z.string().max(LAB_CONVERSATION.maxMessageChars).optional().nullable(),
  clientTurnId: z.string().min(8).max(80),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
});

export const POST = withLabRoute<{ id: string }>("lab.session.turn", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  if (session.phase === "review" || session.phase === "done") return json({ ok: false, error: "in_review" }, 409);
  if (await isRateLimited(hashKey("turn", session.id), LAB_LIMITS.turnsPerSessionPerMinute, 60)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  const parsed = await readJson(req, TurnSchema);
  if (!parsed.ok) return parsed.res;
  const content = sanitizeVisitorText(parsed.data.content, LAB_CONVERSATION.maxMessageChars);
  const attachmentIds = parsed.data.attachmentIds ?? [];
  if (!content && attachmentIds.length === 0) return json({ ok: false, error: "empty" }, 400);

  const outcome = await runTurn({
    session,
    content,
    inputMode: parsed.data.inputMode,
    transcriptRaw: parsed.data.transcriptRaw ?? null,
    clientTurnId: parsed.data.clientTurnId,
    requestId,
    attachmentIds,
  });
  return streamTurn(outcome);
});
