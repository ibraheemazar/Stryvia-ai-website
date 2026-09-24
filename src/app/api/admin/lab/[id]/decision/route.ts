import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordDecision } from "@/lib/lab/admin";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";
import { getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ decision: z.enum(["book_call", "request_quote", "decline", "hold"]), notes: z.string().trim().max(4000).optional().nullable() });

// Mark a decision without sending anything (e.g. hold, or decided offline).
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.decision", async (req: NextRequest, { params, admin }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "invalid_input" }, 400);
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  const decision = await recordDecision({ session_id: session.id, decision: parsed.data.decision, notes: parsed.data.notes ?? null, decided_by: admin });
  return adminJson({ ok: true, decision });
});
