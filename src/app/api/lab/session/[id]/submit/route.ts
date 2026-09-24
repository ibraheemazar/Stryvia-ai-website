import { after, type NextRequest } from "next/server";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { getLatestBrief, updateSession } from "@/lib/lab/store";
import { runPostSubmit } from "@/lib/lab/submit";
import { getLabSettings } from "@/lib/lab/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Submit: lock the session, then run the private pipeline after the response
// is sent (assessment, founder notification, brief copy). `after()` is not
// durable, so the hourly `lab_sweep` cron re-runs anything left pending.
export const POST = withLabRoute<{ id: string }>("lab.session.submit", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  const brief = await getLatestBrief(session.id);
  if (!brief) return json({ ok: false, error: "no_brief" }, 409);

  await updateSession(session.id, {
    status: "submitted",
    phase: "done",
    submitted_at: new Date().toISOString(),
    assessment_status: "pending",
  });
  await labEvent("session.submitted", "info", { sessionId: session.id, requestId, payload: { turn_index: session.turn_count } });

  after(async () => {
    await runPostSubmit(session.id);
  });

  return json({ ok: true, responseDays: getLabSettings().responseDays });
});
