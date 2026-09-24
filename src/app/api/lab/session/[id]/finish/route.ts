import type { NextRequest } from "next/server";
import { generateBrief } from "@/lib/lab/brief";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { updateSession } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The visitor opts to finish (or the interviewer reached review): move to
// review and generate the first brief version.
export const POST = withLabRoute<{ id: string }>("lab.session.finish", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  if (session.turn_count < 1) return json({ ok: false, error: "too_early" }, 409);
  if (session.phase !== "review") {
    await updateSession(session.id, { phase: "review", turns_in_phase: 0 });
    await labEvent("phase.transition", "info", { sessionId: session.id, requestId, payload: { from_phase: session.phase, to_phase: "review", reasons: ["visitor_finish_button"] } });
  }
  const brief = await generateBrief({ ...session, phase: "review" });
  return json({ ok: true, brief: { version: brief.version, language: brief.language, content: brief.content, visitorEdited: false } });
});
