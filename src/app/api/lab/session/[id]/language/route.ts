import type { NextRequest } from "next/server";
import { z } from "zod";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { updateSession } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Switch the interview language mid-session (brief §2.1). The UI locale
// changes via the URL prefix; this changes what the interviewer speaks.
export const POST = withLabRoute<{ id: string }>("lab.session.language", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const parsed = await readJson(req, z.object({ language: z.enum(["en", "ar"]) }));
  if (!parsed.ok) return parsed.res;
  if (owner.session.language !== parsed.data.language) {
    await updateSession(owner.session.id, { language: parsed.data.language });
    await labEvent("session.language_switched", "info", { sessionId: owner.session.id, requestId, payload: { language: parsed.data.language } });
  }
  return json({ ok: true, language: parsed.data.language });
});
