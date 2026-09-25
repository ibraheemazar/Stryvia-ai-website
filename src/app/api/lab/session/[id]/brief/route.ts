import type { NextRequest } from "next/server";
import { z } from "zod";
import { acceptBriefVersion, BriefConflictError, BriefUnverifiedError, generateBrief, reviseBrief, saveEditedBrief, translateBrief } from "@/lib/lab/brief";
import { briefVersionsView, briefView } from "@/lib/lab/brief-view";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { withSessionLock } from "@/lib/lab/locks";
import { hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { BriefSchema } from "@/lib/lab/schemas";
import { getBriefVersion, getCurrentBrief, getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Every operation names the version it starts from (`baseVersion`) and runs
// under the session lock. Translations and AI revisions come back as
// PROPOSALS with the list of changed fields; nothing becomes the visitor's
// current brief until they accept it. A proposal made from a version that is
// no longer current is refused as stale.

const PostSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("revise"), instruction: z.string().trim().min(2).max(1500), baseVersion: z.number().int().positive() }),
  z.object({ mode: z.literal("translate"), language: z.enum(["en", "ar"]), baseVersion: z.number().int().positive() }),
  z.object({ mode: z.literal("regenerate"), baseVersion: z.number().int().positive() }),
  z.object({ mode: z.literal("accept"), version: z.number().int().positive() }),
]);

const BRIEF_LOCK_SECONDS = 150;

function conflict(err: unknown) {
  if (err instanceof BriefConflictError) return json({ ok: false, error: err.reason }, 409);
  // The model's result failed a deterministic check; the source is untouched
  // and the visitor can try again or edit by hand.
  if (err instanceof BriefUnverifiedError) return json({ ok: false, error: err.reason, details: err.details }, 422);
  throw err;
}

export const GET = withLabRoute<{ id: string }>("lab.session.brief.get", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  const v = req.nextUrl.searchParams.get("version");
  const row = v ? await getBriefVersion(session.id, Number(v)) : await getCurrentBrief(session);
  if (!row) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, brief: briefView(row, session), versions: await briefVersionsView(session) });
});

export const POST = withLabRoute<{ id: string }>("lab.session.brief.post", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress" || session.phase !== "review") return json({ ok: false, error: "not_in_review" }, 409);
  const parsed = await readJson(req, PostSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  if (body.mode === "accept") {
    try {
      return await withSessionLock(session.id, "brief-accept", 30, async () => {
        const fresh = (await getSessionById(session.id)) ?? session;
        const proposal = await getBriefVersion(session.id, body.version);
        if (!proposal) return json({ ok: false, error: "not_found" }, 404);
        const accepted = await acceptBriefVersion(fresh, proposal);
        const after = (await getSessionById(session.id)) ?? fresh;
        return json({ ok: true, brief: briefView(accepted, after), versions: await briefVersionsView(after) });
      });
    } catch (err) {
      return conflict(err);
    }
  }

  if (await isRateLimited(hashKey("brief", session.id), 8, 600)) return json({ ok: false, error: "rate_limited" }, 429);

  try {
    return await withSessionLock(session.id, `brief-${body.mode}`, BRIEF_LOCK_SECONDS, async () => {
      const fresh = (await getSessionById(session.id)) ?? session;
      const current = await getCurrentBrief(fresh);
      if (!current) return json({ ok: false, error: "not_found" }, 404);
      if (current.version !== body.baseVersion) return json({ ok: false, error: "stale", currentVersion: current.version }, 409);

      if (body.mode === "translate") {
        if (body.language === current.language) return json({ ok: false, error: "same_language" }, 400);
        const { row, changes } = await translateBrief(fresh, current, body.language);
        return json({ ok: true, proposal: briefView(row, fresh), changes, versions: await briefVersionsView(fresh) });
      }
      if (body.mode === "revise") {
        const { row, changes, warnings } = await reviseBrief(fresh, current, body.instruction);
        return json({ ok: true, proposal: briefView(row, fresh), changes, warnings: warnings ?? [], versions: await briefVersionsView(fresh) });
      }
      // regenerate: a fresh draft from the conversation, also only a proposal.
      const row = await generateBrief(fresh, { language: current.language, asProposalOf: current.version });
      return json({ ok: true, proposal: briefView(row, fresh), changes: [], versions: await briefVersionsView(fresh) });
    });
  } catch (err) {
    return conflict(err);
  }
});

export const PUT = withLabRoute<{ id: string }>("lab.session.brief.put", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress" || session.phase !== "review") return json({ ok: false, error: "not_in_review" }, 409);
  const parsed = await readJson(req, z.object({ content: BriefSchema, baseVersion: z.number().int().positive() }));
  if (!parsed.ok) return parsed.res;
  try {
    return await withSessionLock(session.id, "brief-edit", 30, async () => {
      const fresh = (await getSessionById(session.id)) ?? session;
      const row = await saveEditedBrief(fresh, parsed.data.content, parsed.data.baseVersion);
      const after = (await getSessionById(session.id)) ?? fresh;
      return json({ ok: true, brief: briefView(row, after), versions: await briefVersionsView(after) });
    });
  } catch (err) {
    return conflict(err);
  }
});
