import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { withSessionLock } from "@/lib/lab/locks";
import { getCurrentBrief, getSessionById, updateSession } from "@/lib/lab/store";
import { runPostSubmit } from "@/lib/lab/submit";
import { getLabSettings } from "@/lib/lab/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Submit for manual review. The visitor names the version they are looking at;
// it must be the current one (no unsaved edits, no unreviewed proposal in the
// way) and no other operation may be running. The submitted version number is
// frozen on the session so print, email and admin all show exactly it.
// Submission never decides anything: the session enters "awaiting manual
// review" and only an authorised reviewer can record a decision.
export const POST = withLabRoute<{ id: string }>("lab.session.submit", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  const parsed = await readJson(req, z.object({ version: z.number().int().positive() }));
  if (!parsed.ok) return parsed.res;

  return withSessionLock(session.id, "submit", 30, async () => {
    const fresh = (await getSessionById(session.id)) ?? session;
    if (fresh.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
    const brief = await getCurrentBrief(fresh);
    if (!brief) return json({ ok: false, error: "no_brief" }, 409);
    if (brief.version !== parsed.data.version) return json({ ok: false, error: "stale", currentVersion: brief.version }, 409);

    await updateSession(fresh.id, {
      status: "submitted",
      phase: "done",
      submitted_at: new Date().toISOString(),
      submitted_brief_version: brief.version,
      assessment_status: "pending",
    });
    await labEvent("session.submitted", "info", {
      sessionId: fresh.id,
      requestId,
      payload: { turn_index: fresh.turn_count, count: brief.version, language: brief.language },
    });

    after(async () => {
      await runPostSubmit(fresh.id);
    });

    return json({ ok: true, submittedVersion: brief.version, responseDays: getLabSettings().responseDays });
  });
});
