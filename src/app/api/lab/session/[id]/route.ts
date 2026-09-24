import type { NextRequest } from "next/server";
import { getLabSettings } from "@/lib/lab/env";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { computeProgress } from "@/lib/lab/phase";
import { getLatestBrief, getState, listMessages } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hydration payload for the session page. Never includes assessments,
// decisions or slot confidences — only what the visitor is allowed to see.
export const GET = withLabRoute<{ id: string }>("lab.session.get", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  const [messages, state, brief] = await Promise.all([listMessages(session.id), getState(session.id), getLatestBrief(session.id)]);
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
      responseDays: getLabSettings().responseDays,
      busy: Boolean(session.pending_turn_id),
    },
    messages: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ id: m.id, role: m.role, content: m.content, inputMode: m.input_mode, createdAt: m.created_at })),
    brief: brief
      ? { version: brief.version, language: brief.language, content: brief.content, visitorEdited: brief.visitor_edited }
      : null,
  });
});
