import type { NextRequest } from "next/server";
import { z } from "zod";
import { runTurn } from "@/lib/lab/engine";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { streamTurn } from "@/lib/lab/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({ clientTurnId: z.string().min(8).max(80) });

// Regenerate the assistant reply for the last visitor message without
// re-saving it — the transcript is never lost on a failed AI call.
export const POST = withLabRoute<{ id: string }>("lab.session.retry", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  const parsed = await readJson(req, Schema);
  if (!parsed.ok) return parsed.res;
  const outcome = await runTurn({
    session,
    content: "",
    inputMode: "text",
    clientTurnId: parsed.data.clientTurnId,
    requestId,
    retry: true,
  });
  return streamTurn(outcome);
});
