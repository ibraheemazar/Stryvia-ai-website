import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordDecision } from "@/lib/lab/admin";
import { adminJson, canDecide, withAdminLabRoute } from "@/lib/lab/admin-http";
import { labEvent } from "@/lib/lab/events";
import { getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  decision: z.enum(["book_call", "request_quote", "decline", "hold"]),
  notes: z.string().trim().max(4000).optional().nullable(),
  /** The reviewer must confirm explicitly; a bare API call never records a decision. */
  confirmed: z.literal(true),
});

// Record a decision WITHOUT sending anything to the visitor (hold, or decided
// offline). Only an authorised reviewer, only with explicit confirmation, only
// on a submitted session. Audited with the reviewer's identity.
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.decision", async (req: NextRequest, { params, admin, requestId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "confirmation_required" }, 400);
  if (!canDecide(admin)) {
    await labEvent("decision.refused", "warn", { sessionId: params.id, requestId, payload: { actor: "admin", code: "not_reviewer" } });
    return adminJson({ ok: false, error: "not_reviewer" }, 403);
  }
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  if (session.status === "in_progress") return adminJson({ ok: false, error: "not_submitted" }, 409);
  const decision = await recordDecision({ session_id: session.id, decision: parsed.data.decision, notes: parsed.data.notes ?? null, decided_by: admin });
  return adminJson({ ok: true, decision });
});
