import type { NextRequest } from "next/server";
import { generateBrief } from "@/lib/lab/brief";
import { briefVersionsView, briefView } from "@/lib/lab/brief-view";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { withSessionLock } from "@/lib/lab/locks";
import { getCurrentBrief, getSessionById, updateSession } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The visitor opts to finish (or the interviewer reached review): move to
// review and generate the first brief version. Idempotent: a second call
// (double tap, auto-finish plus the button, a refresh) returns the brief that
// already exists instead of generating another. Runs under the session lock,
// so it can never overlap a turn that is still being answered.
export const POST = withLabRoute<{ id: string }>("lab.session.finish", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  if (session.turn_count < 1) return json({ ok: false, error: "too_early" }, 409);

  return withSessionLock(session.id, "finish", 150, async () => {
    const fresh = (await getSessionById(session.id)) ?? session;
    const existing = await getCurrentBrief(fresh);
    if (existing && fresh.phase === "review") {
      return json({ ok: true, brief: briefView(existing, fresh), versions: await briefVersionsView(fresh), reused: true });
    }
    if (fresh.phase !== "review") {
      await updateSession(fresh.id, { phase: "review", turns_in_phase: 0 });
      await labEvent("phase.transition", "info", { sessionId: fresh.id, requestId, payload: { from_phase: fresh.phase, to_phase: "review", reasons: ["visitor_finish_button"] } });
    }
    const brief = await generateBrief({ ...fresh, phase: "review" });
    const after = (await getSessionById(session.id)) ?? fresh;
    return json({ ok: true, brief: briefView(brief, after), versions: await briefVersionsView(after) });
  });
});
