import type { NextRequest } from "next/server";
import { briefVersionsView, briefView } from "@/lib/lab/brief-view";
import { LAB_LIMITS } from "@/config/lab.config";
import { getLabSettings } from "@/lib/lab/env";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { computeProgress } from "@/lib/lab/phase";
import { getState, getSubmittedOrCurrentBrief, listMessages } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hydration payload for the session page. Never includes assessments,
// decisions or slot confidences — only what the visitor is allowed to see.
// `busy` tells the client an operation is still running server-side (a turn
// being answered, a brief being written) so it can wait instead of retrying;
// `unanswered` is true when the last visitor message has no reply and nothing
// is running, so the client offers Retry after a refresh.
export const GET = withLabRoute<{ id: string }>("lab.session.get", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  const [messages, state, brief] = await Promise.all([listMessages(session.id), getState(session.id), getSubmittedOrCurrentBrief(session)]);
  const visible = messages.filter((m) => m.role !== "system");
  const last = visible[visible.length - 1];
  const lockFresh =
    Boolean(session.pending_turn_id) &&
    Boolean(session.pending_started_at) &&
    Date.now() - new Date(session.pending_started_at as string).getTime() < LAB_LIMITS.turnLockTtlSeconds * 1000;
  const busy = lockFresh;
  const unanswered = session.status === "in_progress" && !busy && Boolean(last) && last.role === "user";
  return json({
    ok: true,
    session: {
      id: session.id,
      name: session.visitor_name,
      language: session.language,
      status: session.status,
      phase: session.phase,
      progress: computeProgress(session.phase, state.slots),
      turnCount: session.turn_count,
      submittedAt: session.submitted_at,
      submittedVersion: session.submitted_brief_version,
      responseDays: getLabSettings().responseDays,
      busy,
      unanswered,
    },
    messages: visible.map((m) => ({ id: m.id, role: m.role, content: m.content, inputMode: m.input_mode, createdAt: m.created_at })),
    brief: brief ? briefView(brief, session) : null,
    versions: brief ? await briefVersionsView(session) : [],
  });
});
