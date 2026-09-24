import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateBrief, saveEditedBrief } from "@/lib/lab/brief";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { BriefSchema } from "@/lib/lab/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PostSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("revise"), instruction: z.string().trim().min(2).max(1500) }),
  z.object({ mode: z.literal("translate"), language: z.enum(["en", "ar"]) }),
  z.object({ mode: z.literal("regenerate") }),
]);

function view(b: { version: number; language: string; content: unknown; visitor_edited: boolean }) {
  return { version: b.version, language: b.language, content: b.content, visitorEdited: b.visitor_edited };
}

// POST: ask the AI to revise / translate / regenerate. PUT: save inline edits.
export const POST = withLabRoute<{ id: string }>("lab.session.brief.post", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress" || session.phase !== "review") return json({ ok: false, error: "not_in_review" }, 409);
  if (await isRateLimited(hashKey("brief", session.id), 6, 600)) return json({ ok: false, error: "rate_limited" }, 429);
  const parsed = await readJson(req, PostSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;
  const brief =
    body.mode === "revise"
      ? await generateBrief(session, { revision: { instruction: body.instruction } })
      : body.mode === "translate"
        ? await generateBrief(session, { language: body.language })
        : await generateBrief(session);
  return json({ ok: true, brief: view(brief) });
});

export const PUT = withLabRoute<{ id: string }>("lab.session.brief.put", async (req: NextRequest, { params }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress" || session.phase !== "review") return json({ ok: false, error: "not_in_review" }, 409);
  const parsed = await readJson(req, z.object({ content: BriefSchema }));
  if (!parsed.ok) return parsed.res;
  const brief = await saveEditedBrief(session, parsed.data.content);
  return json({ ok: true, brief: view(brief) });
});
